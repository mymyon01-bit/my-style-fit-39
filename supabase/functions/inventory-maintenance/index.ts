import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Check if a URL returns a valid image response */
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const results = { validated: 0, deactivated: 0, trendUpdated: 0, errors: 0 };

  try {
    // ─── 1. IMAGE VALIDATION (products not validated in 7+ days) ───
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: staleProducts } = await supabase
      .from("product_cache")
      .select("id, image_url, external_id")
      .eq("is_active", true)
      .lt("last_validated", sevenDaysAgo)
      .limit(50); // batch size per run

    if (staleProducts?.length) {
      console.log(`Validating ${staleProducts.length} stale products...`);
      for (const product of staleProducts) {
        try {
          const valid = product.image_url ? await validateImageUrl(product.image_url) : false;
          if (valid) {
            await supabase.from("product_cache").update({
              last_validated: now,
              image_valid: true,
            }).eq("id", product.id);
            results.validated++;
          } else {
            await supabase.from("product_cache").update({
              is_active: false,
              image_valid: false,
              last_validated: now,
            }).eq("id", product.id);
            // Log failure
            await supabase.from("image_failures").insert({
              product_name: product.external_id || product.id,
              image_url: product.image_url,
              failure_reason: "validation_expired",
              source: "inventory-maintenance",
            });
            results.deactivated++;
          }
        } catch {
          results.errors++;
        }
      }
    }

    // ─── 2. TREND SCORE UPDATE ───
    // Score = (view_count * 1) + (like_count * 3) + saved_count * 5
    // Decay: products older than 30 days get a small penalty
    const { data: activeProducts } = await supabase
      .from("product_cache")
      .select("id, external_id, view_count, like_count, created_at")
      .eq("is_active", true)
      .limit(200);

    if (activeProducts?.length) {
      // Get save counts from saved_items
      const externalIds = activeProducts.map(p => p.external_id).filter(Boolean);
      const { data: savedCounts } = await supabase
        .from("saved_items")
        .select("product_id")
        .in("product_id", externalIds);

      const saveMap = new Map<string, number>();
      (savedCounts || []).forEach(s => {
        saveMap.set(s.product_id, (saveMap.get(s.product_id) || 0) + 1);
      });

      const thirtyDaysAgo = Date.now() - 30 * 86400000;

      for (const p of activeProducts) {
        const saves = saveMap.get(p.external_id || "") || 0;
        const ageMs = Date.now() - new Date(p.created_at).getTime();
        const agePenalty = ageMs > thirtyDaysAgo ? Math.min((ageMs - thirtyDaysAgo) / (30 * 86400000), 0.5) : 0;
        const rawScore = (p.view_count || 0) * 1 + (p.like_count || 0) * 3 + saves * 5;
        const trendScore = Math.max(0, rawScore * (1 - agePenalty));

        await supabase.from("product_cache").update({ trend_score: trendScore }).eq("id", p.id);
        results.trendUpdated++;
      }
    }

    console.log("Inventory maintenance complete:", results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Inventory maintenance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
