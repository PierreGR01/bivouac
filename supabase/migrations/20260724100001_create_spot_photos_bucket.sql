-- Bucket public pour les photos de spots. Actuellement stockées en base64 inline dans
-- le JSONB `detail` des spots (jusqu'à 2,5 Mo/photo) — cette migration ne fait que créer
-- le bucket ; la bascule effective de l'upload et la migration des photos existantes se
-- font via l'Edge Function (service role, contourne RLS), pas de policy d'écriture ici.
insert into storage.buckets (id, name, public)
values ('spot-photos', 'spot-photos', true)
on conflict (id) do nothing;
