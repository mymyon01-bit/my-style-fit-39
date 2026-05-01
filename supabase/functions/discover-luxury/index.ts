// discover-luxury — thin orchestrator that boosts Discover for luxury brand
// queries. Re-uses the existing legal data sources (SerpAPI via
// `google-shopping`, Apify via `multi-source-scraper`, Perplexity+Firecrawl
// via `search-discovery`) and caches the merged result list in
// `discovery_cache` for fast reloads.
//
// NEVER scrapes brand sites directly. NEVER stores HTML. Image URLs are kept
// pointing at the original source (they go through the existing image-proxy
// only when the upstream function decides they're fragile).
//
// Body: { query: string, gender?: string, lang?: string }
// Response: { ok, cached, products, sources }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ─── BRAND REGISTRY (mirror of src/lib/discover/luxuryBrands.ts) ──────────
// Keep in sync; intentionally inlined so the edge function has no extra imports.
const RAW_ALIASES: Array<[string[], string, number]> = [
  [["hermes", "에르메스", "エルメス", "爱马仕"], "Hermès", 1.4],
  [["chanel", "샤넬", "シャネル", "香奈儿"], "Chanel", 1.4],
  [["louis vuitton", "lv", "루이비통", "ルイヴィトン", "路易威登"], "Louis Vuitton", 1.4],
  [["dior", "christian dior", "디올", "ディオール", "迪奥"], "Dior", 1.4],
  [["gucci", "구찌", "グッチ", "古驰"], "Gucci", 1.3],
  [["prada", "프라다", "プラダ", "普拉达"], "Prada", 1.3],
  [["burberry", "버버리", "バーバリー", "博柏利"], "Burberry", 1.3],
  [["balenciaga", "발렌시아가", "バレンシアガ", "巴黎世家"], "Balenciaga", 1.3],
  [["saint laurent", "ysl", "yves saint laurent", "생로랑", "サンローラン"], "Saint Laurent", 1.3],
  [["bottega veneta", "bottega", "보테가", "보테가베네타", "ボッテガヴェネタ"], "Bottega Veneta", 1.3],
  [["fendi", "펜디", "フェンディ", "芬迪"], "Fendi", 1.3],
  [["valentino", "발렌티노", "ヴァレンティノ"], "Valentino", 1.3],
  [["givenchy", "지방시", "ジバンシィ"], "Givenchy", 1.3],
  [["celine", "céline", "셀린느", "셀린", "セリーヌ"], "Celine", 1.3],
  [["loewe", "로에베", "ロエベ"], "Loewe", 1.3],
  [["miu miu", "미우미우", "ミュウミュウ"], "Miu Miu", 1.25],
  [["versace", "베르사체", "ヴェルサーチェ"], "Versace", 1.25],
  [["alexander mcqueen", "mcqueen", "맥퀸", "マックイーン"], "Alexander McQueen", 1.25],
  [["acne studios", "acne", "아크네", "아크네스튜디오", "アクネ"], "Acne Studios", 1.15],
  [["maison margiela", "margiela", "mm6", "마르지엘라", "메종마르지엘라", "マルジェラ"], "Maison Margiela", 1.15],
  [["jacquemus", "자크뮈스", "ジャックムス"], "Jacquemus", 1.15],
  [["off-white", "off white", "오프화이트", "オフホワイト"], "Off-White", 1.15],
  [["jil sander", "질샌더", "ジルサンダー"], "Jil Sander", 1.15],
  [["the row", "더로우"], "The Row", 1.15],
  [["totême", "toteme", "토템", "토테메"], "Totême", 1.15],
  [["khaite", "케이트"], "Khaite", 1.15],
  [["lemaire", "르메르", "ルメール"], "Lemaire", 1.15],
  [["our legacy", "아워레가시"], "Our Legacy", 1.15],
  [["stone island", "스톤아일랜드", "ストーンアイランド"], "Stone Island", 1.15],
  [["moncler", "몽클레르", "モンクレール"], "Moncler", 1.2],
  [["canada goose", "캐나다구스"], "Canada Goose", 1.15],
  [["thom browne", "톰브라운", "トムブラウン"], "Thom Browne", 1.2],
  [["brunello cucinelli", "cucinelli", "브루넬로쿠치넬리"], "Brunello Cucinelli", 1.2],
  [["zegna", "ermenegildo zegna", "제냐", "ゼニア"], "Zegna", 1.2],
];

