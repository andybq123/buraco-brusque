ALTER TABLE public.potholes ADD COLUMN size text CHECK (size IN ('pequeno','medio','grande'));
ALTER TABLE public.potholes ADD COLUMN hazards text[] NOT NULL DEFAULT '{}' CHECK (hazards <@ ARRAY['moto','pneu','noite','agua']::text[]);
DROP FUNCTION IF EXISTS public.report_pothole(double precision, double precision, text, text);
CREATE OR REPLACE FUNCTION public.report_pothole(_lat double precision, _lng double precision, _photo text DEFAULT NULL, _address text DEFAULT NULL, _size text DEFAULT NULL, _hazards text[] DEFAULT '{}')
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  existing public.potholes;
  new_id uuid;
  rank_new int;
  rank_old int;
BEGIN
  IF _lat IS NULL OR _lng IS NULL OR _lat < -27.25 OR _lat > -26.95 OR _lng < -49.10 OR _lng > -48.75 THEN
    RAISE EXCEPTION 'fora_de_brusque';
  END IF;
  IF _photo IS NOT NULL AND _photo !~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' THEN _photo := NULL; END IF;
  _address := nullif(left(btrim(coalesce(_address,'')), 200), '');
  IF _size IS NOT NULL AND _size NOT IN ('pequeno','medio','grande') THEN _size := NULL; END IF;
  _hazards := coalesce(ARRAY(SELECT DISTINCT h FROM unnest(coalesce(_hazards,'{}')) h WHERE h IN ('moto','pneu','noite','agua') ORDER BY h), '{}');
  SELECT * INTO existing FROM public.potholes p
   WHERE p.status = 'aberto'
     AND 6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - _lat)/2),2) + cos(radians(_lat))*cos(radians(p.lat))*power(sin(radians(p.lng - _lng)/2),2))) <= 20
   ORDER BY power(p.lat - _lat,2) + power(p.lng - _lng,2) LIMIT 1;
  IF FOUND THEN
    rank_new := CASE _size WHEN 'pequeno' THEN 1 WHEN 'medio' THEN 2 WHEN 'grande' THEN 3 ELSE 0 END;
    rank_old := CASE existing.size WHEN 'pequeno' THEN 1 WHEN 'medio' THEN 2 WHEN 'grande' THEN 3 ELSE 0 END;
    UPDATE public.potholes SET report_count = report_count + 1, last_reported_at = now(),
      address = coalesce(address, _address),
      size = CASE WHEN rank_new > rank_old THEN _size ELSE size END,
      hazards = ARRAY(SELECT DISTINCT h FROM unnest(hazards || _hazards) h ORDER BY h),
      photos = CASE WHEN _photo IS NULL OR coalesce(array_length(photos,1),0) >= 10 THEN photos ELSE array_append(photos, _photo) END
     WHERE id = existing.id;
    RETURN json_build_object('id', existing.id, 'grouped', true);
  END IF;
  INSERT INTO public.potholes(lat, lng, photos, address, size, hazards)
  VALUES (_lat, _lng, CASE WHEN _photo IS NULL THEN '{}' ELSE ARRAY[_photo] END, _address, _size, _hazards)
  RETURNING id INTO new_id;
  RETURN json_build_object('id', new_id, 'grouped', false);
END $function$;
GRANT EXECUTE ON FUNCTION public.report_pothole(double precision, double precision, text, text, text, text[]) TO anon, authenticated;