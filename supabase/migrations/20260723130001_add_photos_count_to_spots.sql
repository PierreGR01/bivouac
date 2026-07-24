-- Compteur de photos matérialisé en colonne typée, pour permettre au tableau admin
-- (potentiellement des milliers de spots à l'échelle d'un territoire ou de toute la
-- plateforme) d'afficher un nombre de médias par spot sans avoir à transférer les
-- tableaux de photos (base64) eux-mêmes.
alter table public.spots add column if not exists photos_count integer not null default 0;

update public.spots
set photos_count = jsonb_array_length(coalesce(detail->'photos', '[]'::jsonb))
where photos_count = 0;
