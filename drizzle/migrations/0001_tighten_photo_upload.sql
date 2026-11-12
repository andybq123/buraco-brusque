DROP POLICY IF EXISTS "anyone upload photo" ON storage.objects;
CREATE POLICY "anyone upload photo" ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'fotos'
  AND name ~ '^[a-zA-Z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$'
  AND (owner_id IS NULL OR owner_id = (select auth.uid()::text))
);