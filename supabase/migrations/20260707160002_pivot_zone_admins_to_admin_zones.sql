-- Corrige le modèle v1 : zone_admins pointait vers une zone réglementée précise
-- (custom_zone_id). Il doit pointer vers un territoire (admin_zones) : un admin de
-- zone administre un territoire, qui peut contenir plusieurs zones réglementées.
-- Aucune attribution réelle n'existe encore en prod — le delete ci-dessous ne fait
-- que nettoyer d'éventuelles lignes orphelines plutôt que d'imposer un NOT NULL strict.
alter table public.zone_admins drop column if exists custom_zone_id;
alter table public.zone_admins add column if not exists admin_zone_id uuid references public.admin_zones(id) on delete cascade;
delete from public.zone_admins where admin_zone_id is null;

alter table public.zone_admins drop constraint if exists zone_admins_user_id_admin_zone_id_key;
alter table public.zone_admins add constraint zone_admins_user_id_admin_zone_id_key unique (user_id, admin_zone_id);

-- Une zone réglementée appartient (optionnellement, pour les zones créées par un
-- super-admin sans territoire) à un territoire. C'est ce lien qui porte les droits
-- d'édition/suppression désormais — plus l'attribution directe par zone.
alter table public.custom_regulated_zones add column if not exists admin_zone_id uuid references public.admin_zones(id);

-- Nouvelle fonction helper (porte sur un territoire, pas une zone réglementée).
-- Créée avant de supprimer les policies dépendantes de l'ancienne is_zone_admin_of,
-- puis l'ancienne fonction est droppée une fois qu'aucune policy n'en dépend plus.
create or replace function public.is_admin_of_zone(uid uuid, azid uuid)
returns boolean
language sql
stable
as $$
  select public.is_super_admin(uid) or exists (
    select 1 from public.zone_admins where user_id = uid and admin_zone_id = azid
  );
$$;

-- Policies custom_regulated_zones : la création reste ouverte à tout admin de zone
-- (il doit alors renseigner admin_zone_id sur un de ses territoires) ; l'édition/
-- suppression est réservée au super-admin ou à l'admin du territoire de rattachement.
drop policy if exists "Admin insert custom zones" on public.custom_regulated_zones;
create policy "Admin insert custom zones"
  on public.custom_regulated_zones
  for insert
  with check (
    public.is_super_admin(auth.uid())
    or (admin_zone_id is not null and public.is_admin_of_zone(auth.uid(), admin_zone_id))
  );

drop policy if exists "Admin update custom zones" on public.custom_regulated_zones;
create policy "Admin update custom zones"
  on public.custom_regulated_zones
  for update
  using (
    public.is_super_admin(auth.uid())
    or (admin_zone_id is not null and public.is_admin_of_zone(auth.uid(), admin_zone_id))
  );

drop policy if exists "Admin delete custom zones" on public.custom_regulated_zones;
create policy "Admin delete custom zones"
  on public.custom_regulated_zones
  for delete
  using (
    public.is_super_admin(auth.uid())
    or (admin_zone_id is not null and public.is_admin_of_zone(auth.uid(), admin_zone_id))
  );

-- Obsolète : les droits viennent maintenant du territoire assigné, plus d'une
-- attribution automatique par zone réglementée créée.
drop trigger if exists trg_grant_zone_admin_on_zone_create on public.custom_regulated_zones;
drop function if exists public.grant_zone_admin_on_zone_create();

-- Plus aucune policy ne dépend de l'ancienne fonction : on peut la supprimer.
drop function if exists public.is_zone_admin_of(uuid, uuid);

-- is_any_admin reste valide (elle teste juste l'existence d'au moins une ligne
-- zone_admins, peu importe la colonne).
