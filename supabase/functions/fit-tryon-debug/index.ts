// Temp debug: verify REPLICATE_API_TOKEN is valid by hitting /v1/account
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = Deno.env.get("REPLICATE_API_TOKEN") || "";
  const masked = token ? `${token.slice(0, 4)}...${token.slice(-4)} (len=${token.length})` : "MISSING";
  const r = await fetch("https://api.replicate.com/v1/account", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.text();
  return new Response(JSON.stringify({ tokenMasked: masked, status: r.status, body: body.slice(0, 400) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
