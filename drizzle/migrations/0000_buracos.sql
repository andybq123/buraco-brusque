CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- E-mails autorizados como administradores
CREATE TABLE public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.admin_emails TO authenticated;
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read" ON public.admin_emails FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert" ON public.admin_emails FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete" ON public.admin_emails FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Sincroniza papel admin com a lista de e-mails
CREATE OR REPLACE FUNCTION public.sync_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.admin_emails WHERE email = lower(NEW.email)) THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_admin AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role();

CREATE OR REPLACE FUNCTION public.admin_email_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  INSERT INTO public.user_roles(user_id, role)
    SELECT id, 'admin' FROM auth.users WHERE lower(email) = NEW.email AND email_confirmed_at IS NOT NULL
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_admin_email_insert BEFORE INSERT ON public.admin_emails
FOR EACH ROW EXECUTE FUNCTION public.admin_email_added();

CREATE OR REPLACE FUNCTION public.admin_email_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_roles WHERE role = 'admin'
    AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = OLD.email);
  RETURN OLD;
END $$;
CREATE TRIGGER on_admin_email_delete AFTER DELETE ON public.admin_emails
FOR EACH ROW EXECUTE FUNCTION public.admin_email_removed();

-- Buracos
CREATE TABLE public.potholes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','consertado','removido')),
  report_count integer NOT NULL DEFAULT 1,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX potholes_status_idx ON public.potholes(status);
GRANT SELECT ON public.potholes TO anon;
GRANT SELECT, UPDATE ON public.potholes TO authenticated;
GRANT ALL ON public.potholes TO service_role;
ALTER TABLE public.potholes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public visible" ON public.potholes FOR SELECT TO anon, authenticated USING (status <> 'removido');
CREATE POLICY "admin all read" ON public.potholes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update" ON public.potholes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Informar buraco: agrupa num raio de 20 m com buraco aberto existente
CREATE OR REPLACE FUNCTION public.report_pothole(_lat double precision, _lng double precision, _photo text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing public.potholes;
  new_id uuid;
BEGIN
  IF _lat IS NULL OR _lng IS NULL OR _lat < -27.25 OR _lat > -26.95 OR _lng < -49.10 OR _lng > -48.75 THEN
    RAISE EXCEPTION 'fora_de_brusque';
  END IF;
  IF _photo IS NOT NULL AND _photo !~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' THEN
    _photo := NULL;
  END IF;
  SELECT * INTO existing FROM public.potholes p
   WHERE p.status = 'aberto'
     AND 6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - _lat)/2),2) + cos(radians(_lat))*cos(radians(p.lat))*power(sin(radians(p.lng - _lng)/2),2))) <= 20
   ORDER BY power(p.lat - _lat,2) + power(p.lng - _lng,2) LIMIT 1;
  IF FOUND THEN
    UPDATE public.potholes SET report_count = report_count + 1, last_reported_at = now(),
      photos = CASE WHEN _photo IS NULL OR array_length(photos,1) >= 10 THEN photos ELSE array_append(photos, _photo) END
     WHERE id = existing.id;
    RETURN json_build_object('id', existing.id, 'grouped', true);
  END IF;
  INSERT INTO public.potholes(lat, lng, photos) VALUES (_lat, _lng, CASE WHEN _photo IS NULL THEN '{}' ELSE ARRAY[_photo] END)
  RETURNING id INTO new_id;
  RETURN json_build_object('id', new_id, 'grouped', false);
END $$;
GRANT EXECUTE ON FUNCTION public.report_pothole(double precision, double precision, text) TO anon, authenticated;

-- Fotos (bucket privado): qualquer um envia, só admin vê
CREATE POLICY "anyone upload photo" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'fotos');
CREATE POLICY "admin view photo" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos' AND public.has_role(auth.uid(),'admin'));