-- Replace overly permissive SELECT (which allows listing) with public read by-key only.
-- Public buckets serve objects via direct URL regardless of policies, so we can drop the listing policy.
DROP POLICY IF EXISTS "Anyone can view fit composites" ON storage.objects;

-- Tighten UPDATE: must own the path (was already gated by user folder, the linter flags pattern shape).
-- Keep behavior identical, just be explicit about WITH CHECK to satisfy the linter.
DROP POLICY IF EXISTS "Users can update own fit composites" ON storage.objects;
CREATE POLICY "Users can update own fit composites"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fit-composites'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'fit-composites'
  AND auth.uid()::text = (storage.foldername(name))[1]
);