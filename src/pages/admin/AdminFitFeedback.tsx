import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Star } from "lucide-react";

export default function AdminFitFeedback() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("fit_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(data ?? []);
    setLoading(false);
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      r.brand?.toLowerCase().includes(f) ||
      r.category?.toLowerCase().includes(f) ||
      r.feedback_type?.toLowerCase().includes(f) ||
      r.product_key?.toLowerCase().includes(f)
    );
  });

  // Group quick stats: feedback_type counts
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    counts[r.feedback_type] = (counts[r.feedback_type] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">Fit Feedback (Learning)</h1>
        <span className="text-[11px] text-foreground/60">{rows.length} entries</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border/15 bg-card/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-foreground/55">{k.replace(/_/g, " ")}</p>
            <p className="text-[18px] font-display text-foreground/85">{v}</p>
          </div>
        ))}
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by brand, category, feedback type…"
        className="w-full rounded-lg border border-border/20 bg-card/30 px-3 py-2 text-[13px] outline-none placeholder:text-foreground/40"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/15">
          <table className="w-full text-[11px]">
            <thead className="bg-background/40 text-left text-foreground/65">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Brand</th>
                <th className="px-2 py-2">Cat</th>
                <th className="px-2 py-2">P-Gender</th>
                <th className="px-2 py-2">U-Gender</th>
                <th className="px-2 py-2">Rec</th>
                <th className="px-2 py-2">Chosen</th>
                <th className="px-2 py-2">Feedback</th>
                <th className="px-2 py-2">Areas</th>
                <th className="px-2 py-2">★</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/10">
                  <td className="px-2 py-2 text-foreground/55">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-2 py-2 text-foreground/85">{r.brand || "—"}</td>
                  <td className="px-2 py-2 text-foreground/75">{r.category || "—"}</td>
                  <td className="px-2 py-2 text-foreground/65">{r.product_gender || "—"}</td>
                  <td className="px-2 py-2 text-foreground/65">{r.user_gender || "—"}</td>
                  <td className="px-2 py-2 text-foreground/85">{r.recommended_size || "—"}</td>
                  <td className="px-2 py-2 text-foreground/85">{r.chosen_size || "—"}</td>
                  <td className="px-2 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${
                      r.feedback_type === "true_to_size" ? "border-accent/40 text-accent/85" : "border-destructive/30 text-destructive"
                    }`}>{r.feedback_type}</span>
                  </td>
                  <td className="px-2 py-2 text-foreground/65">{(r.feedback_areas || []).join(", ") || "—"}</td>
                  <td className="px-2 py-2 text-foreground/75">{r.satisfaction ? <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3" />{r.satisfaction}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="py-8 text-center text-[12px] text-foreground/55">No feedback yet.</p>}
        </div>
      )}
    </div>
  );
}
