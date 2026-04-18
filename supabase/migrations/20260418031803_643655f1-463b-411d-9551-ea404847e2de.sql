-- Query clusters: precomputed product groups per query family for instant DB-first fallback
CREATE TABLE public.query_clusters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_key TEXT NOT NULL UNIQUE,
  query_family TEXT NOT NULL,
  category TEXT,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  product_count INTEGER NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_query_clusters_family ON public.query_clusters(query_family);
CREATE INDEX idx_query_clusters_category ON public.query_clusters(category);

ALTER TABLE public.query_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view query clusters"
ON public.query_clusters
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage query clusters"
ON public.query_clusters
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_query_clusters_updated_at
BEFORE UPDATE ON public.query_clusters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();