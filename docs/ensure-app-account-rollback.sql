-- ROLLBACK for 20261103120000_ensure_app_account.sql. Run as role postgres.
-- Drops study_buddy_planner.ensure_app_account(). Deletes no data. The client ignores errors from
-- the call (src/lib/ensure-app-account.ts), so the app keeps working, but without the signup
-- trigger (see drop-auth-trigger-rollback.sql) nothing creates profiles. If you roll back both,
-- restore the trigger FIRST, then drop this function.
BEGIN;
DROP FUNCTION IF EXISTS study_buddy_planner.ensure_app_account();
COMMIT;
