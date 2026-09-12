// Vercel's Node serverless function body limit is 4.5 MB. Base64 inflates
// size by exactly 4/3, so a 3 MiB file encodes to ~4.19 MB, leaving headroom
// for the data: URL prefix and surrounding JSON.
export const MAX_IMPORT_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_IMPORT_DATA_URL_LENGTH = 4_400_000;
export const MAX_IMPORT_TEXT_LENGTH = 20_000;
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_PDF_MIME_TYPE = "application/pdf" as const;

export type ImportCandidateTerm = {
  term: string;
  definition: string;
  example?: string | null;
};

export type DedupedImportCandidate = ImportCandidateTerm & { isDuplicate: boolean };

export function normalizeTermKey(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

// Flags a candidate as a duplicate if it matches an existing set term OR an
// earlier candidate in the same batch (so within-batch repeats are caught too).
export function flagDuplicateCandidates(
  candidates: ImportCandidateTerm[],
  existingTerms: { term: string }[],
): DedupedImportCandidate[] {
  const existingKeys = new Set(existingTerms.map((t) => normalizeTermKey(t.term)));
  const seenInBatch = new Set<string>();
  return candidates.map((c) => {
    const key = normalizeTermKey(c.term);
    const isDuplicate = existingKeys.has(key) || seenInBatch.has(key);
    seenInBatch.add(key);
    return { ...c, isDuplicate };
  });
}
