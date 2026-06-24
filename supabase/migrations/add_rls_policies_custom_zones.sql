-- Activer RLS si pas encore fait
alter table public.custom_regulated_zones enable row level security;

-- Supprimer les policies existantes pour éviter les conflits
drop policy if exists "Public read custom zones" on public.custom_regulated_zones;
drop policy if exists "Admin insert custom zones" on public.custom_regulated_zones;
drop policy if exists "Admin update custom zones" on public.custom_regulated_zones;
drop policy if exists "Admin delete custom zones" on public.custom_regulated_zones;

-- Lecture publique (tout le monde peut voir les zones)
create policy "Public read custom zones"
  on public.custom_regulated_zones
  for select
  using (true);

-- Les admins peuvent insérer
create policy "Admin insert custom zones"
  on public.custom_regulated_zones
  for insert
  with check (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Les admins peuvent mettre à jour
create policy "Admin update custom zones"
  on public.custom_regulated_zones
  for update
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Les admins peuvent supprimer
create policy "Admin delete custom zones"
  on public.custom_regulated_zones
  for delete
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );
