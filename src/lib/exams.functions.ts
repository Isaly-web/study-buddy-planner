import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const newExamSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  grade: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().min(1).max(2000),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

type PlanTopic = { title: string; tasks: { title: string; estimated_minutes: number }[] };
type PlanResult = { topics: PlanTopic[] };

function daysBetween(fromISO: string, toISO: string): string[] {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");
  const days: string[] = [];
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function generatePlanWithAI(input: {
  subject: string;
  grade?: string | null;
  description: string;
  totalDays: number;
}): Promise<PlanResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI Gateway saknar nyckel.");

  const { generateObject } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(apiKey);

  const schema = z.object({
    topics: z
      .array(
        z.object({
          title: z.string(),
          tasks: z
            .array(
              z.object({
                title: z.string(),
                estimated_minutes: z.number().int().min(5).max(90),
              }),
            )
            .min(1)
            .max(8),
        }),
      )
      .min(2)
      .max(6),
  });

  const prompt = [
    `Du planerar studier för en grundskoleelev${input.grade ? ` i ${input.grade}` : ""}.`,
    `Ämne: ${input.subject}.`,
    `Provet handlar om: ${input.description}.`,
    `Du har ungefär ${input.totalDays} studiedagar.`,
    `Skapa 2-5 tydliga områden ("topics") som täcker innehållet.`,
    `För varje område, lista 2-6 konkreta studieuppgifter på svenska.`,
    `Varje uppgift ska kunna göras på 10-45 minuter och vara handlingsbar (t.ex. "Läs och sammanfatta sidor X-Y", "Gör övning Z", "Förklara begreppet ... högt").`,
    `Inga uppgifter om förberedelse av material eller pauser.`,
    `Svara med giltig JSON enligt schemat.`,
  ].join(" ");

  const { object } = await generateObject({
    model: gateway("google/gemini-3-flash-preview"),
    schema,
    prompt,
  });

  return object as PlanResult;
}

function distributeTasks(plan: PlanResult, days: string[]) {
  // Reserve last day (day before exam) as rest day if we have >= 3 days.
  const studyDays = days.length >= 3 ? days.slice(0, -1) : days;
  const flat: { topicIndex: number; task: PlanTopic["tasks"][number] }[] = [];
  plan.topics.forEach((t, i) => t.tasks.forEach((task) => flat.push({ topicIndex: i, task })));
  const distribution: { day: string; topicIndex: number; task: PlanTopic["tasks"][number]; order: number }[] = [];
  flat.forEach((item, idx) => {
    const day = studyDays[idx % studyDays.length] ?? studyDays[studyDays.length - 1];
    distribution.push({ day, topicIndex: item.topicIndex, task: item.task, order: idx });
  });
  return distribution;
}

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => newExamSchema.parse(input))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    if (data.exam_date < today) throw new Error("Provdatumet måste ligga i framtiden.");

    const days = daysBetween(today, data.exam_date);
    if (days.length < 2) throw new Error("Provet behöver vara minst en dag bort.");

    const plan = await generatePlanWithAI({
      subject: data.subject,
      grade: data.grade ?? null,
      description: data.description,
      totalDays: Math.max(1, days.length - 1),
    });

    const { data: examRow, error: examErr } = await context.supabase
      .from("exams")
      .insert({
        user_id: context.userId,
        subject: data.subject,
        grade: data.grade ?? null,
        description: data.description,
        exam_date: data.exam_date,
      })
      .select("id")
      .single();
    if (examErr || !examRow) throw new Error(examErr?.message ?? "Kunde inte spara prov.");

    const { data: topicRows, error: topicErr } = await context.supabase
      .from("topics")
      .insert(
        plan.topics.map((t, i) => ({ exam_id: examRow.id, title: t.title, order: i })),
      )
      .select("id, order");
    if (topicErr || !topicRows) throw new Error(topicErr?.message ?? "Kunde inte spara områden.");

    const topicIdByIndex = new Map<number, string>();
    topicRows.forEach((row) => topicIdByIndex.set(row.order, row.id));

    const distribution = distributeTasks(plan, days);
    const tasksToInsert = distribution.map((d) => ({
      exam_id: examRow.id,
      topic_id: topicIdByIndex.get(d.topicIndex) ?? null,
      day_date: d.day,
      title: d.task.title,
      estimated_minutes: d.task.estimated_minutes,
      order: d.order,
    }));
    const { error: tasksErr } = await context.supabase.from("tasks").insert(tasksToInsert);
    if (tasksErr) throw new Error(tasksErr.message);

    return { id: examRow.id };
  });

