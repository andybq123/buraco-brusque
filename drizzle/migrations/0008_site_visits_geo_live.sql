ALTER TABLE public.site_visits
  ADD COLUMN last_seen timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN city text CHECK (char_length(city) <= 80),
  ADD COLUMN region text CHECK (char_length(region) <= 80),
  ADD COLUMN country text CHECK (char_length(country) <= 80),
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision;
CREATE INDEX site_visits_last_seen_idx ON public.site_visits (last_seen);

CREATE OR REPLACE FUNCTION public.visit_stats(_days int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => greatest(1, least(_days, 365)));
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM site_visits WHERE created_at >= since),
    'today', (SELECT count(*) FROM site_visits WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),
    'online', (SELECT count(*) FROM site_visits WHERE last_seen >= now() - interval '2 minutes'),
    'mobile', (SELECT count(*) FROM site_visits WHERE created_at >= since AND device = 'mobile'),
    'hosts', coalesce((SELECT jsonb_agg(h ORDER BY h.count DESC) FROM (SELECT host, count(*) FROM site_visits WHERE created_at >= since GROUP BY host) h), '[]'),
    'cities', coalesce((SELECT jsonb_agg(c ORDER BY c.count DESC) FROM (SELECT coalesce(city,'Desconhecida') AS city, region, count(*) FROM site_visits WHERE created_at >= since GROUP BY 1,2 ORDER BY 3 DESC LIMIT 15) c), '[]'),
    'points', coalesce((SELECT jsonb_agg(p) FROM (SELECT round(lat::numeric,2)::float AS lat, round(lng::numeric,2)::float AS lng, min(city) AS city, count(*) AS count, bool_or(last_seen >= now() - interval '2 minutes') AS live FROM site_visits WHERE created_at >= since AND lat IS NOT NULL GROUP BY 1,2) p), '[]'),
    'daily', coalesce((SELECT jsonb_agg(d ORDER BY d.day) FROM (SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, host, count(*) FROM site_visits WHERE created_at >= since GROUP BY 1, 2) d), '[]')
  );
END $$;