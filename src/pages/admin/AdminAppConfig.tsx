import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/admin/audit";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Cfg = {
  id?: string;
  key: string;
  category: string;
  value: any;
  description?: string | null;
  is_secret: boolean;
};

const CATEGORIES = ["general", "prompts", "ui_copy", "operational"];
const BLANK: Cfg = { key: "", category: "general", value: {}, is_secret: false };

export default function AdminAppConfig() {
  const [rows, setRows] = useState<Cfg[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Cfg>(BLANK);
  const [draftValue, setDraftValue] = useState("{}");
  const [editing, setEditing] = useState<Record<string, string>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("app_config").select("*").order("category").order("key");
    setRows((data as Cfg[]) ?? []);
    const eds: Record<string, string> = {};
    (data as Cfg[] ?? []).forEach((c) => {
      if (c.id) eds[c.id] = JSON.stringify(c.value, null, 2);
    });
    setEditing(eds);
    setLoading(false);
  }

  async function save(row: Cfg, valueJson: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(valueJson);
    } catch {
      return toast.error("Value must be valid JSON");
    }
    const before = rows.find((r) => r.id === row.id) ?? null;
    const payload = { ...row, value: parsed };
    const { data, error } = await supabase.from("app_config").upsert(payload).select().maybeSingle();
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: "config_change",
      targetTable: "app_config",
      targetId: data?.id ?? row.id ?? row.key,
      before,
      after: data ?? payload,
    });
    toast.success("Saved");
    if (!row.id) {
      setDraft(BLANK);
      setDraftValue("{}");
    }
    load();
  }

  async function remove(row: Cfg) {
    if (!row.id) return;
    if (!confirm(`Delete config key "${row.key}"?`)) return;
    const { error } = await supabase.from("app_config").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAdminAction({ action: "delete", targetTable: "app_config", targetId: row.id, before: row });
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
      <h1 className="text-lg font-display text-foreground/80">App Config</h1>
      <p className="text-[11px] text-foreground/60">
        Prompts, UI copy, and operational settings stored as JSON. Mark sensitive values as secret to hide them from public reads.
      </p>

      {/* New */}
      <div className="rounded-xl border border-accent/20 bg-card/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent/70" />
          <p className="text-[12px] font-medium text-foreground/80">Add config entry</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input placeholder="key.snake_case" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className="rounded border border-border/25 bg-background/40 px-2 py-1 text-[12px] font-mono" />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded border border-border/25 bg-background/40 px-2 py-1 text-[12px]">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Description" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="rounded border border-border/25 bg-background/40 px-2 py-1 text-[12px] sm:col-span-2" />
        </div>
        <textarea
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          rows={4}
          className="mt-2 w-full rounded border border-border/25 bg-background/40 px-2 py-1 font-mono text-[11px]"
          placeholder='{"copy": "Hello"}'
        />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-1 text-[11px] text-foreground/70">
            <input type="checkbox" checked={draft.is_secret} onChange={(e) => setDraft({ ...draft, is_secret: e.target.checked })} />
            mark as secret
          </label>
          <button onClick={() => draft.key && save(draft, draftValue)} className="rounded-md bg-accent/20 px-3 py-1 text-[11px] text-foreground/85 hover:bg-accent/30">Add</button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((c) => (
          <div key={c.id} className="rounded-xl border border-border/15 bg-card/30 p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[12px] text-foreground/85">{c.key}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full border border-border/30 px-2 py-0.5 text-[9px] uppercase tracking-wider text-foreground/65">{c.category}</span>
                  {c.is_secret && <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-destructive">secret</span>}
                </div>
                {c.description && <p className="mt-1 text-[11px] text-foreground/55">{c.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => save(c, editing[c.id!] ?? JSON.stringify(c.value, null, 2))} className="inline-flex items-center gap-1 rounded-md border border-accent/30 px-2 py-1 text-[10px] text-accent/85 hover:bg-accent/10">
                  <Save className="h-3 w-3" /> Save
                </button>
                <button onClick={() => remove(c)} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            <textarea
              value={editing[c.id!] ?? ""}
              onChange={(e) => setEditing((prev) => ({ ...prev, [c.id!]: e.target.value }))}
              rows={Math.min(20, Math.max(4, (editing[c.id!] || "").split("\n").length))}
              className="w-full rounded border border-border/25 bg-background/40 px-2 py-1 font-mono text-[11px] text-foreground/85"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
