-- Table d'assignation "administrateur de zone" : un utilisateur peut administrer
-- une ou plusieurs zones custom précises (assignation explicite).
create table if not exists public.zone_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_zone_id uuid not null references public.custom_regulated_zones(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, custom_zone_id)
);

alter table public.zone_admins enable row level security;

-- Fonctions helper réutilisées par les policies RLS des autres tables (custom_regulated_zones, hidden_osm_zones).
create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.admin_users where user_id = uid);
$$;

create or replace function public.is_any_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select public.is_super_admin(uid) or exists (
    select 1 from public.zone_admins where user_id = uid
  );
$$;

create or replace function public.is_zone_admin_of(uid uuid, zid uuid)
returns boolean
language sql
stable
as $$
  select public.is_super_admin(uid) or exists (
    select 1 from public.zone_admins where user_id = uid and custom_zone_id = zid
  );
$$;

-- Un utilisateur peut voir ses propres attributions (pour peupler le contexte auth côté front) ;
-- un super-admin peut tout voir (pour l'UI de gestion des attributions).
drop policy if exists "Read own or all as super admin" on public.zone_admins;
create policy "Read own or all as super admin"
  on public.zone_admins
  for select
  using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- Seul un super-admin gère les attributions manuellement (le trigger d'auto-attribution
-- sur custom_regulated_zones contourne cette policy via security definer).
drop policy if exists "Super admin manages grants insert" on public.zone_admins;
create policy "Super admin manages grants insert"
  on public.zone_admins
  for insert
  with check (public.is_super_admin(auth.uid()));

drop policy if exists "Super admin manages grants delete" on public.zone_admins;
create policy "Super admin manages grants delete"
  on public.zone_admins
  for delete
  using (public.is_super_admin(auth.uid()));
