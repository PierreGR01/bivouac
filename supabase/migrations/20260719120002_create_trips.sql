-- Itinéraires personnels : tracés dessinés sur la carte ou importés depuis un fichier
-- GPX/KML. `points` est un tableau JSON de {lat, lng} dans l'ordre du tracé.
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  points jsonb not null,
  source text not null default 'drawn' check (source in ('drawn', 'import')),
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;

drop policy if exists "Users manage own trips" on public.trips;
create policy "Users manage own trips"
  on public.trips
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
