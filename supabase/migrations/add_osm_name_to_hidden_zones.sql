ALTER TABLE public.hidden_osm_zones
  ADD COLUMN IF NOT EXISTS osm_name text;
