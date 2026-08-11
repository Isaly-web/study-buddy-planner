import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const saveAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        task_id: z.string().uuid(),
        level: z.enum(["E", "C", "A"]),
        score: z.number().int().min(0).max(100),
        answer: z.string().trim().min(1).max(4000),
        feedback: z
          .object({
            verdict: z.string().optional(),
            encouragement: z.string().optional(),
            feedback: z.string().optional(),
            improvements: z.array(z.string()).optional(),
            reached_level: z.string().optional(),
          })
          .partial()
          .nullable()
          .optional(),
        attempts_used: z.number().int().min(1).max(10).optional(),
        used_help: z
          .object({
            hints: z.number().int().min(0).max(10).optional(),
            lesson_used: z.boolean().optional(),
            lesson_mode: z.enum(["read", "listen", "examples"]).optional(),
            level: z.number().int().min(1).max(4).optional(),
          })
          .partial()
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: taskErr } = await context.supabase
      .from("tasks")
      .select("id")
      .eq("id", data.task_id)
      .maybeSingle();
    if (taskErr || !task) throw new Error("Uppgiften hittades inte.");
    const { error } = await context.supabase.from("exercise_attempts").insert({
      user_id: context.userId,
      task_id: data.task_id,
      level: data.level,
      score: data.score,
      answer: data.answer,
      feedback: data.feedback ?? null,
      attempts_used: data.attempts_used ?? 1,
      used_help: data.used_help ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type StatsPayload = {
  totals: {
    exams: number;
    total_tasks: number;
    done_tasks: number;
    attempts: number;
    avg_score: number | null;
    pass_rate: number | null; // andel >= 60
  };
  perLevel: { level: "E" | "C" | "A"; attempts: number; avg_score: number | null; pass_rate: number | null }[];
  perSubject: {
    subject: string;
    total_tasks: number;
    done_tasks: number;
    attempts: number;
    avg_score: number | null;
  }[];
  perTopic: {
    exam_id: string;
    subject: string;
    topic: string;
    total_tasks: number;
    done_tasks: number;
    attempts: number;
    avg_score: number | null;
  }[];
  weekly: { week: string; avg_score: number | null; attempts: number; done_tasks: number }[];
  repetition: { subject: string; topic: string | null; label: string; reason: string; avg_score: number | null }[];
};

function isoWeekKey(d: Date): string {
  // ISO year-week (Måndag som veckostart)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-v${String(weekNo).padStart(2, "0")}`;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatsPayload> => {
    const [examsRes, tasksRes, topicsRes, attemptsRes] = await Promise.all([
      context.supabase.from("exams").select("id, subject"),
      context.supabase
        .from("tasks")
        .select("id, exam_id, topic_id, completed_at, day_date"),
      context.supabase.from("topics").select("id, exam_id, title"),
      context.supabase
        .from("exercise_attempts")
        .select("task_id, level, score, created_at")
        .order("created_at", { ascending: true }),
    ]);
    for (const r of [examsRes, tasksRes, topicsRes, attemptsRes]) {
      if (r.error) throw new Error(r.error.message);
    }
    const exams = examsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const topics = topicsRes.data ?? [];
    const attempts = attemptsRes.data ?? [];

    const subjectByExam = new Map(exams.map((e) => [e.id, e.subject]));
    const topicById = new Map(topics.map((t) => [t.id, t]));
    const examByTask = new Map(tasks.map((t) => [t.id, t.exam_id]));
    const topicByTask = new Map(tasks.map((t) => [t.id, t.topic_id]));

    // Totals
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.completed_at).length;
    const scores = attempts.map((a) => a.score);
    const totals = {
      exams: exams.length,
      total_tasks: totalTasks,
      done_tasks: doneTasks,
      attempts: attempts.length,
      avg_score: avg(scores),
      pass_rate:
        attempts.length === 0
          ? null
          : Math.round((attempts.filter((a) => a.score >= 60).length / attempts.length) * 100),
    };

    // Per level
    const perLevel = (["E", "C", "A"] as const).map((level) => {
      const rows = attempts.filter((a) => a.level === level);
      const s = rows.map((r) => r.score);
      return {
        level,
        attempts: rows.length,
        avg_score: avg(s),
        pass_rate: rows.length === 0 ? null : Math.round((rows.filter((r) => r.score >= 60).length / rows.length) * 100),
      };
    });

    // Per subject
    const subjectAgg = new Map<
      string,
      { total_tasks: number; done_tasks: number; scores: number[]; attempts: number }
    >();
    for (const t of tasks) {
      const subj = subjectByExam.get(t.exam_id) ?? "Övrigt";
      const a = subjectAgg.get(subj) ?? { total_tasks: 0, done_tasks: 0, scores: [], attempts: 0 };
      a.total_tasks += 1;
      if (t.completed_at) a.done_tasks += 1;
      subjectAgg.set(subj, a);
    }
    for (const at of attempts) {
      const examId = examByTask.get(at.task_id);
      const subj = examId ? subjectByExam.get(examId) ?? "Övrigt" : "Övrigt";
      const a = subjectAgg.get(subj) ?? { total_tasks: 0, done_tasks: 0, scores: [], attempts: 0 };
      a.scores.push(at.score);
      a.attempts += 1;
      subjectAgg.set(subj, a);
    }
    const perSubject = Array.from(subjectAgg.entries())
      .map(([subject, a]) => ({
        subject,
        total_tasks: a.total_tasks,
        done_tasks: a.done_tasks,
        attempts: a.attempts,
        avg_score: avg(a.scores),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    // Per topic
    const topicAgg = new Map<
      string,
      { exam_id: string; subject: string; topic: string; total_tasks: number; done_tasks: number; scores: number[]; attempts: number }
    >();
    for (const t of tasks) {
      if (!t.topic_id) continue;
      const topic = topicById.get(t.topic_id);
      if (!topic) continue;
      const subj = subjectByExam.get(topic.exam_id) ?? "Övrigt";
      const key = topic.id;
      const a = topicAgg.get(key) ?? {
        exam_id: topic.exam_id,
        subject: subj,
        topic: topic.title,
        total_tasks: 0,
        done_tasks: 0,
        scores: [],
        attempts: 0,
      };
      a.total_tasks += 1;
      if (t.completed_at) a.done_tasks += 1;
      topicAgg.set(key, a);
    }
    for (const at of attempts) {
      const topicId = topicByTask.get(at.task_id);
      if (!topicId) continue;
      const a = topicAgg.get(topicId);
      if (!a) continue;
      a.scores.push(at.score);
      a.attempts += 1;
    }
    const perTopic = Array.from(topicAgg.values())
      .map((a) => ({
        exam_id: a.exam_id,
        subject: a.subject,
        topic: a.topic,
        total_tasks: a.total_tasks,
        done_tasks: a.done_tasks,
        attempts: a.attempts,
        avg_score: avg(a.scores),
      }))
      .sort((a, b) => (a.avg_score ?? 100) - (b.avg_score ?? 100));

    // Weekly (senaste 8 veckor)
    const now = new Date();
    const weekBuckets: { key: string; scores: number[]; attempts: number; done: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const key = isoWeekKey(d);
      if (!weekBuckets.find((b) => b.key === key)) {
        weekBuckets.push({ key, scores: [], attempts: 0, done: 0 });
      }
    }
    for (const at of attempts) {
      const key = isoWeekKey(new Date(at.created_at));
      const bucket = weekBuckets.find((b) => b.key === key);
      if (bucket) {
        bucket.scores.push(at.score);
        bucket.attempts += 1;
      }
    }
    for (const t of tasks) {
      if (!t.completed_at) continue;
      const key = isoWeekKey(new Date(t.completed_at));
      const bucket = weekBuckets.find((b) => b.key === key);
      if (bucket) bucket.done += 1;
    }
    const weekly = weekBuckets.map((b) => ({
      week: b.key,
      avg_score: avg(b.scores),
      attempts: b.attempts,
      done_tasks: b.done,
    }));

    // Repetition-förslag: områden med snitt < 60 eller helt osvarade områden med oklara uppgifter
    const repetition: StatsPayload["repetition"] = [];
    for (const t of perTopic) {
      if (t.avg_score !== null && t.avg_score < 60) {
        repetition.push({
          subject: t.subject,
          topic: t.topic,
          label: `${t.subject} · ${t.topic}`,
          reason: `Snitt ${t.avg_score}/100 – öva mer på detta område.`,
          avg_score: t.avg_score,
        });
      } else if (t.attempts === 0 && t.total_tasks - t.done_tasks > 0) {
        repetition.push({
          subject: t.subject,
          topic: t.topic,
          label: `${t.subject} · ${t.topic}`,
          reason: `Inga övningar gjorda ännu.`,
          avg_score: null,
        });
      }
    }
    repetition.sort((a, b) => (a.avg_score ?? 101) - (b.avg_score ?? 101));

    return {
      totals,
      perLevel,
      perSubject,
      perTopic: perTopic.slice(0, 10),
      weekly,
      repetition: repetition.slice(0, 8),
    };
  });