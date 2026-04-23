import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/admin/audit";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id?: string;
  gender: string;
  category: string;
  subcategory?: string | null;
  fit_intent?: string | null;
  ease_chest_cm?: number | null;
  ease_waist_cm?: number | null;
  ease_hip_cm?: number | null;
  ease_shoulder_cm?: number | null;
  ease_length_cm?: number | null;
  notes?: string | null;
  is_active?: boolean;
};

const GENDERS = ["male", "female", "unisex"];
const CATEGORIES = ["top", "bottom", "dress", "outerwear", "knit"];
const FIT_INTENT = ["", "slim", "regular", "relaxed", "oversized"];

const BLANK: Rule = { gender: "male", category: "top", is_active: true };

export default function AdminFitRules() {
  const [rows, setRows] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Rule>(BLANK);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("fit_size_rules").select("*").order("gender").order("category");
    setRows((data as Rule[]) ?? []);
    setLoading(false);
  }

  async function save(row: Rule) {
    const before = rows.find((r) => r.id === row.id) ?? null;
    const { data, error } = await supabase.from("fit_size_rules").upsert(row).select().maybeSingle();
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: row.id ? "update" : "create",
      targetTable: "fit_size_rules",
      targetId: data?.id ?? row.id ?? `${row.gender}_${row.category}`,
      before,
      after: data ?? row,
    });
    toast.success("Saved");
    if (!row.id) setDraft(BLANK);
    load();
  }

  async function remove(row: Rule) {
    if (!row.id) return;
    if (!confirm("Delete this fit rule?")) return;
    const { error } = await supabase.from("fit_size_rules").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAdminAction({ action: "delete", targetTable: "fit_size_rules", targetId: row.id, before: row });
    toast.success("Deleted");
    load();
  }

  function num(v: number | null | undefined, on: (n: number | null) => void) {
    return (
      <input
        type="number"
        step="0.5"
        value={v ?? ""}
        onChange={(e) => on(e.target.value === "" ? null : parseFloat(e.target.value))}
        className="w-16 rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]"
      />
    );
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">Fit Size Rules</h1>
        <span className="text-[11px] text-foreground/60">{rows.length} rules</span>
      </div>
      <p className="text-[11px] text-foreground/60">
        Ease values applied per gender + category + fit intent. These override the engine defaults when present.
      </p>

      <div className="rounded-xl border border-accent/20 bg-card/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent/70" />
          <p className="text-[12px] font-medium text-foreground/80">Add rule</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
          <select value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })} className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]">
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="subcat" value={draft.subcategory ?? ""} onChange={(e) => setDraft({ ...draft, subcategory: e.target.value || null })} className="rounded border border-border/25 bg-background/40 px-2 py-1 text-[11px]" />
          <select value={draft.fit_intent ?? ""} onChange={(e) => setDraft({ ...draft, fit_intent: e.target.value || null })} className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]">
            {FIT_INTENT.map((f) => <option key={f} value={f}>{f || "—"}</option>)}
          </select>
          {num(draft.ease_chest_cm, (n) => setDraft({ ...draft, ease_chest_cm: n }))}
          {num(draft.ease_waist_cm, (n) => setDraft({ ...draft, ease_waist_cm: n }))}
          {num(draft.ease_shoulder_cm, (n) => setDraft({ ...draft, ease_shoulder_cm: n }))}
          {num(draft.ease_length_cm, (n) => setDraft({ ...draft, ease_length_cm: n }))}
          <button onClick={() => save(draft)} className="rounded-md bg-accent/20 px-3 py-1 text-[11px] text-foreground/85 hover:bg-accent/30">Add</button>
        </div>
        <p className="mt-2 text-[9.5px] uppercase tracking-wider text-foreground/45">
          gender · cat · sub · intent · chest · waist · shoulder · length
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/15">
        <table className="w-full text-[11px]">
          <thead className="bg-background/40 text-left text-foreground/65">
            <tr>
              <th className="px-2 py-2">Gender</th>
              <th className="px-2 py-2">Cat</th>
              <th className="px-2 py-2">Sub</th>
              <th className="px-2 py-2">Intent</th>
              <th className="px-1 py-2">Chest</th>
              <th className="px-1 py-2">Waist</th>
              <th className="px-1 py-2">Hip</th>
              <th className="px-1 py-2">Shldr</th>
              <th className="px-1 py-2">Length</th>
              <th className="px-1 py-2">Active</th>
              <th className="px-2 py-2 text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/10">
                <td className="px-2 py-2 text-foreground/80">{r.gender}</td>
                <td className="px-2 py-2 text-foreground/80">{r.category}</td>
                <td className="px-2 py-2 text-foreground/65">{r.subcategory || "—"}</td>
                <td className="px-2 py-2 text-foreground/65">{r.fit_intent || "—"}</td>
                <td className="px-1 py-2">{num(r.ease_chest_cm, (n) => save({ ...r, ease_chest_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.ease_waist_cm, (n) => save({ ...r, ease_waist_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.ease_hip_cm, (n) => save({ ...r, ease_hip_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.ease_shoulder_cm, (n) => save({ ...r, ease_shoulder_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.ease_length_cm, (n) => save({ ...r, ease_length_cm: n }))}</td>
                <td className="px-1 py-2"><input type="checkbox" checked={!!r.is_active} onChange={(e) => save({ ...r, is_active: e.target.checked })} /></td>
                <td className="px-2 py-2 text-right">
                  <button onClick={() => remove(r)} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
