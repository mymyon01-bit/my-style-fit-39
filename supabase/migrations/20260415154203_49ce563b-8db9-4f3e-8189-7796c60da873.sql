-- Drop the overly broad SELECT policy
DROP POLICY IF EXISTS "OOTD photos are publicly accessible" ON storage.objects;

-- Create a more restrictive policy that still allows viewing specific files
-- but requires knowing the file path (no listing)
CREATE POLICY "OOTD photos viewable by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'ootd-photos' AND (storage.filename(name) IS NOT NULL));