import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  MAX_IMPORT_DATA_URL_LENGTH,
  MAX_IMPORT_TEXT_LENGTH,
  ACCEPTED_IMAGE_MIME_TYPES,
  ACCEPTED_PDF_MIME_TYPE,
} from "./vocabulary-import";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

async function getNextOrder(
  supabase: SupabaseClient<Database, "study_buddy_planner">,
  vocabularySetId: string,
): Promise<number> {
  const { data: existing, error } = await supabase
    .from("vocabulary_terms")
    .select("order")
    .eq("vocabulary_set_id", vocabularySetId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (existing?.order ?? -1) + 1;
}

export const createVocabularyTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createVocabularyTermSchema.parse(input))
  .handler(async ({ data, context }) => {
    const nextOrder = await getNextOrder(context.supabase, data.vocabulary_set_id);

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

// --- Vocabulary import (PDF / image / pasted text → AI extraction) ---

export const vocabularyImportWordSchema = z.object({
  term: z.string().trim().min(1).max(200),
  definition: z.string().trim().min(1).max(1000),
  example: z.string().trim().max(1000).optional().nullable(),
});

export const vocabularyImportResultSchema = z.object({
  words: z.array(vocabularyImportWordSchema).max(150),
});

export type VocabularyImportResult = z.infer<typeof vocabularyImportResultSchema>;

function buildTextExtractionPrompt(sourceText: string): string {
  return [
    "Du extraherar ordförråd (glosor) från text för en grundskoleelev.",
    "Hitta par av begrepp/ord och deras definition eller översättning.",
    'Om texten är en tvåspråkig ordlista (t.ex. "apple - äpple"), använd källordet som "term" och målordet/förklaringen som "definition".',
    "Hoppa över rubriker, sidnumrering och annat som inte är ett ordpar.",
    "Max 150 ord. Svara med giltig JSON enligt schemat.",
    "Text:",
    sourceText,
  ].join("\n");
}

const IMAGE_EXTRACTION_INSTRUCTION = [
  "Läs texten i bilden (t.ex. en glosbok, ordlista eller ordlapp) och extrahera ordförråd (glosor) för en grundskoleelev.",
  "Hitta par av begrepp/ord och deras definition eller översättning.",
  'Om det är en tvåspråkig ordlista (t.ex. "apple - äpple"), använd källordet som "term" och målordet/förklaringen som "definition".',
  "Hoppa över rubriker, sidnumrering och annat som inte är ett ordpar.",
  "Max 150 ord. Svara med giltig JSON enligt schemat.",
].join("\n");

async function callVocabularyExtractionModel(
  params:
    | { kind: "text"; prompt: string }
    | { kind: "multimodal"; instruction: string; imageDataUrl: string; mimeType: string },
): Promise<VocabularyImportResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API-nyckel saknas.");

  const { generateObject } = await import("ai");
  const { createAnthropicProvider, DEFAULT_MODEL } = await import("./ai-gateway.server");
  const model = createAnthropicProvider(apiKey)(DEFAULT_MODEL);

  try {
    const { object } =
      params.kind === "text"
        ? await generateObject({
            model,
            schema: vocabularyImportResultSchema,
            prompt: params.prompt,
          })
        : await generateObject({
            model,
            schema: vocabularyImportResultSchema,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: params.instruction },
                  { type: "file", data: params.imageDataUrl, mediaType: params.mimeType },
                ],
              },
            ],
          });
    return object;
  } catch {
    throw new Error(
      params.kind === "multimodal"
        ? "Kunde inte tolka bilden. Försök med en tydligare bild eller klistra in texten manuellt."
        : "Kunde inte tolka innehållet. Försök igen.",
    );
  }
}

export const extractVocabularyFromTextSchema = z.object({
  text: z.string().trim().min(1).max(MAX_IMPORT_TEXT_LENGTH),
});

export const extractVocabularyFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extractVocabularyFromTextSchema.parse(input))
  .handler(async ({ data }): Promise<VocabularyImportResult> =>
    callVocabularyExtractionModel({ kind: "text", prompt: buildTextExtractionPrompt(data.text) }),
  );

export const extractVocabularyFromImageSchema = z.object({
  image_data_url: z.string().min(1).max(MAX_IMPORT_DATA_URL_LENGTH),
  mime_type: z.enum(ACCEPTED_IMAGE_MIME_TYPES),
});

export const extractVocabularyFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extractVocabularyFromImageSchema.parse(input))
  .handler(async ({ data }): Promise<VocabularyImportResult> =>
    callVocabularyExtractionModel({
      kind: "multimodal",
      instruction: IMAGE_EXTRACTION_INSTRUCTION,
      imageDataUrl: data.image_data_url,
      mimeType: data.mime_type,
    }),
  );

export const extractVocabularyFromPdfSchema = z.object({
  pdf_data_url: z.string().min(1).max(MAX_IMPORT_DATA_URL_LENGTH),
});

export const extractVocabularyFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extractVocabularyFromPdfSchema.parse(input))
  .handler(async ({ data }): Promise<VocabularyImportResult> => {
    if (!data.pdf_data_url.startsWith(`data:${ACCEPTED_PDF_MIME_TYPE}`)) {
      throw new Error("Filen verkar inte vara en PDF.");
    }
    const base64 = data.pdf_data_url.split(",")[1] ?? "";
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));

    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });

    if (!text || text.trim().length < 20) {
      throw new Error(
        "PDF:en verkar sakna text (kan vara en skannad bild). Prova att ladda upp den som bild istället.",
      );
    }

    return callVocabularyExtractionModel({
      kind: "text",
      prompt: buildTextExtractionPrompt(text.slice(0, MAX_IMPORT_TEXT_LENGTH)),
    });
  });

export const bulkCreateVocabularyTermsSchema = z.object({
  vocabulary_set_id: z.string().uuid(),
  terms: z.array(vocabularyImportWordSchema).min(1).max(150),
});

export const bulkCreateVocabularyTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkCreateVocabularyTermsSchema.parse(input))
  .handler(async ({ data, context }) => {
    let nextOrder = await getNextOrder(context.supabase, data.vocabulary_set_id);
    const rows = data.terms.map((t) => ({
      vocabulary_set_id: data.vocabulary_set_id,
      term: t.term,
      definition: t.definition,
      example: t.example ?? null,
      order: nextOrder++,
    }));

    const { data: created, error } = await context.supabase
      .from("vocabulary_terms")
      .insert(rows)
      .select("id, term, definition, example, order");
    if (error) throw new Error(error.message);
    return created ?? [];
  });
