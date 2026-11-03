select not exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace pn on pn.oid = p.pronamespace
  where cn.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
    and pn.nspname = 'study_buddy_planner' and p.proname = 'handle_new_user'
) and not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'study_buddy_planner' and p.proname = 'handle_new_user'
);
