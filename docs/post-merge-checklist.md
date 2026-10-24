# Post-merge checklist — Study Buddy Planner

Copy this into the PR (as a comment) or an issue after merging to `main`, fill it in, and tick
what applies. Write "N/A" for the rest. Never paste secret values — names only.

```markdown
## Post-merge: <PR title / link> — merged <date>

### 1. Deploy

- [ ] Production deploy for the merge commit finished successfully
- [ ] Build log has no new warnings that matter
- [ ] Open the production site and load the landing page and the sign-in page
- [ ] No new errors in the hosting runtime logs for the first ~15 minutes

### 2. Database and backend (only if the PR touched `supabase/`)

- [ ] Migration applied to the Supabase project **before** the deploy: <!-- file name or N/A -->
- [ ] Migration was checked against the shared `isaly-apps-prod` project — only this app's own
      schema/tables are touched, nothing on `auth.users`
- [ ] New tables have RLS enabled with policies matching who may read and write
- [ ] Edge functions deployed and responding: <!-- names or N/A -->
- [ ] Rollback steps noted: <!-- file/steps or N/A -->

### 3. Config and secrets (names only)

- [ ] Env vars / secrets added or changed: <!-- names or None -->
- [ ] Redeployed after env var changes (they only apply to new deployments)
- [ ] `.env.example` / README matches
- [ ] Cron, DNS, Vault or auth-redirect changes done: <!-- or None -->

### 4. Smoke test in production

- [ ] Sign in (email/password; Google OAuth if auth changed) and sign out
- [ ] The feature from this PR works as described, plus one edge case
- [ ] A neighbouring feature still works (the one most likely to break)
- [ ] Works on a phone-sized screen
- [ ] Swedish copy looks right; no raw i18n keys or placeholder text
- [ ] Feedback button still works

### 5. Area-specific checks (tick what the PR touched)

**Planner and goals**

- [ ] Existing goals/exams, study sessions and the calendar view load and are correct
- [ ] Vocabulary lists and practice still work for an existing account

**Data**

- [ ] Migrations did not drop or rewrite existing user data unexpectedly

### 6. Dependencies (only if lockfiles changed)

- [ ] Every lockfile in the repo was updated and matches `package.json`
- [ ] The production build resolved the intended versions

### 7. Cleanup and follow-up

- [ ] Delete the merged branch (remote and local)
- [ ] Update README / docs / agent instructions if workflows, env vars or architecture changed
- [ ] Open issues for deferred work and link them here: <!-- or None -->
- [ ] Linked issue closed

### Rollback (if something is wrong)

1. Hosting: roll back to the previous good deployment (fast, no code change)
2. Then `git revert <merge commit>` via a new PR
3. Run the rollback migration if the PR changed the schema and it is safe to do so
4. Note what happened here: <!-- or N/A -->
```

## Local sanity check on `main` (optional)

```bash
git checkout main && git pull
# install with the repo's package manager, then run the scripts in package.json:
# lint, typecheck (if present), test, build
```
