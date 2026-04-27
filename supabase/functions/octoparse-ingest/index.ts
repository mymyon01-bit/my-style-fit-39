/**
 * octoparse-ingest
 * ----------------
 * Background inventory builder. Pulls scraped product rows from one or more
 * Octoparse cloud tasks and upserts them into product_cache.
 *
 * Modes:
 *  - body { taskId: "..." }            → ingest one specific task
 *  - body { all: true }                 → ingest every enabled task in
 *                                         octoparse_tasks (used by cron)
 *
 * Octoparse expected output fields per row (configure in Octoparse task):
 *   title, image_url, product_url, price?, brand?, category?, external_id?
 *
 * The function is idempotent: it calls /data/markexported after a successful
 * batch so the same rows are not re-ingested next run.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OCTO_BASE = "https://openapi.octoparse.com";
const PAGE_SIZE = 1000;

interface OctoToken {
  access_token: string;
  expires_in: string;
  token_type: string;
  refresh_token: string;
}

interface OctoRow {
  title?: string;
  name?: string;
  image_url?: string;
  imageUrl?: string;
  product_url?: string;
  productUrl?: string;
  url?: string;
  price?: string;
  brand?: string;
  category?: string;
  external_id?: string;
  [k: string]: unknown;
}

async function getToken(): Promise<string> {
  const username = Deno.env.get("OCTOPARSE_USERNAME");
  const password = Deno.env.get("OCTOPARSE_PASSWORD");
  if (!username || !password) {
    throw new Error("OCTOPARSE_USERNAME / OCTOPARSE_PASSWORD not configured");
  }
  const res = await fetch(`${OCTO_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, grant_type: "password" }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Octoparse token failed [${res.status}]: ${JSON.stringify(json)}`);
  }
  const data = (json?.data ?? json) as OctoToken;
  if (!data?.access_token) throw new Error("Octoparse token missing access_token");
  return data.access_token;
}

async function fetchNotExported(
  token: string,
  taskId: string,
): Promise<OctoRow[]> {
  const url =
    `${OCTO_BASE}/data/notexported?taskId=${encodeURIComponent(taskId)}` +
    `&size=${PAGE_SIZE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Octoparse notexported failed [${res.status}]: ${JSON.stringify(json)}`);
  }
  const rows: OctoRow[] = json?.data?.data ?? [];
  return rows;
}

async function markExported(token: string, taskId: string): Promise<void> {
  const res = await fetch(`${OCTO_BASE}/data/markexported`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ taskId }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Octoparse markexported failed [${res.status}]: ${txt}`);
  }
}

function pick(row: OctoRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function hashId(input: string): string {
  // Deterministic short id from URL when external_id missing
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return `octo_${Math.abs(h).toString(36)}`;
}

interface NormalizedRow {
  external_id: string;
  name: string;
  image_url: string;
  source_url: string;
  brand: string | null;
  price: string | null;
  category: string | null;
  store_name: string;
}

function normalize(
  rows: OctoRow[],
  taskMeta: { source_site: string | null; category: string | null },
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  for (const r of rows) {
    const title = pick(r, "title", "name", "product_name");
    const image = pick(r, "image_url", "imageUrl", "image");
    const url = pick(r, "product_url", "productUrl", "url", "link");
    if (!title || !image || !url) continue;
    if (!/^https:\/\//i.test(image) || !/^https:\/\//i.test(url)) continue;

    const externalId = pick(r, "external_id", "externalId", "id") || hashId(url);

    out.push({
      external_id: externalId,
      name: title.slice(0, 500),
      image_url: image,
      source_url: url,
      brand: pick(r, "brand") ?? null,
      price: pick(r, "price") ?? null,
      category: pick(r, "category") ?? taskMeta.category,
      store_name: taskMeta.source_site || (() => {
        try { return new URL(url).hostname.replace(/^www\./, ""); }
        catch { return "octoparse"; }
      })(),
    });
  }
  return out;
}

async function ingestOneTask(
  supabase: ReturnType<typeof createClient>,
  token: string,
  task: {
    task_id: string;
    label: string;
    category: string | null;
    source_site: string | null;
  },
): Promise<{ taskId: string; fetched: number; inserted: number; error?: string }> {
  try {
    const rows = await fetchNotExported(token, task.task_id);
    if (rows.length === 0) {
      await supabase
        .from("octoparse_tasks")
        .update({ last_run_at: new Date().toISOString(), last_inserted_count: 0, last_error: null })
        .eq("task_id", task.task_id);
      return { taskId: task.task_id, fetched: 0, inserted: 0 };
    }

    const normalized = normalize(rows, {
      source_site: task.source_site,
      category: task.category,
    });

    let inserted = 0;
    if (normalized.length > 0) {
      const payload = normalized.map((n) => ({
        external_id: n.external_id,
        name: n.name,
        brand: n.brand,
        price: n.price,
        category: n.category,
        image_url: n.image_url,
        source_url: n.source_url,
        store_name: n.store_name,
        platform: "octoparse",
        source_type: "scraper",
        source_trust_level: "medium",
        is_active: true,
        image_valid: true,
        last_validated: new Date().toISOString(),
      }));

      const { error: upsertErr, count } = await supabase
        .from("product_cache")
        .upsert(payload, { onConflict: "platform,external_id", count: "exact" });

      if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);
      inserted = count ?? payload.length;
    }

    // Mark exported so we don't re-pull these rows next run.
    await markExported(token, task.task_id);

    await supabase
      .from("octoparse_tasks")
      .update({
        last_run_at: new Date().toISOString(),
        last_inserted_count: inserted,
        last_error: null,
      })
      .eq("task_id", task.task_id);

    return { taskId: task.task_id, fetched: rows.length, inserted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("octoparse_tasks")
      .update({ last_run_at: new Date().toISOString(), last_error: msg })
      .eq("task_id", task.task_id);
    return { taskId: task.task_id, fetched: 0, inserted: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const single: string | undefined = body?.taskId;
    const all: boolean = !!body?.all;

    let tasks: Array<{
      task_id: string;
      label: string;
      category: string | null;
      source_site: string | null;
    }> = [];

    if (single) {
      const { data } = await supabase
        .from("octoparse_tasks")
        .select("task_id,label,category,source_site")
        .eq("task_id", single)
        .maybeSingle();
      if (data) tasks = [data as typeof tasks[number]];
      else tasks = [{ task_id: single, label: single, category: null, source_site: null }];
    } else if (all) {
      const { data } = await supabase
        .from("octoparse_tasks")
        .select("task_id,label,category,source_site")
        .eq("enabled", true);
      tasks = (data ?? []) as typeof tasks;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide { taskId } or { all: true }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tasks.length === 0) {
      return new Response(JSON.stringify({ ok: true, results: [], note: "no tasks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getToken();
    const results = [];
    for (const t of tasks) {
      results.push(await ingestOneTask(supabase, token, t));
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("octoparse-ingest error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
