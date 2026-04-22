/**
 * register-device-token — stores an APNs / FCM device token for the
 * currently authenticated user so push notifications can be targeted to
 * their devices.
 *
 * Auth: requires a user JWT. Token is upserted on (user_id, token).
 * Re-registering the same device updates `last_seen_at` (and optional
 * app_version / device_model) instead of duplicating rows.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  token: string;
  platform: "ios" | "android";
  app_version?: string;
  device_model?: string;
}

const isValid = (b: unknown): b is Body => {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.token === "string" &&
    o.token.length > 0 &&
    o.token.length < 4096 &&
    (o.platform === "ios" || o.platform === "android")
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } =
      await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!isValid(body)) {
      return new Response(
        JSON.stringify({ error: "invalid_body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Service role to upsert (RLS would also allow user, but service role
    // keeps this resilient if RLS shape changes).
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { error: upsertErr } = await adminClient
      .from("push_device_tokens")
      .upsert(
        {
          user_id: userData.user.id,
          token: body.token,
          platform: body.platform,
          app_version: body.app_version ?? null,
          device_model: body.device_model ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );

    if (upsertErr) {
      console.error("[register-device-token] upsert failed", upsertErr);
      return new Response(JSON.stringify({ error: "db_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[register-device-token] error", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
