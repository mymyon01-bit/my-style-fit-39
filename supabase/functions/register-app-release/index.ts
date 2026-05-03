/**
 * register-app-release — called by the GitHub Actions Android build to
 * insert a new row into `app_releases` so installed clients pick up the
 * update via AppUpdatePrompt.
 *
 * Auth: a shared token in the `APP_RELEASE_REGISTER_TOKEN` secret. The
 * function uses the service role key (auto-provided) to bypass RLS so we
 * don't need an admin user session from CI.
 *
 * Body JSON:
 *   {
 *     version_code: number,
 *     version_name: string,
 *     apk_url: string,
 *     release_notes?: string,
 *     is_critical?: boolean,
 *     platform?: "android" (default)
 *   }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-register-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const expected = Deno.env.get("APP_RELEASE_REGISTER_TOKEN");
  if (!expected) {
    return new Response(JSON.stringify({ error: "server token not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-register-token");
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const version_code = Number(body.version_code);
  const version_name = String(body.version_name ?? "");
  const apk_url = String(body.apk_url ?? "");
  const platform = String(body.platform ?? "android");
  const release_notes = body.release_notes != null ? String(body.release_notes) : null;
  const is_critical = Boolean(body.is_critical);

  if (!Number.isFinite(version_code) || !version_name || !apk_url) {
    return new Response(JSON.stringify({ error: "missing version_code/version_name/apk_url" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Upsert by (platform, version_code) so re-runs of the same commit are idempotent.
  const { data, error } = await supabase
    .from("app_releases")
    .upsert(
      {
        platform,
        version_code,
        version_name,
        apk_url,
        release_notes,
        is_critical,
        is_published: true,
      },
      { onConflict: "platform,version_code" },
    )
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, release: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
