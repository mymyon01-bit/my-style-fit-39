DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ootd_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ootd_posts;
  END IF;
END $$;
ALTER TABLE public.ootd_posts REPLICA IDENTITY FULL;