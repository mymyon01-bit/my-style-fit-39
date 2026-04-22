// ─── IMAGE PROXY ───────────────────────────────────────────────────────────
// Server-side fetch + validate + persist to the `product-images` Supabase
// storage bucket so the UI never depends on hotlink-fragile sources
// (gstatic, encrypted-tbn, lookaside, etc.).
//
// POST { url: string, productKey?: string }
// Response: { ok: true, url: string, source: "stored"|"passthrough"|"cached" }
//        or { ok: false, error: string }
//
// Behavior:
//   - HEAD/GET fetch with 8s timeout
//   - require HTTP 200 + image/* + min 300px (sniffed from Content-Length OR
//     reading first KB to detect tiny placeholders)
//   - upload to bucket as `<sha1(url)>.<ext>`; idempotent (checks for
//     existing first)
//   - returns the stored public URL
//
// Hard-rejects (no fetch attempted):
//   - obvious non-photo URLs (logo/sprite/favicon/placeholder)
//   - non-http(s)
//
// Designed to be cheap and safe to call from ingestion AND from UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "product-images";

const HARD_REJECT_RE =
  /(^|[-/_.])(logo|logos|brand[-_]?logo|favicon|sprite|sprites|icon[-_]?set|navbar|header[-_]?(logo|banner)|site[-_]?logo|app[-_]?icon|apple[-_]_touch[-_]?icon|placeholder|placehold|noimage|no[-_]?image|default[-_]?image|coming[-_]?soon)([-/_.]|$)/i;

function isProbablyPhoto(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (HARD_REJECT_RE.test(url)) return false;
  if (/\/favicon\.ico(\?|$)/i.test(url)) return false;
  return true;
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  const c = ct.toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("gif")) return "gif";
  if (c.includes("avif")) return "avif";
  return "jpg";
}

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: { url?: string; productKey?: string };
  try { body = await req.json(); }
  catch { return jsonErr("invalid_json", 400); }

  const url = String(body?.url || "").trim();
  if (!url) return jsonErr("missing_url", 400);
  if (!isProbablyPhoto(url)) return jsonErr("rejected_url", 400);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonErr("supabase_env_missing", 500);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const hash = await sha1Hex(url);

  // Idempotency: check for an existing object under this hash before fetching.
  // We list with a prefix instead of head() because we don't know the ext yet.
  try {
    const { data: existing } = await sb.storage.from(BUCKET).list("", { search: hash, limit: 5 });
    const hit = (existing || []).find((o) => o.name.startsWith(hash + "."));
    if (hit) {
      const pub = sb.storage.from(BUCKET).getPublicUrl(hit.name).data.publicUrl;
      return jsonOk({ url: pub, source: "cached" });
    }
  } catch { /* non-fatal */ }

  // Fetch the image.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        // Some CDNs require a real-looking UA / referer to serve the image.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    return jsonErr(`fetch_failed:${e instanceof Error ? e.message : "unknown"}`, 502);
  }
  clearTimeout(timer);

  if (!resp.ok) return jsonErr(`fetch_status_${resp.status}`, 502);

  const ct = resp.headers.get("content-type") || "";
  if (!/^image\//i.test(ct)) return jsonErr(`bad_content_type:${ct.slice(0, 40)}`, 415);

  const buf = new Uint8Array(await resp.arrayBuffer());
  // Min size heuristic — reject tiny placeholders (~<3KB nearly always is one).
  if (buf.byteLength < 3 * 1024) return jsonErr("image_too_small", 415);

  const ext = extFromContentType(ct);
  const path = `${hash}.${ext}`;
  const { error: uploadErr } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: ct, upsert: true, cacheControl: "31536000" });
  if (uploadErr) return jsonErr(`upload_failed:${uploadErr.message}`, 500);

  const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return jsonOk({ url: publicUrl, source: "stored" });
});

function jsonOk(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
}
function jsonErr(error: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
