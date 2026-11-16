ALTER TABLE public.potholes ADD COLUMN kind text NOT NULL DEFAULT 'buraco' CHECK (kind IN ('buraco','iluminacao'));
ALTER TABLE public.potholes ADD COLUMN descriptions text[] NOT NULL DEFAULT '{}';
GRANT SELECT (kind) ON public.potholes TO anon;
DROP FUNCTION IF EXISTS public.report_pothole(double precision, double precision, text, text, text, text[]);
CREATE OR REPLACE FUNCTION public.report_pothole(_lat double precision, _lng double precision, _photo text DEFAULT NULL, _address text DEFAULT NULL, _size text DEFAULT NULL, _hazards text[] DEFAULT '{}', _kind text DEFAULT 'buraco', _description text DEFAULT NULL)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE existing public.potholes; new_id uuid; rank_new int; rank_old int;
BEGIN
  IF NOT public.inside_brusque(_lat, _lng) THEN RAISE EXCEPTION 'fora_de_brusque'; END IF;
  IF _kind IS NULL OR _kind NOT IN ('buraco','iluminacao') THEN _kind := 'buraco'; END IF;
  IF _photo IS NOT NULL AND _photo !~ '^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$' THEN _photo := NULL; END IF;
  _address := nullif(left(btrim(coalesce(_address,'')), 200), '');
  _description := nullif(left(btrim(coalesce(_description,'')), 500), '');
  IF _kind = 'iluminacao' THEN _size := NULL; _hazards := '{}'; END IF;
  IF _size IS NOT NULL AND _size NOT IN ('pequeno','medio','grande') THEN _size := NULL; END IF;
  _hazards := coalesce(ARRAY(SELECT DISTINCT h FROM unnest(coalesce(_hazards,'{}')) h WHERE h IN ('moto','pneu','noite','agua') ORDER BY h), '{}');
  SELECT * INTO existing FROM public.potholes p
   WHERE p.status = 'aberto' AND p.kind = _kind
     AND 6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - _lat)/2),2) + cos(radians(_lat))*cos(radians(p.lat))*power(sin(radians(p.lng - _lng)/2),2))) <= 20
   ORDER BY power(p.lat - _lat,2) + power(p.lng - _lng,2) LIMIT 1;
  IF FOUND THEN
    rank_new := CASE _size WHEN 'pequeno' THEN 1 WHEN 'medio' THEN 2 WHEN 'grande' THEN 3 ELSE 0 END;
    rank_old := CASE existing.size WHEN 'pequeno' THEN 1 WHEN 'medio' THEN 2 WHEN 'grande' THEN 3 ELSE 0 END;
    UPDATE public.potholes SET report_count = report_count + 1, last_reported_at = now(),
      address = coalesce(address, _address),
      size = CASE WHEN rank_new > rank_old THEN _size ELSE size END,
      hazards = ARRAY(SELECT DISTINCT h FROM unnest(hazards || _hazards) h ORDER BY h),
      descriptions = CASE WHEN _description IS NULL OR coalesce(array_length(descriptions,1),0) >= 20 THEN descriptions ELSE array_append(descriptions, _description) END,
      photos = CASE WHEN _photo IS NULL OR coalesce(array_length(photos,1),0) >= 10 THEN photos ELSE array_append(photos, _photo) END
     WHERE id = existing.id;
    RETURN json_build_object('id', existing.id, 'grouped', true);
  END IF;
  INSERT INTO public.potholes(lat, lng, photos, address, size, hazards, kind, descriptions)
  VALUES (_lat, _lng, CASE WHEN _photo IS NULL THEN '{}' ELSE ARRAY[_photo] END, _address, _size, _hazards, _kind, CASE WHEN _description IS NULL THEN '{}' ELSE ARRAY[_description] END)
  RETURNING id INTO new_id;
  RETURN json_build_object('id', new_id, 'grouped', false);
END $function$;
GRANT EXECUTE ON FUNCTION public.report_pothole(double precision, double precision, text, text, text, text[], text, text) TO anon, authenticated;