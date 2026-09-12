import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createVocabularyTermSchema = z.object({
  vocabulary_set_id: z.string().uuid(),
  term: z.string().trim().min(1).max(200),
  definition: z.string().trim().min(1).max(1000),
  example: z.string().trim().max(1000).optional().nullable(),
});

export const updateVocabularyTermSchema = z.object({
  id: z.string().uuid(),
  term: z.string().trim().min(1).max(200).optional(),
  definition: z.string().trim().min(1).max(1000).optional(),
  example: z.string().trim().max(1000).optional().nullable(),
});

export const recordVocabularyAttemptSchema = z.object({
  term_id: z.string().uuid(),
  is_correct: z.boolean(),
});

export type VocabularyTopicOverview = {
  topic_id: string;
  topic_title: string;
  set_id: string | null;
  term_count: number;
  attempt_count: number;
  correct_count: number;
  accuracy: number | null;
  last_practiced_at: string | null;
};

export const listVocabularyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ exam_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<VocabularyTopicOverview[]> => {
    const { data: topics, error: topicsErr } = await context.supabase
      .from("topics")
      .select("id, title")
      .eq("exam_id", data.exam_id);
    if (topicsErr) throw new Error(topicsErr.message);
    if (!topics || topics.length === 0) return [];

    const topicIds = topics.map((t) => t.id);
    const { data: sets, error: setsErr } = await context.supabase
      .from("vocabulary_sets")
      .select("id, topic_id")
      .in("topic_id", topicIds);
    if (setsErr) throw new Error(setsErr.message);

    const setIds = (sets ?? []).map((s) => s.id);
    let terms: { id: string; vocabulary_set_id: string }[] = [];
    if (setIds.length > 0) {
      const { data: termRows, error: termsErr } = await context.supabase
        .from("vocabulary_terms")
        .select("id, vocabulary_set_id")
        .in("vocabulary_set_id", setIds);
      if (termsErr) throw new Error(termsErr.message);
      terms = termRows ?? [];
    }

    const termIds = terms.map((t) => t.id);
    let attempts: { term_id: string; is_correct: boolean; created_at: string }[] = [];
    if (termIds.length > 0) {
      const { data: attemptRows, error: attemptsErr } = await context.supabase
        .from("vocabulary_attempts")
        .select("term_id, is_correct, created_at")
        .in("term_id", termIds);
      if (attemptsErr) throw new Error(attemptsErr.message);
      attempts = attemptRows ?? [];
    }

    const setByTopic = new Map((sets ?? []).map((s) => [s.topic_id, s.id]));
    const termsBySet = new Map<string, number>();
    for (const t of terms)
      termsBySet.set(t.vocabulary_set_id, (termsBySet.get(t.vocabulary_set_id) ?? 0) + 1);
    const setIdByTermId = new Map(terms.map((t) => [t.id, t.vocabulary_set_id]));

    const statsBySet = new Map<
      string,
      { attempts: number; correct: number; lastAt: string | null }
    >();
    for (const a of attempts) {
      const setId = setIdByTermId.get(a.term_id);
      if (!setId) continue;
      const s = statsBySet.get(setId) ?? { attempts: 0, correct: 0, lastAt: null };
      s.attempts += 1;
      if (a.is_correct) s.correct += 1;
      if (!s.lastAt || a.created_at > s.lastAt) s.lastAt = a.created_at;
      statsBySet.set(setId, s);
    }

    return topics.map((topic) => {
      const setId = setByTopic.get(topic.id) ?? null;
      const stats = setId ? statsBySet.get(setId) : undefined;
      return {
        topic_id: topic.id,
        topic_title: topic.title,
        set_id: setId,
        term_count: setId ? (termsBySet.get(setId) ?? 0) : 0,
        attempt_count: stats?.attempts ?? 0,
        correct_count: stats?.correct ?? 0,
        accuracy:
          stats && stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : null,
        last_practiced_at: stats?.lastAt ?? null,
      };
    });
  });

export const getOrCreateVocabularySet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ topic_id: z.string().uuid(), title: z.string().trim().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: findErr } = await context.supabase
      .from("vocabulary_sets")
      .select("id, topic_id, title, created_at")
      .eq("topic_id", data.topic_id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing) return existing;

    const { data: created, error: createErr } = await context.supabase
      .from("vocabulary_sets")
      .insert({ topic_id: data.topic_id, user_id: context.userId, title: data.title })
      .select("id, topic_id, title, created_at")
      .single();
    if (createErr || !created) throw new Error(createErr?.message ?? "Kunde inte skapa ordlista.");
    return created;
  });

export const updateVocabularySet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vocabulary_sets")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVocabularySet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vocabulary_sets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVocabularyTerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ vocabulary_set_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: terms, error } = await context.supabase
      .from("vocabulary_terms")
      .select("id, term, definition, example, order")
      .eq("vocabulary_set_id", data.vocabulary_set_id)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return terms ?? [];
  });

export const createVocabularyTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createVocabularyTermSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing, error: maxErr } = await context.supabase
      .from("vocabulary_terms")
      .select("order")
      .eq("vocabulary_set_id", data.vocabulary_set_id)
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) throw new Error(maxErr.message);
    const nextOrder = (existing?.order ?? -1) + 1;

    const { data: created, error } = await context.supabase
      .from("vocabulary_terms")
      .insert({
        vocabulary_set_id: data.vocabulary_set_id,
        term: data.term,
        definition: data.definition,
        example: data.example ?? null,
        order: nextOrder,
      })
      .select("id, term, definition, example, order")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Kunde inte spara ordet.");
    return created;
  });

export const updateVocabularyTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateVocabularyTermSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    const { error } = await context.supabase.from("vocabulary_terms").update(fields).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVocabularyTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vocabulary_terms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordVocabularyAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recordVocabularyAttemptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vocabulary_attempts").insert({
      user_id: context.userId,
      term_id: data.term_id,
      is_correct: data.is_correct,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
