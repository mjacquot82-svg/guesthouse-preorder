-- Enable Supabase Realtime broadcasts for order row changes.
-- The app subscribes to inserts and updates on public.orders, then refetches
-- full order details including line items and modifiers.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