export const listExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: exams, error } = await context.supabase
      .from("exams")
      .select("id, subject, grade, exam_date, share_token, created_at")
      .order("exam_date", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (exams ?? []).map((e) => e.id);
    let counts: Record<string, { total: number; done: number }> = {};
    if (ids.length) {
      const { data: tasks, error: tErr } = await context.supabase
        .from("tasks")
        .select("exam_id, completed_at")
        .in("exam_id", ids);
      if (tErr) throw new Error(tErr.message);
      for (const t of tasks ?? []) {
        const c = counts[t.exam_id] ?? { total: 0, done: 0 };
        c.total += 1;
        if (t.completed_at) c.done += 1;
        counts[t.exam_id] = c;
      }
    }

    return (exams ?? []).map((e) => ({
      ...e,
      total_tasks: counts[e.id]?.total ?? 0,
      done_tasks: counts[e.id]?.done ?? 0,
    }));
  });

export const getTodayTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("tasks")
      .select("id, title, estimated_minutes, completed_at, exam_id, day_date, exams!inner(subject, user_id)")
      .eq("day_date", today)
      .eq("exams.user_id", context.userId)
      .order("order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      estimated_minutes: row.estimated_minutes as number,
      completed_at: row.completed_at as string | null,
      exam_id: row.exam_id as string,
      subject: row.exams.subject as string,
    }));
  });

export const getExam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    return loadExamBundle(context.supabase, data.id, { ownerId: context.userId });
  });

export const getSharedExam = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam, error } = await supabaseAdmin
      .from("exams")
      .select("id")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!exam) throw new Error("Hittade ingen plan för denna länk.");
    return loadExamBundle(supabaseAdmin as any, exam.id, { shared: true });
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ task_id: z.string().uuid(), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ completed_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.task_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ task_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: tErr } = await context.supabase
      .from("tasks")
      .select("id, title, estimated_minutes, topic_id, exam_id, exams!inner(subject, grade, description, user_id), topics(title)")
      .eq("id", data.task_id)
      .single();
    if (tErr || !task) throw new Error(tErr?.message ?? "Uppgiften hittades inte.");
    const exam = (task as any).exams;
    if (exam.user_id !== context.userId) throw new Error("Ingen åtkomst.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway saknar nyckel.");

    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const levelSchema = z.object({
      criteria: z.string().min(10),
      exercises: z
        .array(z.object({ prompt: z.string().min(5), hint: z.string().optional() }))
        .min(2)
        .max(4),
    });
    const schema = z.object({ E: levelSchema, C: levelSchema, A: levelSchema });

    const topicTitle = (task as any).topics?.title as string | undefined;
    const prompt = [
      `Du är en svensk grundskolelärare${exam.grade ? ` i ${exam.grade}` : ""}.`,
      `Ämne: ${exam.subject}. Prov handlar om: ${exam.description}.`,
      topicTitle ? `Område: ${topicTitle}.` : "",
      `Dagens studieuppgift: "${(task as any).title}" (~${(task as any).estimated_minutes} min).`,
      `Skapa instuderingsuppgifter på tre betygsnivåer enligt Lgr22: E, C och A.`,
      `För varje nivå:`,
      `- "criteria": kort beskrivning (1-2 meningar) av vad som krävs för nivån, med skolans språk (t.ex. "grundläggande", "utvecklad", "välutvecklad").`,
      `- "exercises": 2-3 konkreta övningar på svenska som eleven kan göra nu.`,
      `E = grundläggande faktakunskap och enkla resonemang.`,
      `C = förklara samband, jämföra och använda begrepp.`,
      `A = analysera, dra slutsatser, motivera med flera perspektiv.`,
      `Svara på svenska med giltig JSON enligt schemat.`,
    ].join(" ");

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema,
      prompt,
    });
    return object;
  });