const DOMAINS: Record<string, string> = {
  "Hermès": "hermes.com", "Chanel": "chanel.com", "Louis Vuitton": "louisvuitton.com",
  "Dior": "dior.com", "Gucci": "gucci.com", "Prada": "prada.com", "Burberry": "burberry.com",
  "Balenciaga": "balenciaga.com", "Saint Laurent": "ysl.com", "Bottega Veneta": "bottegaveneta.com",
  "Fendi": "fendi.com", "Valentino": "valentino.com", "Givenchy": "givenchy.com",
  "Celine": "celine.com", "Loewe": "loewe.com", "Miu Miu": "miumiu.com", "Versace": "versace.com",
  "Alexander McQueen": "alexandermcqueen.com", "Acne Studios": "acnestudios.com",
  "Maison Margiela": "maisonmargiela.com", "Jacquemus": "jacquemus.com", "Off-White": "off---white.com",
  "Jil Sander": "jilsander.com", "The Row": "therow.com", "Totême": "toteme-studio.com",
  "Khaite": "khaite.com", "Lemaire": "lemaire.fr", "Our Legacy": "ourlegacy.com",
  "Stone Island": "stoneisland.com", "Moncler": "moncler.com", "Canada Goose": "canadagoose.com",
  "Thom Browne": "thombrowne.com", "Brunello Cucinelli": "brunellocucinelli.com", "Zegna": "zegna.com",
};

const RETAILERS = ["farfetch.com", "ssense.com", "mytheresa.com"] as const;

