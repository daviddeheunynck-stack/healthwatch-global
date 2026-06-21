-- Enable Supabase Realtime on outbreak_notes so team members receive
-- each other's annotations in real time without polling.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'outbreak_notes'
  ) then
    alter publication supabase_realtime add table public.outbreak_notes;
  end if;
end;
$$;
