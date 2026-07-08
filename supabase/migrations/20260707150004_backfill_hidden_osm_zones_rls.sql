-- Documente rétroactivement hidden_osm_zones (créée à la main, jamais trackée) et étend
-- le masquage de zones OSM à tout admin de zone (pas seulement le super-admin) : masquer
-- une zone OSM va toujours de pair avec la création d'une zone custom de remplacement,
-- déjà ouverte à tout admin de zone — donc même niveau de confiance ici.
create table if not exists public.hidden_osm_zones (
  id uuid primary key default gen_random_uuid(),
  osm_id text not null unique,
  osm_name text,
  hidden_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.hidden_osm_zones enable row level security;

drop policy if exists "Public read hidden osm zones" on public.hidden_osm_zones;
create policy "Public read hidden osm zones"
  on public.hidden_osm_zones
  for select
  using (true);

drop policy if exists "Admins insert hidden osm zones" on public.hidden_osm_zones;
create policy "Admins insert hidden osm zones"
  on public.hidden_osm_zones
  for insert
  with check (public.is_any_admin(auth.uid()));
