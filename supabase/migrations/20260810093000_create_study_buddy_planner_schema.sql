-- Study Buddy Planner schema in the shared isaly-apps-prod Supabase project.
-- Consolidates the four migrations from the original Lovable project
-- (public schema, dedicated project) into one schema-qualified migration,
-- following the pattern established by calorie_tracker.

CREATE SCHEMA IF NOT EXISTS study_buddy_planner;
GRANT USAGE ON SCHEMA study_buddy_planner TO authenticated;
GRANT USAGE ON SCHEMA study_buddy_planner TO service_role;

-- profiles
CREATE TABLE study_buddy_planner.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.profiles TO authenticated;
GRANT ALL ON study_buddy_planner.profiles TO service_role;
ALTER TABLE study_buddy_planner.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON study_buddy_planner.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile upsert" ON study_buddy_planner.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON study_buddy_planner.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- exams
CREATE TABLE study_buddy_planner.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  grade TEXT,
  description TEXT,
  exam_date DATE NOT NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.exams TO authenticated;
GRANT ALL ON study_buddy_planner.exams TO service_role;
ALTER TABLE study_buddy_planner.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exams" ON study_buddy_planner.exams FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX exams_user_id_idx ON study_buddy_planner.exams(user_id);

-- topics
CREATE TABLE study_buddy_planner.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES study_buddy_planner.exams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.topics TO authenticated;
GRANT ALL ON study_buddy_planner.topics TO service_role;
ALTER TABLE study_buddy_planner.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topics" ON study_buddy_planner.topics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = exam_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = exam_id AND e.user_id = auth.uid()));
CREATE INDEX topics_exam_id_idx ON study_buddy_planner.topics(exam_id);

-- tasks
CREATE TABLE study_buddy_planner.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES study_buddy_planner.exams(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES study_buddy_planner.topics(id) ON DELETE SET NULL,
  day_date DATE NOT NULL,
  title TEXT NOT NULL,
  estimated_minutes INT NOT NULL DEFAULT 20,
  "order" INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.tasks TO authenticated;
GRANT ALL ON study_buddy_planner.tasks TO service_role;
ALTER TABLE study_buddy_planner.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON study_buddy_planner.tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = exam_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = exam_id AND e.user_id = auth.uid()));
CREATE INDEX tasks_exam_id_idx ON study_buddy_planner.tasks(exam_id);
CREATE INDEX tasks_day_date_idx ON study_buddy_planner.tasks(day_date);

-- exercise_attempts
CREATE TABLE study_buddy_planner.exercise_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES study_buddy_planner.tasks(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('E','C','A')),
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  answer text NOT NULL,
  feedback jsonb,
  attempts_used integer NOT NULL DEFAULT 1,
  used_help jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON study_buddy_planner.exercise_attempts TO authenticated;
GRANT ALL ON study_buddy_planner.exercise_attempts TO service_role;
ALTER TABLE study_buddy_planner.exercise_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON study_buddy_planner.exercise_attempts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX exercise_attempts_user_created_idx ON study_buddy_planner.exercise_attempts (user_id, created_at DESC);
CREATE INDEX exercise_attempts_task_idx ON study_buddy_planner.exercise_attempts (task_id);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION study_buddy_planner.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'study_buddy_planner', 'public'
AS $$
BEGIN
  INSERT INTO study_buddy_planner.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION study_buddy_planner.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_study_buddy_planner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION study_buddy_planner.handle_new_user();
