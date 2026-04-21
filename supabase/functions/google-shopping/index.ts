// google-shopping — fetch products from Google Shopping via SerpAPI,
// upsert into product_cache, and return live results to the caller.
//
// Body: { query: string, gl?: string, hl?: string, limit?: number, liveOnly?: boolean }
// Response: { ok, inserted, count, products: [...] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERPAPI_KEY = Deno.env.get("SERPAPI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function inferCategory(title: string): string {
  const t = (title || "").toLowerCase();
  if (/\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker)\b/.test(t)) return "outerwear";
  if (/\b(shirt|tee|t-shirt|hoodie|sweater|cardigan|polo|blouse|tank|knit)\b/.test(t)) return "tops";
  if (/\b(pants|trousers|jeans|shorts|skirt|chinos|joggers|leggings)\b/.test(t)) return "bottoms";
  if (/\b(sneaker|shoe|boot|loafer|sandal|trainer|mule)\b/.test(t)) return "shoes";
  if (/\b(bag|tote|backpack|crossbody|clutch|purse|satchel|duffel)\b/.test(t)) return "bags";
  return "accessories";
}

function langToLocale(hl?: string): { gl: string; hl: string } {
  switch ((hl || "").toLowerCase()) {
    case "ko": return { gl: "kr", hl: "ko" };
    case "it": return { gl: "it", hl: "it" };
    default:   return { gl: "us", hl: "en" };
  }
}

interface SerpShoppingItem {
  position?: number;
  title?: string;
  link?: string;
  product_link?: string;
  product_id?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  thumbnails?: string[];
  rating?: number;
  reviews?: number;
  delivery?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!SERPAPI_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "SERPAPI_API_KEY not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query || "").toString().trim();
    if (!query) {
      return new Response(JSON.stringify({ ok: false, error: "missing query" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { gl: defaultGl, hl: defaultHl } = langToLocale(body?.hl);
    const gl = (body?.gl || defaultGl).toString();
    const hl = (body?.hl || defaultHl).toString();
    const limit = Math.min(Math.max(Number(body?.limit) || 100, 10), 100);
    const liveOnly = !!body?.liveOnly;

    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("gl", gl);
    url.searchParams.set("hl", hl);
    url.searchParams.set("num", String(limit));
    url.searchParams.set("api_key", SERPAPI_KEY);

    const t0 = Date.now();
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      console.log("[google-shopping] serpapi_error", resp.status, txt.slice(0, 300));
      // Quota exhausted / rate limited / auth error: degrade gracefully so the
      // search ladder upstream can keep using DB + other sources instead of
      // surfacing a 5xx to the client.
      const quotaExhausted = resp.status === 429 || /run out of searches|quota|hourly searches/i.test(txt);
      if (quotaExhausted || resp.status === 401 || resp.status === 403) {
        return new Response(
          JSON.stringify({ ok: true, products: [], degraded: true, reason: `serpapi_${resp.status}` }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: `serpapi ${resp.status}`, body: txt.slice(0, 300) }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const json = await resp.json();
    const items: SerpShoppingItem[] = Array.isArray(json?.shopping_results) ? json.shopping_results : [];

    const products = items
      .map((it) => {
        const title = (it.title || "").trim();
        const image = it.thumbnail || (Array.isArray(it.thumbnails) ? it.thumbnails[0] : "") || "";
        const link = it.product_link || it.link || "";
        if (!title || !image || !link) return null;
        return {
          external_id: it.product_id ? `gshop:${it.product_id}` : `gshop:${link}`,
          name: title,
          brand: it.source || null,
          price: it.price || (typeof it.extracted_price === "number" ? String(it.extracted_price) : null),
          currency: gl === "kr" ? "KRW" : gl === "it" ? "EUR" : "USD",
          image_url: image,
          source_url: link,
          store_name: it.source || null,
          platform: "google_shopping",
          source_type: "serpapi",
          source_trust_level: "high",
          category: inferCategory(title),
          search_query: query,
          image_valid: true,
          is_active: true,
          last_validated: new Date().toISOString(),
          trend_score: typeof it.rating === "number" ? Math.round(it.rating * 20) : 50,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    let inserted = 0;
    if (!liveOnly && products.length && SUPABASE_URL && SERVICE_ROLE) {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      // Dedupe by (platform, external_id) — the actual unique index in product_cache.
      const { error, count } = await sb
        .from("product_cache")
        .upsert(products as never, { onConflict: "platform,external_id", ignoreDuplicates: false, count: "exact" });
      if (error) {
        console.log("[google-shopping] upsert_error", error.message);
      } else {
        inserted = count ?? products.length;
      }
    }

    console.log(
      `[google-shopping] q="${query}" gl=${gl} fetched=${items.length} kept=${products.length} inserted=${inserted} elapsed=${Date.now() - t0}ms`,
    );

    return new Response(
      JSON.stringify({ ok: true, count: products.length, inserted, products, elapsed_ms: Date.now() - t0 }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[google-shopping] fatal", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
