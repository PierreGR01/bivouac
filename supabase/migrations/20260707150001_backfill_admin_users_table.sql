-- Documente rétroactivement la table admin_users (créée à la main, jamais trackée).
-- `create table if not exists` est un no-op si la table existe déjà avec ses propres policies.
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Un utilisateur doit pouvoir lire sa propre ligne pour que isUserAdmin() fonctionne.
drop policy if exists "Users read own admin row" on public.admin_users;
create policy "Users read own admin row"
  on public.admin_users
  for select
  using (user_id = auth.uid());