export const gradeAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        task_id: z.string().uuid(),
        level: z.enum(["E", "C", "A"]),
        criteria: z.string().min(1).max(2000),
        prompt: z.string().min(1).max(2000),
        answer: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: tErr } = await context.supabase
      .from("tasks")
      .select("id, title, exam_id, exams!inner(subject, grade, description, user_id)")
      .eq("id", data.task_id)
      .single();
    if (tErr || !task) throw new Error(tErr?.message ?? "Uppgiften hittades inte.");
    const exam = (task as any).exams;
    if (exam.user_id !== context.userId) throw new Error("Ingen åtkomst.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway saknar nyckel.");

    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const schema = z.object({
      verdict: z.enum(["correct", "partially_correct", "incorrect"]),
      score: z.number().int().min(0).max(100),
      encouragement: z.string().min(5),
      feedback: z.string().min(5),
      improvements: z.array(z.string()).max(4),
      reached_level: z.enum(["under_E", "E", "C", "A"]),
    });

    const prompt = [
      `Du är en varm och tydlig svensk grundskolelärare${exam.grade ? ` i ${exam.grade}` : ""}.`,
      `Ämne: ${exam.subject}. Prov handlar om: ${exam.description}.`,
      `Övning på betygsnivå ${data.level}. Kriterier: ${data.criteria}.`,
      `Frågan var: "${data.prompt}".`,
      `Elevens svar: "${data.answer}".`,
      `Rätta svaret enligt Lgr22.`,
      `Sätt "verdict" till correct/partially_correct/incorrect.`,
      `"score" är 0-100.`,
      `"encouragement": börja alltid med en kort, uppriktig uppmuntran som lyfter något eleven gjort bra (även om svaret är fel).`,
      `"feedback": förklara vänligt vad som var rätt/fel och varför, på svenska, max 3 meningar.`,
      `"improvements": 1-3 konkreta förslag på hur svaret kan förbättras. Tom lista om inget behöver förbättras.`,
      `"reached_level": vilken betygsnivå svaret motsvarar (under_E, E, C eller A).`,
      `Svara på svenska med giltig JSON enligt schemat.`,
    ].join(" ");

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema,
      prompt,
    });
    return object;
  });

