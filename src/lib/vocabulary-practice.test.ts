import { describe, expect, it } from "vitest";
import {
  answerCurrent,
  buildIncorrectOnlySession,
  currentPosition,
  isSessionComplete,
  startSession,
  type VocabTermLike,
} from "./vocabulary-practice";

const terms: VocabTermLike[] = [
  { id: "1", term: "Photosynthesis", definition: "Plants making food from light" },
  { id: "2", term: "Mitosis", definition: "Cell division" },
  { id: "3", term: "Osmosis", definition: "Movement of water across a membrane" },
];

describe("startSession", () => {
  it("sets current to the first term and queue to the rest, with counts at 0", () => {
    const session = startSession(terms);
    expect(session.current).toEqual(terms[0]);
    expect(session.queue).toEqual(terms.slice(1));
    expect(session.correctCount).toBe(0);
    expect(session.incorrectCount).toBe(0);
    expect(session.incorrectIds).toEqual([]);
    expect(session.totalInPass).toBe(3);
  });

  it("handles zero terms without throwing", () => {
    const session = startSession([]);
    expect(session.current).toBeNull();
    expect(isSessionComplete(session)).toBe(true);
  });
});

describe("answerCurrent", () => {
  it("advances current, increments correctCount, and leaves incorrectIds unchanged on a right answer", () => {
    const session = startSession(terms);
    const next = answerCurrent(session, true);
    expect(next.current).toEqual(terms[1]);
    expect(next.correctCount).toBe(1);
    expect(next.incorrectCount).toBe(0);
    expect(next.incorrectIds).toEqual([]);
  });

  it("advances current, increments incorrectCount, and records the id on a wrong answer", () => {
    const session = startSession(terms);
    const next = answerCurrent(session, false);
    expect(next.current).toEqual(terms[1]);
    expect(next.correctCount).toBe(0);
    expect(next.incorrectCount).toBe(1);
    expect(next.incorrectIds).toEqual(["1"]);
  });

  it("is a no-op when there is no current term", () => {
    const session = startSession([]);
    expect(answerCurrent(session, true)).toEqual(session);
  });
});

describe("isSessionComplete", () => {
  it("becomes true after answering every term in a small session", () => {
    let session = startSession(terms.slice(0, 2));
    expect(isSessionComplete(session)).toBe(false);
    session = answerCurrent(session, true);
    expect(isSessionComplete(session)).toBe(false);
    session = answerCurrent(session, false);
    expect(isSessionComplete(session)).toBe(true);
  });
});

describe("currentPosition", () => {
  it("reports 1-based position and caps at totalInPass once complete", () => {
    let session = startSession(terms);
    expect(currentPosition(session)).toBe(1);
    session = answerCurrent(session, true);
    expect(currentPosition(session)).toBe(2);
    session = answerCurrent(session, true);
    expect(currentPosition(session)).toBe(3);
    session = answerCurrent(session, true);
    expect(currentPosition(session)).toBe(3);
  });
});

describe("buildIncorrectOnlySession", () => {
  it("only includes terms whose ids were marked incorrect, in original order, with counts reset", () => {
    let session = startSession(terms);
    session = answerCurrent(session, false); // term 1 wrong
    session = answerCurrent(session, true); // term 2 right
    session = answerCurrent(session, false); // term 3 wrong
    expect(isSessionComplete(session)).toBe(true);

    const retry = buildIncorrectOnlySession(session, terms);
    expect(retry.current).toEqual(terms[0]);
    expect(retry.queue).toEqual([terms[2]]);
    expect(retry.totalInPass).toBe(2);
    expect(retry.correctCount).toBe(0);
    expect(retry.incorrectCount).toBe(0);
    expect(retry.incorrectIds).toEqual([]);
  });
});
