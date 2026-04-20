// google-cse — Google Custom Search URL discovery for Discover LAYER B.
//
// Returns candidate product URLs (with title + snippet) that the caller can
// feed into search-discovery's extraction layer. Does NOT extract or write to
// product_cache directly — keeps responsibility narrow and cheap.
//
// Body:  { query: string, num?: number, gl?: string, hl?: string, siteFilter?: string[] }
// Reply: { ok, count, candidates: [{ url, title, snippet, source }] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CSE_KEY = Deno.env.get("GOOGLE_CSE_KEY") || "";
const CSE_CX  = Deno.env.get("GOOGLE_CSE_CX")  || "";

// Same trusted-store list product-search/search-discovery uses, kept inline
// to avoid cross-file deno imports between functions.
const TRUSTED = [
  "shopping.naver.com","smartstore.naver.com","brand.naver.com",
  "coupang.com","musinsa.com","kream.co.kr","ssg.com","gmarket.co.kr",
  "29cm.co.kr","wconcept.co.kr","interpark.com","interpark.co.kr",
  "asos.com","ssense.com","farfetch.com","yoox.com","zalando.com","zalando.de","zalando.co.uk",
  "net-a-porter.com","mrporter.com","endclothing.com","matchesfashion.com","mytheresa.com",
  "nordstrom.com","shopbop.com","uniqlo.com","hm.com","zara.com","cosstores.com","arket.com",
  "everlane.com","aritzia.com","revolve.com","saksfifthavenue.com","neimanmarcus.com",
  "luisaviaroma.com","amazon.com",
];

const NON_PRODUCT_PATH_RE =
  /\/(blog|news|article|guide|story|stories|editorial|magazine|press|about|help|faq|contact|search|category|categories|collection|collections|brand|brands|home|customer|account|login|register)\/?($|\?)/i;
const PRODUCT_PATH_RE = /\/(p|product|products|item|items|shop|prd|dp|goods)\/[\w\-]+/i;
const PRODUCT_QUERY_RE = /[?&](pid|productid|sku|itemid|prdNo|goodsNo)=/i;

function looksLikeProductUrl(url: string, title?: string, snippet?: string): boolean {
  const u = url.toLowerCase();
  if (NON_PRODUCT_PATH_RE.test(u)) return false;
  if (PRODUCT_PATH_RE.test(u))  return true;
  if (PRODUCT_QUERY_RE.test(u)) return true;
  const trusted = TRUSTED.some((d) => u.includes(d));
  if (trusted) return true;
  // Allow if snippet/title clearly product-y
  const text = `${title || ""} ${snippet || ""}`.toLowerCase();
  if (/\b(buy|shop|price|\$|€|£|₩|in stock|add to (cart|bag))\b/.test(text)) return true;
  return false;
}

interface CseItem { link?: string; title?: string; snippet?: string; }

async function cseQuery(q: string, num: number, gl?: string, hl?: string, siteFilter?: string[]): Promise<CseItem[]> {
  const out: CseItem[] = [];
  // CSE caps `num` at 10 per call. We page (start=1,11,21) up to 30.
  const passes = Math.min(3, Math.ceil(num / 10));
  const queries = siteFilter && siteFilter.length
    ? siteFilter.map((d) => `${q} site:${d}`)
    : [q];

  for (const finalQ of queries) {
    for (let i = 0; i < passes; i++) {
      const url = new URL("https://customsearch.googleapis.com/customsearch/v1");
      url.searchParams.set("key", CSE_KEY);
      url.searchParams.set("cx", CSE_CX);
      url.searchParams.set("q", finalQ);
      url.searchParams.set("num", "10");
      url.searchParams.set("start", String(i * 10 + 1));
      if (gl) url.searchParams.set("gl", gl);
      if (hl) url.searchParams.set("hl", hl);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7_000);
        const res = await fetch(url.toString(), { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) {
          console.log(`[google-cse] http ${res.status} q="${finalQ}"`);
          break;
        }
        const json = await res.json();
        const items: CseItem[] = Array.isArray(json?.items) ? json.items : [];
        if (!items.length) break;
        out.push(...items);
        if (items.length < 10) break;
      } catch (e) {
        console.log(`[google-cse] err ${(e as Error).message}`);
        break;
      }
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!CSE_KEY || !CSE_CX) {
      return new Response(JSON.stringify({ ok: false, error: "GOOGLE_CSE_KEY/CX not configured", count: 0, candidates: [] }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({}));
    const query: string = (body?.query || "").toString().trim();
    if (!query) {
      return new Response(JSON.stringify({ ok: false, error: "missing query", count: 0, candidates: [] }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const num: number = Math.min(Math.max(Number(body?.num) || 20, 5), 30);
    const gl: string | undefined = body?.gl || undefined;
    const hl: string | undefined = body?.hl || undefined;
    const siteFilter: string[] | undefined = Array.isArray(body?.siteFilter) ? body.siteFilter.slice(0, 5) : undefined;

    const t0 = Date.now();
    const items = await cseQuery(query, num, gl, hl, siteFilter);

    const seen = new Set<string>();
    const candidates = items.flatMap((it) => {
      const url = (it.link || "").trim();
      if (!url) return [];
      const k = url.split("?")[0].toLowerCase();
      if (seen.has(k)) return [];
      if (!looksLikeProductUrl(url, it.title, it.snippet)) return [];
      seen.add(k);
      return [{ url, title: it.title || null, snippet: it.snippet || null, source: "google_cse" }];
    });

    console.log(`[google-cse] q="${query}" raw=${items.length} kept=${candidates.length} ms=${Date.now() - t0}`);

    return new Response(JSON.stringify({ ok: true, count: candidates.length, candidates, elapsed_ms: Date.now() - t0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, count: 0, candidates: [] }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
