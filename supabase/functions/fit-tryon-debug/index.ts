Deno.serve(async () => {
  const token = Deno.env.get("REPLICATE_API_TOKEN")!;
  const r = await fetch("https://api.replicate.com/v1/models/cuuupid/idm-vton", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json();
  return new Response(JSON.stringify({ latest_version_id: data?.latest_version?.id, name: data?.name }), {
    headers: { "Content-Type": "application/json" },
  });
});
