import { describe, expect, it } from "vitest";
import {
  createVocabularyTermSchema,
  recordVocabularyAttemptSchema,
  updateVocabularyTermSchema,
  vocabularyImportWordSchema,
  vocabularyImportResultSchema,
  extractVocabularyFromTextSchema,
  extractVocabularyFromImageSchema,
  bulkCreateVocabularyTermsSchema,
} from "./vocabulary.functions";

describe("createVocabularyTermSchema", () => {
  const valid = {
    vocabulary_set_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    term: "Photosynthesis",
    definition: "Plants making food from light",
  };

  it("accepts a valid input with no example", () => {
    expect(() => createVocabularyTermSchema.parse(valid)).not.toThrow();
  });

  it("accepts a null example", () => {
    expect(() => createVocabularyTermSchema.parse({ ...valid, example: null })).not.toThrow();
  });

  it("rejects an empty term", () => {
    expect(() => createVocabularyTermSchema.parse({ ...valid, term: "" })).toThrow();
  });

  it("rejects an empty definition", () => {
    expect(() => createVocabularyTermSchema.parse({ ...valid, definition: "" })).toThrow();
  });

  it("rejects a non-uuid vocabulary_set_id", () => {
    expect(() =>
      createVocabularyTermSchema.parse({ ...valid, vocabulary_set_id: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("updateVocabularyTermSchema", () => {
  it("accepts an update with only id present", () => {
    expect(() =>
      updateVocabularyTermSchema.parse({ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }),
    ).not.toThrow();
  });

  it("rejects a missing id", () => {
    expect(() => updateVocabularyTermSchema.parse({ term: "Osmosis" })).toThrow();
  });
});

describe("recordVocabularyAttemptSchema", () => {
  it("requires a uuid term_id and boolean is_correct", () => {
    expect(() =>
      recordVocabularyAttemptSchema.parse({
        term_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        is_correct: true,
      }),
    ).not.toThrow();
  });

  it("rejects a non-boolean is_correct", () => {
    expect(() =>
      recordVocabularyAttemptSchema.parse({
        term_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        is_correct: "yes",
      }),
    ).toThrow();
  });

  it("rejects a non-uuid term_id", () => {
    expect(() =>
      recordVocabularyAttemptSchema.parse({ term_id: "not-a-uuid", is_correct: true }),
    ).toThrow();
  });
});

describe("vocabularyImportWordSchema / vocabularyImportResultSchema", () => {
  it("accepts a valid word list", () => {
    expect(() =>
      vocabularyImportResultSchema.parse({
        words: [
          { term: "cat", definition: "katt" },
          { term: "dog", definition: "hund", example: "The dog barks" },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects more than 150 words", () => {
    const words = Array.from({ length: 151 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` }));
    expect(() => vocabularyImportResultSchema.parse({ words })).toThrow();
  });

  it("rejects an empty term or definition", () => {
    expect(() => vocabularyImportWordSchema.parse({ term: "", definition: "katt" })).toThrow();
    expect(() => vocabularyImportWordSchema.parse({ term: "cat", definition: "" })).toThrow();
  });

  it("accepts a missing or nullable example", () => {
    expect(() =>
      vocabularyImportWordSchema.parse({ term: "cat", definition: "katt" }),
    ).not.toThrow();
    expect(() =>
      vocabularyImportWordSchema.parse({ term: "cat", definition: "katt", example: null }),
    ).not.toThrow();
  });
});

describe("extractVocabularyFromTextSchema", () => {
  it("rejects empty text", () => {
    expect(() => extractVocabularyFromTextSchema.parse({ text: "" })).toThrow();
  });

  it("rejects text over 20,000 characters", () => {
    expect(() => extractVocabularyFromTextSchema.parse({ text: "a".repeat(20001) })).toThrow();
  });

  it("accepts reasonable pasted text", () => {
    expect(() => extractVocabularyFromTextSchema.parse({ text: "cat - katt" })).not.toThrow();
  });
});

describe("extractVocabularyFromImageSchema", () => {
  const valid = { image_data_url: "data:image/png;base64,AAAA", mime_type: "image/png" as const };

  it("accepts a valid image payload", () => {
    expect(() => extractVocabularyFromImageSchema.parse(valid)).not.toThrow();
  });

  it("rejects an unknown mime_type", () => {
    expect(() =>
      extractVocabularyFromImageSchema.parse({ ...valid, mime_type: "image/gif" }),
    ).toThrow();
  });

  it("rejects an oversized image_data_url", () => {
    expect(() =>
      extractVocabularyFromImageSchema.parse({ ...valid, image_data_url: "a".repeat(4_400_001) }),
    ).toThrow();
  });
});

describe("bulkCreateVocabularyTermsSchema", () => {
  const setId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  it("accepts a valid batch", () => {
    expect(() =>
      bulkCreateVocabularyTermsSchema.parse({
        vocabulary_set_id: setId,
        terms: [{ term: "cat", definition: "katt" }],
      }),
    ).not.toThrow();
  });

  it("rejects an empty terms array", () => {
    expect(() =>
      bulkCreateVocabularyTermsSchema.parse({ vocabulary_set_id: setId, terms: [] }),
    ).toThrow();
  });

  it("rejects more than 150 terms", () => {
    const terms = Array.from({ length: 151 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` }));
    expect(() =>
      bulkCreateVocabularyTermsSchema.parse({ vocabulary_set_id: setId, terms }),
    ).toThrow();
  });

  it("rejects a non-uuid vocabulary_set_id", () => {
    expect(() =>
      bulkCreateVocabularyTermsSchema.parse({
        vocabulary_set_id: "not-a-uuid",
        terms: [{ term: "cat", definition: "katt" }],
      }),
    ).toThrow();
  });
});