export const coachAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        task_id: z.string().uuid(),
        level: z.enum(["E", "C", "A"]),
        criteria: z.string().min(1).max(2000),
        prompt: z.string().min(1).max(2000),
        answer: z.string().trim().min(1).max(4000),
        attempt: z.number().int().min(1).max(5),
        previous_hints: z.array(z.string()).max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: tErr } = await context.supabase
      .from("tasks")
      .select("id, title, exam_id, exams!inner(subject, grade, description, user_id)")
      .eq("id", data.task_id)
      .single();
    if (tErr || !task) throw new Error("Uppgiften hittades inte.");
    const exam = (task as any).exams;
    if (exam.user_id !== context.userId) throw new Error("Ingen åtkomst.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway saknar nyckel.");

    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const schema = z.object({
      is_correct: z.boolean(),
      encouragement: z.string().min(3),
      hint: z.string().min(3),
      explanation: z.string().optional().nullable(),
      offer_learn_first: z.boolean(),
    });

    const stage =
      data.attempt === 1
        ? `Detta är elevens första försök. Ge EN kort ledtråd som pekar i rätt riktning. Ge INTE svaret. Ge INGEN förklaring.`
        : `Detta är försök ${data.attempt}. Ge en tydligare ledtråd OCH en kort förklaring (max 2 meningar) av varför svaret inte stämmer. Sätt "offer_learn_first" till true om eleven verkar fastna.`;

    const prompt = [
      `Du är en varm svensk grundskolelärare${exam.grade ? ` i ${exam.grade}` : ""}.`,
      `Ämne: ${exam.subject}. Prov handlar om: ${exam.description}.`,
      `Övning (nivå ${data.level}). Kriterier: ${data.criteria}.`,
      `Fråga: "${data.prompt}".`,
      `Elevens svar: "${data.answer}".`,
      data.previous_hints?.length ? `Tidigare ledtrådar: ${data.previous_hints.map((h, i) => `(${i + 1}) ${h}`).join(" ")}. Upprepa dem inte.` : "",
      `Om svaret redan är korrekt: sätt "is_correct" till true och skriv beröm i "encouragement"; låt "hint" vara en kort bekräftelse.`,
      `Annars: sätt "is_correct" till false. ${stage}`,
      `"encouragement" ska ALLTID vara en kort, uppriktig uppmuntran som lyfter något eleven har gjort bra (max 1 mening).`,
      `Svara på svenska med giltig JSON enligt schemat.`,
    ].filter(Boolean).join(" ");

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema,
      prompt,
    });
    return object;
  });

export const generateVariantQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        task_id: z.string().uuid(),
        level: z.enum(["E", "C", "A"]),
        criteria: z.string().min(1).max(2000),
        previous_prompt: z.string().min(1).max(2000),
        easier: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: tErr } = await context.supabase
      .from("tasks")
      .select("id, title, exam_id, exams!inner(subject, grade, description, user_id)")
      .eq("id", data.task_id)
      .single();
    if (tErr || !task) throw new Error("Uppgiften hittades inte.");
    const exam = (task as any).exams;
    if (exam.user_id !== context.userId) throw new Error("Ingen åtkomst.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway saknar nyckel.");
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const schema = z.object({
      prompt: z.string().min(5),
      hint: z.string().optional(),
    });

    const prompt = [
      `Du är en svensk grundskolelärare${exam.grade ? ` i ${exam.grade}` : ""}.`,
      `Ämne: ${exam.subject}. Prov: ${exam.description}.`,
      `Skapa EN ny övning på nivå ${data.level} (kriterier: ${data.criteria}) som testar samma kunskap som frågan: "${data.previous_prompt}".`,
      data.easier ? `Gör den lite enklare och mer konkret.` : `Formulera den annorlunda men på samma nivå.`,
      `Ge också en kort valfri "hint".`,
      `Svara på svenska med giltig JSON enligt schemat.`,
    ].join(" ");

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema,
      prompt,
    });
    return object;
  });

