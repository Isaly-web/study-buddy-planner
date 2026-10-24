## Summary

<!-- What changes and why, in 1–3 sentences. Link the issue or decision if there is one. -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / cleanup (no behaviour change)
- [ ] Database migration / schema change
- [ ] Docs / config / CI
- [ ] Dependency update

## Changes

<!-- Bullet the notable changes. Mention anything a reviewer should look at first. -->

-

## Testing

<!-- How was this verified? Paste the commands you ran and what you clicked through. -->

- [ ] Lint, formatting, typecheck and tests pass locally
- [ ] Tried in the browser (golden path and one edge case), or N/A because: <!-- reason -->
- [ ] Tests added or updated for new logic, or N/A because: <!-- reason -->

## Isaly App Foundation checklist

<!-- Tick what applies, write "N/A" for the rest. Delete a line only if it can never apply to this app. -->

**Shared account and data**

- [ ] Only this app's own schema and storage bucket are touched; no other app's tables
- [ ] Nothing deletes, disables or modifies the shared `auth.users` record, and no new triggers on `auth.users`
- [ ] New tables have RLS enabled with policies that match who may read and write
- [ ] Service-role access stays in server-only code (`*.server.ts` / server functions), never in client code

**Secrets and webhooks**

- [ ] No secrets, keys or personal data in code, logs, screenshots or this description
- [ ] Webhook/cron routes authenticate with a dedicated secret or the service-role key, never the publishable/anon key
- [ ] New environment variables are documented in `.env.example` and are not `VITE_`-prefixed unless they must reach the browser

**User-facing**

- [ ] Privacy page lists only subprocessors the code actually uses; no invented legal facts (`[TODO: …]` markers stay)
- [ ] Emails that can be unsubscribed from keep the unsubscribe link and `List-Unsubscribe` headers; suppressed addresses are never emailed
- [ ] Swedish copy checked; new strings follow the existing i18n approach in the file
- [ ] Works on a phone-sized screen and is keyboard accessible

**AI** (skip if no AI code changed)

- [ ] All AI requests go through the shared AI gateway/call helpers and respect the request budget
- [ ] Features degrade gracefully when AI is off, out of budget or failing; the core app never depends on it
- [ ] Prompts and logs contain no API keys or user content

## Deployment notes

<!-- Anything that must happen outside the code, in this order. Write "None" if nothing. -->

- [ ] Migration to apply before deploy: <!-- file name, or None -->
- [ ] Environment variables to add or change in Vercel: <!-- names only, never values -->
- [ ] Supabase / Vercel / DNS / cron changes: <!-- or None -->
- [ ] Rollback: <!-- how to undo, e.g. revert + rollback migration -->

## Screenshots

<!-- UI changes: before / after, desktop and mobile. Remove this section if there is no UI change. -->

## After merge

<!-- Don't tick these now. Copy the checklist from docs/post-merge-checklist.md into a comment on this PR once it is merged. -->

- [ ] Post-merge checklist completed: `docs/post-merge-checklist.md`
