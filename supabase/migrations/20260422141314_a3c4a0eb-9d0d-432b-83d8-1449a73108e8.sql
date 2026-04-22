DELETE FROM public.fit_tryons;
DELETE FROM public.fit_generations_v2;
DELETE FROM public.user_body_images;
DELETE FROM public.body_scan_images;
UPDATE public.body_profiles SET body_avatar_url = NULL, body_landmarks = '{}'::jsonb;