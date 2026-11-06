-- Isaly App Foundation: "Radera mina uppgifter" that never touches the shared auth user.
--
-- auth.users is shared by every Isaly app. Deleting the auth user would cascade into the other
-- apps' data, so this function deletes ONLY Studieplan's own rows for the caller, in one
-- transaction. The shared login is removed by a separate central process (not defined yet).
-- Idempotent: running it again finds nothing to delete.
--
-- Files in Storage are NOT deleted here (deleting storage.objects rows in SQL leaves the files in
-- the object store). The client removes the user's feedback screenshots in the private bucket
-- `feedback-screenshots` first (src/lib/account.ts), then calls this function.
--
-- Deleting a goal (exams) also ends its public share link (exams.share_token).
-- Keep the table list in sync with every table in study_buddy_planner that references auth.users
-- or has a user_id column (src/lib/account.test.ts fails otherwise).
-- Rollback: docs/delete-account-app-data-rollback.sql.
BEGIN;

CREATE OR REPLACE FUNCTION study_buddy_planner.delete_account_app_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = study_buddy_planner, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM study_buddy_planner.vocabulary_attempts WHERE user_id = v_uid;
  DELETE FROM study_buddy_planner.exercise_attempts WHERE user_id = v_uid;
  -- Terms go with their set (ON DELETE CASCADE).
  DELETE FROM study_buddy_planner.vocabulary_sets WHERE user_id = v_uid;
  -- Topics and tasks go with their goal (ON DELETE CASCADE).
  DELETE FROM study_buddy_planner.exams WHERE user_id = v_uid;
  DELETE FROM study_buddy_planner.profiles WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION study_buddy_planner.delete_account_app_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION study_buddy_planner.delete_account_app_data() TO authenticated;

COMMIT;
