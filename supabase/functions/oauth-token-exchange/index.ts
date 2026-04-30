/**
 * OAuth Token Exchange — bridges OAuth tokens from the system browser
 * (where /~oauth-bridge runs) back to the native Capacitor WebView,
 * working around fragile custom-scheme deep links on Android.
 *
 * Flow:
 *   1. Native app generates a random `nonce`, opens
 *      https://mymyon.com/~oauth-bridge?provider=google&nonce=NONCE
 *   2. Bridge completes OAuth, then POSTs { nonce, access_token, refresh_token }
 *      to /functions/v1/oauth-token-exchange?action=store
 *   3. Native app polls /functions/v1/oauth-token-exchange?action=claim&nonce=NONCE
 *      every 1.5s until tokens come back (or browser is closed / 5min timeout).
 *   4. Native app sets the Supabase session and is signed in.
 *
 * The temp row is deleted on first claim (one-shot) and auto-expires after 5min.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isValidNonce = (n: unknown): n is string =>
  typeof n === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Opportunistic cleanup of expired rows (cheap).
  admin.rpc("purge_expired_oauth_exchange").then(() => {}).catch(() => {});

  try {
    if (action === "store" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { nonce, access_token, refresh_token } = body ?? {};
      if (!isValidNonce(nonce)) return json({ error: "bad_nonce" }, 400);
      if (typeof access_token !== "string" || access_token.length < 20)
        return json({ error: "bad_access_token" }, 400);
      if (typeof refresh_token !== "string" || refresh_token.length < 20)
        return json({ error: "bad_refresh_token" }, 400);

      const { error } = await admin
        .from("oauth_token_exchange")
        .upsert({ nonce, access_token, refresh_token }, { onConflict: "nonce" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "claim") {
      const nonce = url.searchParams.get("nonce");
      if (!isValidNonce(nonce)) return json({ error: "bad_nonce" }, 400);

      const { data, error } = await admin
        .from("oauth_token_exchange")
        .select("access_token, refresh_token, expires_at")
        .eq("nonce", nonce)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ pending: true });

      // One-shot: consume the row.
      await admin.from("oauth_token_exchange").delete().eq("nonce", nonce);

      // Reject expired rows.
      if (new Date(data.expires_at).getTime() < Date.now())
        return json({ error: "expired" }, 410);

      return json({
        ok: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "exchange_failed" }, 500);
  }
});
