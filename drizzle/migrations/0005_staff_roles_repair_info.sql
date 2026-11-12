ALTER TABLE public.admin_emails ADD COLUMN role public.app_role NOT NULL DEFAULT 'admin';
ALTER TABLE public.potholes ADD COLUMN repaired_by text CHECK (char_length(repaired_by) <= 200);
ALTER TABLE public.potholes ADD COLUMN resolved_by_email text;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operador'))
$$;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_email_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  NEW.email := lower(trim(NEW.email));
  DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = NEW.email);
  INSERT INTO public.user_roles(user_id, role)
    SELECT id, NEW.role FROM auth.users WHERE lower(email) = NEW.email AND email_confirmed_at IS NOT NULL
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_email_removed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = OLD.email);
  RETURN OLD;
END $function$;

CREATE OR REPLACE FUNCTION public.sync_admin_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE r public.app_role;
BEGIN
  SELECT role INTO r FROM public.admin_emails WHERE email = lower(NEW.email);
  IF NEW.email_confirmed_at IS NOT NULL AND r IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

DROP POLICY IF EXISTS "admin all read" ON public.potholes;
DROP POLICY IF EXISTS "admin update" ON public.potholes;
CREATE POLICY "staff read" ON public.potholes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update" ON public.potholes FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- campos internos ficam ocultos para o público
REVOKE SELECT ON public.potholes FROM anon;
GRANT SELECT (id, lat, lng, status, report_count, created_at, last_reported_at, resolved_at, address, size, hazards) ON public.potholes TO anon;

DROP POLICY IF EXISTS "admins read" ON public.admin_emails;
CREATE POLICY "admins read" ON public.admin_emails FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));