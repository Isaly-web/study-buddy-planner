# Migration checks

Every file in `supabase/migrations/` that is added to `main` needs a file with the
same name in this folder. The "Migration drift check" workflow runs it, read-only,
against the database after the merge and fails if it does not return `true`.

A check is one query that returns one boolean:

```sql
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name = 'forecast_alert_threshold'
);
```

Check the main thing the migration creates (a column, table, function or policy).
Keep it read-only. Setup: add the repository secret `SUPABASE_CHECK_DATABASE_URL`
(a connection string for a read-only database role).
