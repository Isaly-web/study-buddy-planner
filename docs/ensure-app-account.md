# ensure_app_account — the profile is created by the app, not by a trigger

Isaly App Foundation: `auth.users` is shared by every Isaly app, so no app may keep a trigger on it.
Study Buddy Planner used to create the profile with `on_auth_user_created_study_buddy_planner`
(`study_buddy_planner.handle_new_user()`), which ran on **every signup in every Isaly app**.

| Piece                                                    | Where                                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Function that creates the profile                        | `supabase/migrations/20261103120000_ensure_app_account.sql`                                                                      |
| Migration that drops the trigger and `handle_new_user()` | `supabase/migrations/20261103130000_drop_auth_users_signup_trigger.sql`                                                          |
| Client call (once per page load and user)                | `src/lib/ensure-app-account.ts`, called from `src/routes/_authenticated/route.tsx`, reset on sign-out in `src/routes/__root.tsx` |
| Rollbacks                                                | `docs/ensure-app-account-rollback.sql`, `docs/drop-auth-trigger-rollback.sql`                                                    |
| Read-only checks (drift check)                           | `supabase/checks/` (same file names as the migrations)                                                                           |

## Behaviour

- `study_buddy_planner.ensure_app_account()` acts only on `auth.uid()`, reads but never writes
  `auth.users`, and inserts a `profiles` row if none exists (`on conflict do nothing`). It is
  idempotent. `anon` has no EXECUTE; `authenticated` does.
- Same result as the old trigger (`display_name` from the signup metadata, else the part of the e-mail
  before the `@`), but it also covers a person who created their
  login in another Isaly app or who deleted their data here and signs in again.
- The client never throws on failure: the error is logged and the next navigation retries.
  Nothing in the app reads `study_buddy_planner.profiles` today, so a missing row breaks no page.
- Consequence of dropping the trigger: registering creates no `study_buddy_planner` rows until the first
  authenticated page load. Existing users keep their profiles; no backfill is needed (the trigger ran
  for every signup in every app, so everyone who signed up before already has a row).

## Rollout

Both migrations are applied by hand to `isaly-apps-prod` (this repository's history is not in the
shared project, so not `supabase db push`). **Applying anything to the shared production database
needs the project owner's approval.**

1. Apply `20261103120000_ensure_app_account.sql`, then check
   `supabase/checks/20261103120000_ensure_app_account.sql` returns `true`.
2. Apply `20261103130000_drop_auth_users_signup_trigger.sql`, then check its check file returns `true`.
   It only drops triggers that run `study_buddy_planner.handle_new_user()`; other apps' triggers (for
   example Calorie Tracker's) are never touched.
3. Merge and deploy. Steps 1 and 2 are safe before the deploy: nothing in the app reads the profile
   yet. Applying them before the merge also keeps the "Migration drift check" workflow green.
4. Smoke test: sign up a new account (with a name), sign in, open the dashboard. Then sign out and
   in again as the same user. In the database, `study_buddy_planner.profiles` has a row for the
   user with the expected `display_name`.

## Rollback

Prefer a forward fix. If needed, in this order, as role `postgres`:

1. `docs/drop-auth-trigger-rollback.sql` restores `handle_new_user()` and the trigger on the shared
   table (fires for signups in every Isaly app again).
2. `docs/ensure-app-account-rollback.sql` drops `ensure_app_account()`. The client ignores the
   error, so the app keeps working. Deletes no data.

Tested against a local PostgreSQL 16 with the app's migrations applied: the function creates the
missing profile once and then reports `profile_created: false`; it rejects no JWT, an unknown user
and `anon`; the drop migration is idempotent and leaves other apps' triggers in place; both
rollbacks restore the previous behaviour.
