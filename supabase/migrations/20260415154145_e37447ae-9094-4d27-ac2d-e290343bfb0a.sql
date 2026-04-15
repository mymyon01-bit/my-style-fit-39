-- Create storage bucket for OOTD photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ootd-photos', 'ootd-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view OOTD photos
CREATE POLICY "OOTD photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'ootd-photos');

-- Allow authenticated users to upload photos to their own folder
CREATE POLICY "Users can upload OOTD photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ootd-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own OOTD photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ootd-photos' AND auth.uid()::text = (storage.foldername(name))[1]);