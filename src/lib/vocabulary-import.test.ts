import { describe, expect, it } from "vitest";
import { flagDuplicateCandidates, normalizeTermKey } from "./vocabulary-import";

describe("normalizeTermKey", () => {
  it("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeTermKey("  Apple   Pie ")).toBe("apple pie");
  });

  it("is stable for already-normalized input", () => {
    expect(normalizeTermKey("cat")).toBe("cat");
  });
});

describe("flagDuplicateCandidates", () => {
  it("flags a candidate matching an existing term, case/whitespace-insensitively", () => {
    const result = flagDuplicateCandidates(
      [{ term: "  Cat ", definition: "a small animal" }],
      [{ term: "cat" }],
    );
    expect(result[0].isDuplicate).toBe(true);
  });

  it("does not flag a genuinely new term", () => {
    const result = flagDuplicateCandidates(
      [{ term: "Dog", definition: "a loyal animal" }],
      [{ term: "cat" }],
    );
    expect(result[0].isDuplicate).toBe(false);
  });

  it("flags the second occurrence of an intra-batch repeat but not the first", () => {
    const result = flagDuplicateCandidates(
      [
        { term: "Cat", definition: "a small animal" },
        { term: "cat", definition: "duplicate entry" },
      ],
      [],
    );
    expect(result[0].isDuplicate).toBe(false);
    expect(result[1].isDuplicate).toBe(true);
  });

  it("handles empty existingTerms and empty candidates without throwing", () => {
    expect(flagDuplicateCandidates([], [])).toEqual([]);
    expect(flagDuplicateCandidates([{ term: "Cat", definition: "x" }], [])).toHaveLength(1);
  });

  it("does not mutate its input arrays", () => {
    const candidates = [{ term: "Cat", definition: "a small animal" }];
    const existing = [{ term: "cat" }];
    flagDuplicateCandidates(candidates, existing);
    expect(candidates).toEqual([{ term: "Cat", definition: "a small animal" }]);
    expect(existing).toEqual([{ term: "cat" }]);
  });
});
