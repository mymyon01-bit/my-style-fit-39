
-- Add new profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text DEFAULT null,
  ADD COLUMN IF NOT EXISTS phone text DEFAULT null,
  ADD COLUMN IF NOT EXISTS gender_preference text DEFAULT null,
  ADD COLUMN IF NOT EXISTS location text DEFAULT null,
  ADD COLUMN IF NOT EXISTS date_of_birth date DEFAULT null,
  ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Body scan images table
CREATE TABLE IF NOT EXISTS public.body_scan_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_type text NOT NULL CHECK (image_type IN ('front', 'side', 'back')),
  storage_path text NOT NULL,
  public_url text,
  validation_status text DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'processing')),
  validation_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.body_scan_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan images" ON public.body_scan_images
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scan images" ON public.body_scan_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scan images" ON public.body_scan_images
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scan images" ON public.body_scan_images
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_body_scan_images_updated_at
  BEFORE UPDATE ON public.body_scan_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('body-scans', 'body-scans', false)
ON CONFLICT (id) DO NOTHING;

-- Profile photos policies
CREATE POLICY "Anyone can view profile photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Users can upload own profile photo" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own profile photo" ON storage.objects
  FOR UPDATE USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own profile photo" ON storage.objects
  FOR DELETE USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Body scans policies
CREATE POLICY "Users can view own body scans" ON storage.objects
  FOR SELECT USING (bucket_id = 'body-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own body scans" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'body-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own body scans" ON storage.objects
  FOR UPDATE USING (bucket_id = 'body-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own body scans" ON storage.objects
  FOR DELETE USING (bucket_id = 'body-scans' AND auth.uid()::text = (storage.foldername(name))[1]);
