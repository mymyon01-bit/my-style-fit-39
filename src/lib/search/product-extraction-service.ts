/**
 * Product extraction is performed server-side by the search-discovery
 * edge function (Firecrawl + Perplexity). The client never extracts directly
 * (keeps the FIRECRAWL_API_KEY off the browser).
 *
 * This module exposes a tiny façade so that, if we later move extraction
 * to a dedicated edge function, callers don't change.
 */
import { supabase } from "@/integrations/supabase/client";

export async function triggerExtractionForQuery(query: string): Promise<number> {
  try {
    const { data, error } = await supabase.functions.invoke("search-discovery", {
      body: { query, maxQueries: 12, maxCandidates: 40 },
    });
    if (error || !data) return 0;
    return Number(data.inserted) || 0;
  } catch {
    return 0;
  }
}
