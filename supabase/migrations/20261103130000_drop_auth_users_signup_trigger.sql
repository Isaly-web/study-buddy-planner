-- Isaly App Foundation: no app-specific trigger on auth.users.
--
-- auth.users is shared by all Isaly apps and the trigger on_auth_user_created_study_buddy_planner
-- (study_buddy_planner.handle_new_user()) ran on every signup in EVERY app. The profile is now
-- created by study_buddy_planner.ensure_app_account() on the first authenticated page load
-- (20261103120000_ensure_app_account.sql), which also covers accounts created in other apps.
--
-- Drops only triggers on auth.users that run study_buddy_planner.handle_new_user(), whatever they
-- are called, and never touches other apps' triggers. Idempotent.
-- Safe to apply before the app is deployed: nothing in the app reads study_buddy_planner.profiles
-- today (display_name is only sent as signup metadata).
-- Rollback: docs/drop-auth-trigger-rollback.sql.
BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE cn.nspname = 'auth' AND c.relname = 'users'
      AND NOT t.tgisinternal
      AND pn.nspname = 'study_buddy_planner' AND p.proname = 'handle_new_user'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON auth.users', r.tgname);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS study_buddy_planner.handle_new_user();

COMMIT;
