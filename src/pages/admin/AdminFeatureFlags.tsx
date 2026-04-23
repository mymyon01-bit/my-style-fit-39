import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/admin/audit";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Flag = {
  id?: string;
  key: string;
  description?: string | null;
  enabled: boolean;
  rollout_percent: number;
  metadata?: any;
};

const BLANK: Flag = { key: "", enabled: false, rollout_percent: 100 };

export default function AdminFeatureFlags() {
  const [rows, setRows] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Flag>(BLANK);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("feature_flags").select("*").order("key");
    setRows((data as Flag[]) ?? []);
    setLoading(false);
  }

  async function save(row: Flag) {
    const before = rows.find((r) => r.id === row.id) ?? null;
    const { data, error } = await supabase.from("feature_flags").upsert(row).select().maybeSingle();
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: "flag_change",
      targetTable: "feature_flags",
      targetId: data?.id ?? row.id ?? row.key,
      before,
      after: data ?? row,
    });
    toast.success("Saved");
    if (!row.id) setDraft(BLANK);
    load();
  }

  async function remove(row: Flag) {
    if (!row.id) return;
    if (!confirm(`Delete flag "${row.key}"?`)) return;
    const { error } = await supabase.from("feature_flags").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAdminAction({ action: "delete", targetTable: "feature_flags", targetId: row.id, before: row });
    toast.success("Deleted");
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-display text-foreground/80">Feature Flags</h1>

      <div className="rounded-xl border border-accent/20 bg-card/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent/70" />
          <p className="text-[12px] font-medium text-foreground/80">Add flag</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="flag.key.snake_case"
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            className="rounded border border-border/25 bg-background/40 px-2 py-1 text-[12px] font-mono"
          />
          <input
            placeholder="Description"
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="flex-1 rounded border border-border/25 bg-background/40 px-2 py-1 text-[12px]"
          />
          <label className="flex items-center gap-1 text-[11px] text-foreground/70">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            on
          </label>
          <input
            type="number" min={0} max={100} value={draft.rollout_percent}
            onChange={(e) => setDraft({ ...draft, rollout_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
            className="w-16 rounded border border-border/25 bg-background/40 px-2 py-1 text-[11px]"
          />
          <button onClick={() => draft.key && save(draft)} className="rounded-md bg-accent/20 px-3 py-1 text-[11px] text-foreground/85 hover:bg-accent/30">Add</button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((f) => (
          <div key={f.id} className="rounded-lg border border-border/15 bg-card/30 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="font-mono text-[12px] text-foreground/85">{f.key}</p>
                <p className="text-[11px] text-foreground/55">{f.description || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-foreground/70">
                  <input type="checkbox" checked={f.enabled} onChange={(e) => save({ ...f, enabled: e.target.checked })} />
                  enabled
                </label>
                <input
                  type="number" min={0} max={100} value={f.rollout_percent}
                  onChange={(e) => save({ ...f, rollout_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="w-16 rounded border border-border/25 bg-background/40 px-2 py-1 text-[11px]"
                />
                <span className="text-[10px] text-foreground/55">%</span>
                <button onClick={() => remove(f)} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-[12px] text-foreground/55">No flags defined yet.</p>}
      </div>
    </div>
  );
}
