-- Vocabulary/Glossary practice feature: one vocabulary set per topic, terms
-- within a set, and self-assessed practice attempts per term.

-- vocabulary_sets
CREATE TABLE study_buddy_planner.vocabulary_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL UNIQUE REFERENCES study_buddy_planner.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.vocabulary_sets TO authenticated;
GRANT ALL ON study_buddy_planner.vocabulary_sets TO service_role;
ALTER TABLE study_buddy_planner.vocabulary_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vocabulary sets" ON study_buddy_planner.vocabulary_sets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX vocabulary_sets_user_id_idx ON study_buddy_planner.vocabulary_sets(user_id);

-- vocabulary_terms
CREATE TABLE study_buddy_planner.vocabulary_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vocabulary_set_id UUID NOT NULL REFERENCES study_buddy_planner.vocabulary_sets(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  "order" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.vocabulary_terms TO authenticated;
GRANT ALL ON study_buddy_planner.vocabulary_terms TO service_role;
ALTER TABLE study_buddy_planner.vocabulary_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vocabulary terms" ON study_buddy_planner.vocabulary_terms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM study_buddy_planner.vocabulary_sets s WHERE s.id = vocabulary_set_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM study_buddy_planner.vocabulary_sets s WHERE s.id = vocabulary_set_id AND s.user_id = auth.uid()));
CREATE INDEX vocabulary_terms_set_id_idx ON study_buddy_planner.vocabulary_terms(vocabulary_set_id);

-- vocabulary_attempts: one row per self-assessed answer, append-only
-- (no UPDATE/DELETE grants — attempts are never edited or removed by clients)
CREATE TABLE study_buddy_planner.vocabulary_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES study_buddy_planner.vocabulary_terms(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON study_buddy_planner.vocabulary_attempts TO authenticated;
GRANT ALL ON study_buddy_planner.vocabulary_attempts TO service_role;
ALTER TABLE study_buddy_planner.vocabulary_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vocabulary attempts select" ON study_buddy_planner.vocabulary_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own vocabulary attempts insert" ON study_buddy_planner.vocabulary_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX vocabulary_attempts_user_created_idx ON study_buddy_planner.vocabulary_attempts(user_id, created_at DESC);
CREATE INDEX vocabulary_attempts_term_id_idx ON study_buddy_planner.vocabulary_attempts(term_id);
