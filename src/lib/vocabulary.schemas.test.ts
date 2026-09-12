import { describe, expect, it } from "vitest";
import {
  createVocabularyTermSchema,
  recordVocabularyAttemptSchema,
  updateVocabularyTermSchema,
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
