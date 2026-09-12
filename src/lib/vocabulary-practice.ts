export type VocabTermLike = {
  id: string;
  term: string;
  definition: string;
  example?: string | null;
};

export type PracticeSession = {
  queue: VocabTermLike[];
  current: VocabTermLike | null;
  incorrectIds: string[];
  correctCount: number;
  incorrectCount: number;
  totalInPass: number;
};

export function startSession(terms: VocabTermLike[]): PracticeSession {
  const [current = null, ...queue] = terms;
  return {
    queue,
    current,
    incorrectIds: [],
    correctCount: 0,
    incorrectCount: 0,
    totalInPass: terms.length,
  };
}

export function answerCurrent(session: PracticeSession, wasCorrect: boolean): PracticeSession {
  if (!session.current) return session;
  const [next = null, ...rest] = session.queue;
  return {
    queue: rest,
    current: next,
    incorrectIds: wasCorrect ? session.incorrectIds : [...session.incorrectIds, session.current.id],
    correctCount: session.correctCount + (wasCorrect ? 1 : 0),
    incorrectCount: session.incorrectCount + (wasCorrect ? 0 : 1),
    totalInPass: session.totalInPass,
  };
}

export function isSessionComplete(session: PracticeSession): boolean {
  return session.current === null;
}

// Position of the term currently being answered, 1-based (e.g. 3 of 12).
// Once the pass is complete this equals totalInPass.
export function currentPosition(session: PracticeSession): number {
  return Math.min(session.correctCount + session.incorrectCount + 1, session.totalInPass);
}

export function buildIncorrectOnlySession(
  session: PracticeSession,
  allTerms: VocabTermLike[],
): PracticeSession {
  const incorrectSet = new Set(session.incorrectIds);
  const incorrectTerms = allTerms.filter((t) => incorrectSet.has(t.id));
  return startSession(incorrectTerms);
}
