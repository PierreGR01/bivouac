-- Spots mis en favoris par un utilisateur. Le spot lui-même vit dans le kv_store (POI),
-- cette table ne fait que lier un user_id à un poi_id — RLS garantit que chacun ne voit/gère
-- que ses propres favoris.
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  poi_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, poi_id)
);

alter table public.favorites enable row level security;

drop policy if exists "Users manage own favorites" on public.favorites;
create policy "Users manage own favorites"
  on public.favorites
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
