ALTER TABLE public.potholes ADD COLUMN IF NOT EXISTS address text;
DROP FUNCTION IF EXISTS public.report_pothole(double precision, double precision, text);
CREATE OR REPLACE FUNCTION public.report_pothole(_lat double precision, _lng double precision, _photo text DEFAULT NULL, _address text DEFAULT NULL)
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
  _address := nullif(left(btrim(coalesce(_address,'')), 200), '');
  SELECT * INTO existing FROM public.potholes p
   WHERE p.status = 'aberto'
     AND 6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - _lat)/2),2) + cos(radians(_lat))*cos(radians(p.lat))*power(sin(radians(p.lng - _lng)/2),2))) <= 20
   ORDER BY power(p.lat - _lat,2) + power(p.lng - _lng,2) LIMIT 1;
  IF FOUND THEN
    UPDATE public.potholes SET report_count = report_count + 1, last_reported_at = now(),
      address = coalesce(address, _address),
      photos = CASE WHEN _photo IS NULL OR coalesce(array_length(photos,1),0) >= 10 THEN photos ELSE array_append(photos, _photo) END
     WHERE id = existing.id;
    RETURN json_build_object('id', existing.id, 'grouped', true);
  END IF;
  INSERT INTO public.potholes(lat, lng, photos, address) VALUES (_lat, _lng, CASE WHEN _photo IS NULL THEN '{}' ELSE ARRAY[_photo] END, _address)
  RETURNING id INTO new_id;
  RETURN json_build_object('id', new_id, 'grouped', false);
END $$;
REVOKE ALL ON FUNCTION public.report_pothole(double precision, double precision, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_pothole(double precision, double precision, text, text) TO anon, authenticated;