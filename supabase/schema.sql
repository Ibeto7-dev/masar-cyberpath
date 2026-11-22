create table public.masar_accounts (
  owner_key text primary key, revision integer not null check (revision > 0), payload jsonb not null
);
alter table public.masar_accounts enable row level security;
revoke all on public.masar_accounts from public, anon, authenticated;
grant select, insert, update on public.masar_accounts to authenticated, service_role;
create policy masar_owner_read on public.masar_accounts for select to authenticated using (owner_key=(select auth.uid())::text);
create policy masar_owner_create on public.masar_accounts for insert to authenticated with check (owner_key=(select auth.uid())::text and revision=1);
create policy masar_owner_edit on public.masar_accounts for update to authenticated using (owner_key=(select auth.uid())::text) with check (owner_key=(select auth.uid())::text);
