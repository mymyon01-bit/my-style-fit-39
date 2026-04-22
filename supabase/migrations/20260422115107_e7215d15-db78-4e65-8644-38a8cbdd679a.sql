-- Replace the broad public SELECT policy with a name-restricted one
DROP POLICY IF EXISTS "Anyone can download app files" ON storage.objects;

CREATE POLICY "Public can download known APK"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'app-downloads'
    AND name IN ('mymyon.apk', 'mymyon-latest.apk')
  );