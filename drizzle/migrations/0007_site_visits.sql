CREATE TABLE public.site_visits (
  id bigserial PRIMARY KEY,
  host text NOT NULL CHECK (char_length(host) <= 120),
  path text NOT NULL CHECK (char_length(path) <= 200),
  device text CHECK (device IN ('mobile','desktop')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.site_visits TO service_role;
GRANT USAGE ON SEQUENCE public.site_visits_id_seq TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE INDEX site_visits_created_idx ON public.site_visits (created_at);

CREATE OR REPLACE FUNCTION public.visit_stats(_days int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => greatest(1, least(_days, 365)));
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM site_visits WHERE created_at >= since),
    'today', (SELECT count(*) FROM site_visits WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),
    'mobile', (SELECT count(*) FROM site_visits WHERE created_at >= since AND device = 'mobile'),
    'hosts', coalesce((SELECT jsonb_agg(h ORDER BY h.count DESC) FROM (SELECT host, count(*) FROM site_visits WHERE created_at >= since GROUP BY host) h), '[]'),
    'daily', coalesce((SELECT jsonb_agg(d ORDER BY d.day) FROM (SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, host, count(*) FROM site_visits WHERE created_at >= since GROUP BY 1, 2) d), '[]')
  );
END $$;
REVOKE ALL ON FUNCTION public.visit_stats(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.visit_stats(int) TO authenticated;