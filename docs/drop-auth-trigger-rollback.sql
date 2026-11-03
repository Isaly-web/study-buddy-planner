-- ROLLBACK for 20261103130000_drop_auth_users_signup_trigger.sql. Run as role postgres.
-- Recreates study_buddy_planner.handle_new_user() (same body as 20260810093000) and the trigger on
-- the SHARED auth.users table, which fires for signups in every Isaly app. Prefer a forward fix:
-- ensure_app_account() already covers signups.
BEGIN;
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

DROP TRIGGER IF EXISTS on_auth_user_created_study_buddy_planner ON auth.users;
CREATE TRIGGER on_auth_user_created_study_buddy_planner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION study_buddy_planner.handle_new_user();
COMMIT;
