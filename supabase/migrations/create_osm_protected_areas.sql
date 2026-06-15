-- Table de stockage des zones protégées OSM (import quotidien via sync-osm-zones)
create table if not exists public.osm_protected_areas (
  osm_id        text primary key,          -- e.g. "relation-12345"
  name          text,
  area_type     text not null,             -- national_park, nature_reserve, etc.
  protection_level text not null,          -- strict | moderate | low
  tags          jsonb not null default '{}',
  geometry      jsonb not null,            -- [{lat, lng}, ...]
  synced_at     timestamptz not null default now()
);

-- Index pour accélérer les requêtes de validation
create index if not exists osm_protected_areas_protection_level_idx
  on public.osm_protected_areas (protection_level);

-- Lecture publique (validation côté serveur via service_role de toute façon)
alter table public.osm_protected_areas enable row level security;

create policy "Public read" on public.osm_protected_areas
  for select using (true);
