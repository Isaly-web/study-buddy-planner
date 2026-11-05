# Retention of uploaded files (backlog B3)

The only uploads are feedback screenshots (bucket `feedback-screenshots`). They are sent once to the
Feedback Hub as a signed URL valid for one year, so files older than 12 months are deleted
(age-based per file, not inactivity-based; the bucket name is shared by other Isaly apps, and the
same rule is safe for all of them). **The period must be confirmed by a lawyer** — it is a `<Todo>`
on `/privacy`.

- `POST /api/public/hooks/purge-feedback-screenshots`, `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
  Body `{"dryRun": true}` only reports counts. Handles up to 200 user folders per run.
- **Not scheduled.** Run a dry run, then schedule weekly with pg_cron + Vault.
