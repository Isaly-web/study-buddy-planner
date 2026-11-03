-- Isaly App Foundation: the profile is created by the app, not by a trigger on auth.users.
--
-- auth.users is shared by every Isaly app. A trigger there runs on every signup in every app,
-- so a bug in study_buddy_planner.handle_new_user() would stop registrations everywhere, and it
-- also creates rows for accounts that never use this app. Instead the app calls
-- study_buddy_planner.ensure_app_account() after sign-in (src/lib/ensure-app-account.ts, called
-- from src/routes/_authenticated/route.tsx). It covers new accounts and accounts created in
-- another Isaly app, and it is safe to call any number of times.
--
-- This migration only ADDS the function; the trigger is dropped by the next migration
-- (20261103130000_drop_auth_users_signup_trigger.sql), so there is no moment without a profile.
-- Behaviour is identical to handle_new_user(): a profiles row whose display_name is the
-- display_name given at signup, else the part of the e-mail before the @.
--
-- Acts only on auth.uid(). Reads auth.users (metadata and e-mail), never writes it.
-- Rollback: docs/ensure-app-account-rollback.sql.
BEGIN;

CREATE OR REPLACE FUNCTION study_buddy_planner.ensure_app_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = study_buddy_planner, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta jsonb;
  v_email text;
  v_rows integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT u.raw_user_meta_data, u.email INTO v_meta, v_email
  FROM auth.users u
  WHERE u.id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  INSERT INTO study_buddy_planner.profiles (id, display_name)
  VALUES (v_uid, COALESCE(v_meta->>'display_name', split_part(v_email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object('profile_created', v_rows > 0);
END;
$$;

REVOKE ALL ON FUNCTION study_buddy_planner.ensure_app_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION study_buddy_planner.ensure_app_account() TO authenticated;

COMMIT;
