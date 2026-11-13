CREATE SEQUENCE IF NOT EXISTS public.potholes_number_seq;
ALTER TABLE public.potholes ADD COLUMN number integer;
UPDATE public.potholes p SET number = s.n FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM public.potholes) s WHERE s.id = p.id;
SELECT setval('public.potholes_number_seq', COALESCE((SELECT max(number) FROM public.potholes), 0) + 1, false);
ALTER TABLE public.potholes ALTER COLUMN number SET DEFAULT nextval('public.potholes_number_seq');
ALTER TABLE public.potholes ALTER COLUMN number SET NOT NULL;
ALTER SEQUENCE public.potholes_number_seq OWNED BY public.potholes.number;
CREATE UNIQUE INDEX IF NOT EXISTS potholes_number_key ON public.potholes(number);
GRANT SELECT (number) ON public.potholes TO anon;