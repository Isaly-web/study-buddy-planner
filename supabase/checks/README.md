# Migration checks

Every file in `supabase/migrations/` that is added to `main` needs a file with the
same name in this folder. The "Migration drift check" workflow runs it, read-only,
against the database after the merge and fails if it does not return `true`.

A check is one query that returns one boolean:

```sql
select exists (
  select 1
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'profiles'
    and a.attname = 'forecast_alert_threshold'
    and a.attnum > 0 and not a.attisdropped
);
```

Use `pg_catalog` (`pg_class`, `pg_attribute`, `pg_proc`, `pg_policy`, ...) and not
`information_schema`: the latter only shows objects the role has privileges on, so a
role without grants would see nothing and every check would return false.

Check the main thing the migration creates (a column, table, function or policy).
Keep it read-only. Setup: add the repository secret `SUPABASE_CHECK_DATABASE_URL`
(a connection string for a read-only database role).
