-- Zones d'administration : territoires (ex. "Parc naturel de Chartreuse"), créés/importés
-- uniquement par un super-admin. Distinctes des zones réglementées (custom_regulated_zones) :
-- un territoire peut contenir plusieurs zones réglementées.
create table if not exists public.admin_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  geometry jsonb not null,
  source_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.admin_zones enable row level security;

drop policy if exists "Admins read admin zones" on public.admin_zones;
create policy "Admins read admin zones"
  on public.admin_zones
  for select
  using (public.is_any_admin(auth.uid()));

drop policy if exists "Super admin manages admin zones insert" on public.admin_zones;
create policy "Super admin manages admin zones insert"
  on public.admin_zones
  for insert
  with check (public.is_super_admin(auth.uid()));

drop policy if exists "Super admin manages admin zones update" on public.admin_zones;
create policy "Super admin manages admin zones update"
  on public.admin_zones
  for update
  using (public.is_super_admin(auth.uid()));

drop policy if exists "Super admin manages admin zones delete" on public.admin_zones;
create policy "Super admin manages admin zones delete"
  on public.admin_zones
  for delete
  using (public.is_super_admin(auth.uid()));