export const generateLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        task_id: z.string().uuid(),
        mode: z.enum(["read", "listen", "examples"]),
        level: z.number().int().min(1).max(4).default(1),
        focus_prompt: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: tErr } = await context.supabase
      .from("tasks")
      .select("id, title, topic_id, exam_id, exams!inner(subject, grade, description, user_id), topics(title)")
      .eq("id", data.task_id)
      .single();
    if (tErr || !task) throw new Error("Uppgiften hittades inte.");
    const exam = (task as any).exams;
    if (exam.user_id !== context.userId) throw new Error("Ingen åtkomst.");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI Gateway saknar nyckel.");
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const levelStyle: Record<number, string> = {
      1: "Förklara som för en 12-åring – väldigt enkelt, korta meningar, vardagliga bilder.",
      2: "Förklara med enkla ord men lite mer detaljer.",
      3: "Använd korrekt fackspråk och begrepp.",
      4: "Använd ett verkligt exempel från vardagen som huvudingång.",
    };

    const topicTitle = (task as any).topics?.title as string | undefined;

    if (data.mode === "examples") {
      const schema = z.object({
        intro: z.string().min(5),
        examples: z
          .array(z.object({ title: z.string(), body: z.string() }))
          .min(2)
          .max(4),
      });
      const prompt = [
        `Du är en varm svensk grundskolelärare${exam.grade ? ` i ${exam.grade}` : ""}.`,
        `Ämne: ${exam.subject}. Prov: ${exam.description}.`,
        topicTitle ? `Område: ${topicTitle}.` : "",
        `Studieuppgift: "${(task as any).title}".`,
        data.focus_prompt ? `Eleven fastnade på: "${data.focus_prompt}".` : "",
        levelStyle[data.level],
        `Ge 2-4 konkreta praktiska exempel på svenska. Varje exempel ska ha en kort titel och en förklarande brödtext (max ~80 ord). Använd gärna en enkel jämförelse eller vardagssituation.`,
        `Svara med giltig JSON enligt schemat.`,
      ].filter(Boolean).join(" ");
      const { object } = await generateObject({
        model: gateway("google/gemini-3-flash-preview"),
        schema,
        prompt,
      });
      return { mode: "examples" as const, level: data.level, ...object };
    }

    // read + listen dela samma text
    const schema = z.object({
      title: z.string().min(3),
      markdown: z.string().min(50),
      spoken_intro: z.string().min(10),
    });
    const prompt = [
      `Du är en varm svensk grundskolelärare${exam.grade ? ` i ${exam.grade}` : ""}.`,
      `Ämne: ${exam.subject}. Prov: ${exam.description}.`,
      topicTitle ? `Område: ${topicTitle}.` : "",
      `Studieuppgift: "${(task as any).title}".`,
      data.focus_prompt ? `Eleven fastnade på: "${data.focus_prompt}". Utgå från detta.` : "",
      levelStyle[data.level],
      data.mode === "listen"
        ? `Skriv en liten "mikropodd" på ca 2-4 minuter (~300-450 ord) i naturligt talspråk. Undvik listor och rubriker – flytande tal. "markdown" är samma text, formaterad med korta stycken. "spoken_intro" är en kort hälsning på 1-2 meningar.`
        : `Skriv en kort sammanfattning (2-5 minuter läsning, ~250-450 ord) på svenska i markdown. Använd korta stycken, gärna 1-2 rubriker och en punktlista med de viktigaste begreppen. "spoken_intro" kan vara samma första mening.`,
      `Svara med giltig JSON enligt schemat.`,
    ].filter(Boolean).join(" ");

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema,
      prompt,
    });
    return { mode: data.mode, level: data.level, ...object };
  });

async function loadExamBundle(
  client: any,
  examId: string,
  opts: { ownerId?: string; shared?: boolean },
) {
  let q = client
    .from("exams")
    .select("id, subject, grade, description, exam_date, share_token, user_id")
    .eq("id", examId);
  if (opts.ownerId) q = q.eq("user_id", opts.ownerId);
  const { data: exam, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!exam) throw new Error("Provet hittades inte.");

  const [{ data: topics, error: tErr }, { data: tasks, error: kErr }] = await Promise.all([
    client.from("topics").select("id, title, order").eq("exam_id", examId).order("order"),
    client
      .from("tasks")
      .select("id, title, estimated_minutes, completed_at, day_date, topic_id, order")
      .eq("exam_id", examId)
      .order("day_date")
      .order("order"),
  ]);
  if (tErr) throw new Error(tErr.message);
  if (kErr) throw new Error(kErr.message);

  return {
    exam: {
      id: exam.id as string,
      subject: exam.subject as string,
      grade: (exam.grade as string | null) ?? null,
      description: (exam.description as string | null) ?? null,
      exam_date: exam.exam_date as string,
      share_token: opts.shared ? null : (exam.share_token as string),
    },
    topics: (topics ?? []) as { id: string; title: string; order: number }[],
    tasks: (tasks ?? []) as {
      id: string;
      title: string;
      estimated_minutes: number;
      completed_at: string | null;
      day_date: string;
      topic_id: string | null;
      order: number;
    }[],
    readonly: !!opts.shared,
  };
}