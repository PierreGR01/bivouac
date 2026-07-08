-- Étend les policies de add_rls_policies_custom_zones.sql pour le rôle "administrateur de zone" :
--   - la création reste ouverte à tout admin de zone (comme pour un super-admin) ;
--   - la modification/suppression d'une zone existante est réservée au super-admin
--     ou à l'admin explicitement assigné à CETTE zone (table zone_admins).
drop policy if exists "Admin insert custom zones" on public.custom_regulated_zones;
create policy "Admin insert custom zones"
  on public.custom_regulated_zones
  for insert
  with check (public.is_any_admin(auth.uid()));

drop policy if exists "Admin update custom zones" on public.custom_regulated_zones;
create policy "Admin update custom zones"
  on public.custom_regulated_zones
  for update
  using (public.is_zone_admin_of(auth.uid(), id));

drop policy if exists "Admin delete custom zones" on public.custom_regulated_zones;
create policy "Admin delete custom zones"
  on public.custom_regulated_zones
  for delete
  using (public.is_zone_admin_of(auth.uid(), id));

-- Auto-attribution : quand un admin de zone (pas un super-admin) crée une nouvelle zone,
-- il en devient automatiquement gestionnaire. security definer nécessaire car la policy
-- insert de zone_admins est réservée aux super-admins.
create or replace function public.grant_zone_admin_on_zone_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null and not public.is_super_admin(new.created_by) then
    insert into public.zone_admins (user_id, custom_zone_id, granted_by)
    values (new.created_by, new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grant_zone_admin_on_zone_create on public.custom_regulated_zones;
create trigger trg_grant_zone_admin_on_zone_create
  after insert on public.custom_regulated_zones
  for each row
  execute function public.grant_zone_admin_on_zone_create();
