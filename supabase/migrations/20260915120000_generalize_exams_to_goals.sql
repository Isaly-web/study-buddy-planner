-- Phase 1 of the unified study-goal model.
--
-- Generalizes `exams` so it can represent any study goal (exam, assignment,
-- vocabulary, other) while keeping all existing exam behavior working.
-- `topics` and `tasks` (the study-session entity) now point at `goal_id`
-- instead of `exam_id`. Vocabulary sets are decoupled from a required exam
-- topic so a deck can exist standalone.
--
-- This migration only changes the schema; no new goal types are created or
-- surfaced in the app yet.

-- 1. Generalize exams into goal_type-aware records --------------------------

ALTER TABLE study_buddy_planner.exams
  ADD COLUMN goal_type TEXT;

UPDATE study_buddy_planner.exams SET goal_type = 'exam' WHERE goal_type IS NULL;

ALTER TABLE study_buddy_planner.exams
  ALTER COLUMN goal_type SET DEFAULT 'exam',
  ALTER COLUMN goal_type SET NOT NULL,
  ADD CONSTRAINT exams_goal_type_check
    CHECK (goal_type IN ('exam', 'assignment', 'vocabulary', 'other'));

-- exam_date -> due_date, and no longer required (not every goal has a
-- deadline). Existing exam rows keep their date; the application still
-- requires a date when creating a goal_type = 'exam' record.
ALTER TABLE study_buddy_planner.exams RENAME COLUMN exam_date TO due_date;
ALTER TABLE study_buddy_planner.exams ALTER COLUMN due_date DROP NOT NULL;

-- 2. Generalize topic relationships ------------------------------------------

ALTER TABLE study_buddy_planner.topics RENAME COLUMN exam_id TO goal_id;
ALTER TABLE study_buddy_planner.topics RENAME CONSTRAINT topics_exam_id_fkey TO topics_goal_id_fkey;
ALTER INDEX study_buddy_planner.topics_exam_id_idx RENAME TO topics_goal_id_idx;

-- 3. Generalize task (study-session) relationships ---------------------------

ALTER TABLE study_buddy_planner.tasks RENAME COLUMN exam_id TO goal_id;
ALTER TABLE study_buddy_planner.tasks RENAME CONSTRAINT tasks_exam_id_fkey TO tasks_goal_id_fkey;
ALTER INDEX study_buddy_planner.tasks_exam_id_idx RENAME TO tasks_goal_id_idx;

-- 4. Decouple vocabulary sets from a required exam topic ---------------------

-- Drop NOT NULL only. The existing UNIQUE constraint on topic_id is kept:
-- in Postgres a UNIQUE constraint on a nullable column still enforces "at
-- most one vocabulary set per topic" for linked sets, while allowing any
-- number of standalone sets (topic_id IS NULL).
ALTER TABLE study_buddy_planner.vocabulary_sets ALTER COLUMN topic_id DROP NOT NULL;
ALTER TABLE study_buddy_planner.vocabulary_sets ADD COLUMN subject TEXT;

-- Backfill subject from the owning goal for existing exam-linked sets so
-- reporting/UI has something to show; new standalone sets set it directly.
UPDATE study_buddy_planner.vocabulary_sets vs
SET subject = e.subject
FROM study_buddy_planner.topics t
JOIN study_buddy_planner.exams e ON e.id = t.goal_id
WHERE t.id = vs.topic_id AND vs.subject IS NULL;

-- 5. RLS: repoint ownership-chain policies at goal_id ------------------------
--
-- Postgres already keeps policy expressions correct across the column
-- renames above (they're stored by attribute number, not name). These are
-- recreated explicitly anyway, spelled out with goal_id, so the ownership
-- chain is unambiguous to anyone reading the policy definitions later.

DROP POLICY "own topics" ON study_buddy_planner.topics;
CREATE POLICY "own topics" ON study_buddy_planner.topics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = goal_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = goal_id AND e.user_id = auth.uid()));

DROP POLICY "own tasks" ON study_buddy_planner.tasks;
CREATE POLICY "own tasks" ON study_buddy_planner.tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = goal_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM study_buddy_planner.exams e WHERE e.id = goal_id AND e.user_id = auth.uid()));

-- vocabulary_sets / vocabulary_terms policies already key off
-- vocabulary_sets.user_id directly (not the topic/exam chain) and need no
-- change: they remain secure whether topic_id is null or not.
