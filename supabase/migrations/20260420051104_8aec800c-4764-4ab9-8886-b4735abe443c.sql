-- Public bucket for FIT composited images
INSERT INTO storage.buckets (id, name, public)
VALUES ('fit-composites', 'fit-composites', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder: fit-composites/{user_id}/...
CREATE POLICY "Users can upload own fit composites"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fit-composites'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Authenticated users can update their own composites (e.g. regenerate)
CREATE POLICY "Users can update own fit composites"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fit-composites'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Anyone can read fit composites (public bucket)
CREATE POLICY "Anyone can view fit composites"
ON storage.objects
FOR SELECT
USING (bucket_id = 'fit-composites');