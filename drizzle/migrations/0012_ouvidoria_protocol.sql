ALTER TABLE public.potholes ADD COLUMN IF NOT EXISTS ouvidoria_protocol text, ADD COLUMN IF NOT EXISTS ouvidoria_sent_at timestamptz;
GRANT SELECT (ouvidoria_protocol, ouvidoria_sent_at) ON public.potholes TO anon;
GRANT SELECT (ouvidoria_protocol, ouvidoria_sent_at), UPDATE (ouvidoria_protocol, ouvidoria_sent_at) ON public.potholes TO authenticated;