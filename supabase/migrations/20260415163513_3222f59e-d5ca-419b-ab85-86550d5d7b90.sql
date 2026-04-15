
-- User-created community topics for OOTD
CREATE TABLE public.ootd_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ootd_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view topics" ON public.ootd_topics FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create topics" ON public.ootd_topics FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Add topics column to ootd_posts
ALTER TABLE public.ootd_posts ADD COLUMN topics text[] DEFAULT '{}'::text[];

-- Function to increment topic post_count
CREATE OR REPLACE FUNCTION public.increment_topic_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.topics IS NOT NULL AND array_length(NEW.topics, 1) > 0 THEN
    UPDATE public.ootd_topics SET post_count = post_count + 1 WHERE name = ANY(NEW.topics);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER increment_topic_counts_trigger
AFTER INSERT ON public.ootd_posts
FOR EACH ROW
EXECUTE FUNCTION public.increment_topic_counts();
