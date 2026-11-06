-- ROLLBACK for 20261105120000_delete_account_app_data.sql. Run as role postgres.
-- Drops study_buddy_planner.delete_account_app_data(). Deletes no data.
-- Only drop it when no deployed build calls it (the account page would then fail to delete).
BEGIN;
DROP FUNCTION IF EXISTS study_buddy_planner.delete_account_app_data();
COMMIT;
