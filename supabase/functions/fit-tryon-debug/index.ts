const corsHeaders = { "Access-Control-Allow-Origin": "*" };
Deno.serve(async () => {
  const token = Deno.env.get("REPLICATE_API_TOKEN")!;
  // 1. fetch model metadata (does account have access?)
  const meta = await fetch("https://api.replicate.com/v1/models/cuuupid/idm-vton", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const metaBody = await meta.text();
  // 2. attempt prediction with minimal valid input
  const pred = await fetch("https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: {
      human_img: "https://replicate.delivery/pbxt/L0ggvr4QBIYXwOonQjzL0vgKMfDOxwwEY1iEuvnMFHJp7iV5/00.png",
      garm_img: "https://replicate.delivery/pbxt/L0ggvVu1pXpV9R0nGvgwJ8oeDjC0kKaJpLQRRMa2sNOJxyHj/04469_00.jpg",
      garment_des: "shirt",
    }}),
  });
  const predBody = await pred.text();
  return new Response(JSON.stringify({
    metaStatus: meta.status, metaBody: metaBody.slice(0, 500),
    predStatus: pred.status, predBody: predBody.slice(0, 800),
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
