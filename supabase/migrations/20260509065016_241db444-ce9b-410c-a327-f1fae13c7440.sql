REVOKE EXECUTE ON FUNCTION public.create_wave(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_wave(text, text, text, text) TO authenticated;