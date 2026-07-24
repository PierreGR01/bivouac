-- Rate limiting persistant pour l'Edge Function make-server-e51cba93.
-- Remplace le Map en mémoire (`_rateWindows`), qui se réinitialise à chaque cold
-- start et ne survit pas au scaling horizontal de l'Edge Function.
create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

-- RLS activée, AUCUNE policy : accessible uniquement via la service role dans
-- l'Edge Function (même pattern que `spots`, cf. 20260723120001_create_spots_table.sql).
alter table public.rate_limits enable row level security;

-- Incrémente atomiquement le compteur de `p_key` et renvoie `true` si la requête
-- est autorisée (compteur <= p_max) sur la fenêtre glissante de p_window_seconds.
-- L'upsert atomique évite les races d'un pattern lire-puis-écrire fait depuis le
-- client JS. Purge opportuniste (1% des appels) des fenêtres expirées, pour ne pas
-- dépendre de pg_cron (indisponible en plan gratuit Supabase).
create or replace function public.check_and_increment_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when public.rate_limits.reset_at <= now() then 1 else public.rate_limits.count + 1 end,
        reset_at = case when public.rate_limits.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else public.rate_limits.reset_at end
  returning count into v_count;

  if random() < 0.01 then
    delete from public.rate_limits where reset_at < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;
