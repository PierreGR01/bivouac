-- Table dédiée aux spots de bivouac (remplace progressivement le stockage dans
-- kv_store_e51cba93, qui n'a ni colonnes typées ni index géographique).
--
-- Colonnes utiles au filtrage/liste en top-level ; tout le reste (description,
-- regulations, photos, reviews, ratings, zoneGeometry) reste dans `detail` jsonb
-- pour ne pas alourdir la requête de liste légère.
create table if not exists public.spots (
  id text primary key,
  lat double precision not null,
  lng double precision not null,
  title text not null,
  season text not null,
  is_public boolean not null default true,
  disabled_until timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  altitude numeric null,
  capacity text null,
  difficulty smallint null,
  water_proximity text null,
  natural_water_proximity text null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists spots_lat_lng_idx on public.spots (lat, lng);
create index if not exists spots_is_public_idx on public.spots (is_public);

-- RLS activée, AUCUNE policy : la table n'est accessible que via la service role
-- (utilisée exclusivement par l'Edge Function make-server-e51cba93, qui applique déjà
-- son propre filtrage de visibilité). Aucun accès direct anon/authenticated prévu —
-- cohérent avec le fait que le front ne fait jamais de `supabaseClient.from('spots')`
-- direct, tout passe par l'Edge Function.
alter table public.spots enable row level security;
