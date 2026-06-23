ALTER TABLE public.custom_regulated_zones
  ADD COLUMN IF NOT EXISTS osm_source_id text;