function normKey(s: string): string {
  return (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

const ALIAS_MAP = new Map<string, string>();
const BOOST_MAP = new Map<string, number>();
for (const [aliases, canonical, boost] of RAW_ALIASES) {
  BOOST_MAP.set(canonical, boost);
  ALIAS_MAP.set(normKey(canonical), canonical);
  for (const a of aliases) ALIAS_MAP.set(normKey(a), canonical);
}

function detectBrand(query: string): { brand: string | null; weight: number; domain: string | null } {
  const key = normKey(query);
  if (!key) return { brand: null, weight: 1, domain: null };
  const aliases = Array.from(ALIAS_MAP.keys()).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const isCjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(alias);
    const matched = isCjk
      ? key.includes(alias)
      : new RegExp(`(?:^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(key);
    if (matched) {
      const canonical = ALIAS_MAP.get(alias)!;
      return { brand: canonical, weight: BOOST_MAP.get(canonical) ?? 1.15, domain: DOMAINS[canonical] ?? null };
    }
  }
  return { brand: null, weight: 1, domain: null };
}

function enrichQuery(query: string, domain: string | null): string {
  const sites: string[] = [];
  if (domain) sites.push(domain);
  sites.push(...RETAILERS.slice(0, 3));
  return `${query} (${sites.map((s) => `site:${s}`).join(" OR ")})`;
}

function normalizeTitle(t: string): string {
  return (t || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim().slice(0, 80);
}

interface MergedProduct {
  id?: string;
  external_id?: string;
  brand?: string | null;
  name?: string;
  price?: string | number | null;
  image_url?: string;
  source_url?: string;
  category?: string | null;
  source?: string;
  trend_score?: number;
}

async function callFunc(name: string, body: Record<string, unknown>, timeoutMs = 25000): Promise<unknown> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.log(`[discover-luxury] ${name} -> http ${r.status}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[discover-luxury] ${name} -> error ${msg}`);
    return null;
  } finally {
    clearTimeout(t);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query || "").toString().trim();
    const lang: string = (body?.lang || "en").toString().toLowerCase().slice(0, 5);
    const gender: string | null = body?.gender ? String(body.gender).slice(0, 16) : null;

    if (!query) {
      return new Response(JSON.stringify({ ok: false, error: "missing query" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ ok: false, error: "service not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const detection = detectBrand(query);
    const queryKey = `${normKey(query)}::${lang}::${gender ?? ""}`;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ── 1. Cache lookup ────────────────────────────────────────────────
    const { data: cacheRow } = await sb
      .from("discovery_cache")
      .select("query_key, product_ids, source_breakdown, expires_at")
      .eq("query_key", queryKey)
      .maybeSingle();

    if (cacheRow && new Date(cacheRow.expires_at).getTime() > Date.now()) {
      const ids = (cacheRow.product_ids as string[]) || [];
      if (ids.length) {
        const { data: prods } = await sb
          .from("product_cache")
          .select("id, external_id, brand, name, price, image_url, source_url, category, platform, trend_score")
          .in("id", ids)
          .eq("is_active", true);
        await sb
          .from("discovery_cache")
          .update({ hit_count: ((cacheRow as { hit_count?: number }).hit_count ?? 0) + 1 })
          .eq("query_key", queryKey);
        return new Response(
          JSON.stringify({
            ok: true,
            cached: true,
            brand: detection.brand,
            products: prods ?? [],
            sources: cacheRow.source_breakdown,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    }

    // ── 2. Multi-source fan-out ───────────────────────────────────────
    const enrichedQuery = detection.brand ? enrichQuery(query, detection.domain) : query;

    const fanout = await Promise.allSettled([
      callFunc("google-shopping", { query: enrichedQuery, hl: lang, limit: 60 }),
      callFunc("multi-source-scraper", { query, hl: lang, limit: 40 }),
      callFunc("search-discovery", { query, hl: lang, limit: 30 }),
    ]);

    const sourceBreakdown: Record<string, number> = {};
    const collected: MergedProduct[] = [];

    function pushFrom(source: string, payload: unknown) {
      const arr = (payload as { products?: MergedProduct[] })?.products;
      if (!Array.isArray(arr)) return;
      sourceBreakdown[source] = arr.length;
      for (const p of arr) {
        if (!p?.image_url || !p?.source_url || !p?.name) continue;
        collected.push({ ...p, source });
      }
    }

    pushFrom("google_shopping", fanout[0].status === "fulfilled" ? fanout[0].value : null);
    pushFrom("multi_source", fanout[1].status === "fulfilled" ? fanout[1].value : null);
    pushFrom("search_discovery", fanout[2].status === "fulfilled" ? fanout[2].value : null);

    // ── 3. Dedupe (brand + normalized title) ──────────────────────────
    const seen = new Set<string>();
    const deduped: MergedProduct[] = [];
    for (const p of collected) {
      const brandKey = normKey(String(p.brand || ""));
      const titleKey = normalizeTitle(String(p.name || ""));
      const key = `${brandKey}::${titleKey}`;
      if (seen.has(key) || !titleKey) continue;
      seen.add(key);
      deduped.push(p);
    }

    // ── 4. Rank with brand boost + freshness ──────────────────────────
    const scored = deduped.map((p) => {
      const c = ALIAS_MAP.get(normKey(String(p.brand || "")));
      const boost = c ? (BOOST_MAP.get(c) ?? 1) : 1;
      const trend = typeof p.trend_score === "number" ? p.trend_score : 50;
      return { p, score: trend * boost };
    });
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 60).map((s) => s.p);

    // ── 5. Resolve to product_cache rows so the UI gets canonical ids ─
    const externalIds = top.map((p) => p.external_id).filter((x): x is string => !!x);
    let resolved: Array<{ id: string }> = [];
    if (externalIds.length) {
      const { data } = await sb
        .from("product_cache")
        .select("id, external_id")
        .in("external_id", externalIds);
      resolved = (data as Array<{ id: string }>) ?? [];
    }
    const productIds = resolved.map((r) => r.id);

    // ── 6. Cache upsert (TTL 6h) ──────────────────────────────────────
    if (productIds.length) {
      await sb.from("discovery_cache").upsert(
        {
          query_key: queryKey,
          query,
          lang,
          gender,
          product_ids: productIds,
          source_breakdown: sourceBreakdown,
          hit_count: 0,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "query_key" },
      );
    }

    console.log(
      `[discover-luxury] q="${query}" brand="${detection.brand}" sources=${JSON.stringify(sourceBreakdown)} kept=${top.length}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        cached: false,
        brand: detection.brand,
        products: top,
        sources: sourceBreakdown,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[discover-luxury] fatal", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
