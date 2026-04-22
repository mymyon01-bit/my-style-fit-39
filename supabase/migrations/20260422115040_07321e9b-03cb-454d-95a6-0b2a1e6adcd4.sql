-- Public storage bucket for app downloads (APK, future iOS IPA if applicable)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-downloads',
  'app-downloads',
  true,
  524288000, -- 500 MB
  ARRAY['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip'];

-- Anyone can read (public download). Only admins can write/update/delete.
CREATE POLICY "Anyone can download app files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-downloads');

CREATE POLICY "Admins can upload app files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'app-downloads'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can update app files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'app-downloads'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete app files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'app-downloads'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );