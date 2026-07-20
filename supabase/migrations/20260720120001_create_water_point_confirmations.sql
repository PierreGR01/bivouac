-- Confirmations terrain des points d'eau OSM (données théoriques, jamais vérifiées).
-- Chaque ligne est une confirmation individuelle (historique complet, pas d'update/delete) —
-- water_point_osm_id référence l'id stable produit côté client ("osm-${type}-${id}",
-- voir overpass.ts), il n'existe pas de table locale de points d'eau à laquelle la lier.
create table if not exists public.water_point_confirmations (
  id uuid primary key default gen_random_uuid(),
  water_point_osm_id text not null,
  is_valid boolean not null,
  confirmed_on date not null,
  confirmed_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists water_point_confirmations_osm_id_idx
  on public.water_point_confirmations (water_point_osm_id);

alter table public.water_point_confirmations enable row level security;

drop policy if exists "Anyone can read water point confirmations" on public.water_point_confirmations;
create policy "Anyone can read water point confirmations"
  on public.water_point_confirmations
  for select
  using (true);

drop policy if exists "Users insert own water point confirmations" on public.water_point_confirmations;
create policy "Users insert own water point confirmations"
  on public.water_point_confirmations
  for insert
  with check (confirmed_by = auth.uid());
