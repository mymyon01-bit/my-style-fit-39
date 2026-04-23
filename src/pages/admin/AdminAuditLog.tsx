import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileSearch } from "lucide-react";

export default function AdminAuditLog() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setRows(data ?? []);
    setLoading(false);
  }

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      r.action?.toLowerCase().includes(f) ||
      r.target_table?.toLowerCase().includes(f) ||
      r.actor_role?.toLowerCase().includes(f) ||
      r.reason?.toLowerCase().includes(f)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">Audit Log</h1>
        <span className="text-[11px] text-foreground/60">{rows.length} recent entries</span>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 px-3 py-2">
        <FileSearch className="h-4 w-4 text-foreground/60" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action, table, role, reason…"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground/40"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <details key={r.id} className="rounded-lg border border-border/15 bg-card/30 px-3 py-2 text-[12px]">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                      r.action === "delete"
                        ? "border-destructive/40 text-destructive"
                        : r.action === "role_change"
                        ? "border-accent/40 text-accent/80"
                        : "border-border/30 text-foreground/70"
                    }`}
                  >
                    {r.action}
                  </span>
                  <span className="text-foreground/80">{r.target_table || "—"}</span>
                  {r.target_id && <span className="font-mono text-[10px] text-foreground/50">{String(r.target_id).slice(0, 16)}…</span>}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-foreground/55">
                  <span>{r.actor_role}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-foreground/55">Before</p>
                  <pre className="overflow-x-auto rounded bg-background/40 p-2 text-[10px] text-foreground/70">{JSON.stringify(r.before_data, null, 2) || "—"}</pre>
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-foreground/55">After</p>
                  <pre className="overflow-x-auto rounded bg-background/40 p-2 text-[10px] text-foreground/70">{JSON.stringify(r.after_data, null, 2) || "—"}</pre>
                </div>
              </div>
              {r.reason && <p className="mt-2 text-[11px] text-foreground/65">Reason: {r.reason}</p>}
              <p className="mt-1 font-mono text-[10px] text-foreground/45">actor: {r.actor_id}</p>
            </details>
          ))}
          {filtered.length === 0 && <p className="py-8 text-center text-[12px] text-foreground/55">No entries match.</p>}
        </div>
      )}
    </div>
  );
}
