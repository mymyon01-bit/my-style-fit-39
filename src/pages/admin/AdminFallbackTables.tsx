import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/admin/audit";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id?: string;
  gender: string;
  category: string;
  size_label: string;
  chest_cm?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  shoulder_cm?: number | null;
  sleeve_cm?: number | null;
  length_cm?: number | null;
  inseam_cm?: number | null;
  thigh_cm?: number | null;
  rise_cm?: number | null;
  source?: string | null;
};

const GENDERS = ["male", "female", "unisex"];
const CATEGORIES = ["top", "bottom", "dress", "outerwear"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const BLANK: Row = { gender: "male", category: "top", size_label: "M", source: "manual" };

export default function AdminFallbackTables() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Row>(BLANK);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("fit_fallback_tables")
      .select("*")
      .order("gender").order("category").order("size_label");
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  async function save(row: Row) {
    const before = rows.find((r) => r.id === row.id) ?? null;
    const { data, error } = await supabase.from("fit_fallback_tables").upsert(row).select().maybeSingle();
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: row.id ? "update" : "create",
      targetTable: "fit_fallback_tables",
      targetId: data?.id ?? row.id ?? `${row.gender}_${row.category}_${row.size_label}`,
      before,
      after: data ?? row,
    });
    toast.success("Saved");
    if (!row.id) setDraft(BLANK);
    load();
  }

  async function remove(row: Row) {
    if (!row.id) return;
    if (!confirm("Delete this fallback row?")) return;
    const { error } = await supabase.from("fit_fallback_tables").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAdminAction({ action: "delete", targetTable: "fit_fallback_tables", targetId: row.id, before: row });
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
        className="w-14 rounded border border-border/25 bg-background/40 px-1 py-1 text-[11px]"
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
        <h1 className="text-lg font-display text-foreground/80">Fallback Tables</h1>
        <span className="text-[11px] text-foreground/60">{rows.length} entries</span>
      </div>
      <p className="text-[11px] text-foreground/60">
        Baseline garment measurements used when a product has no scraped size data.
      </p>

      <div className="rounded-xl border border-accent/20 bg-card/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent/70" />
          <p className="text-[12px] font-medium text-foreground/80">Add fallback</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })} className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]">
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={draft.size_label} onChange={(e) => setDraft({ ...draft, size_label: e.target.value })} className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]">
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => save(draft)} className="rounded-md bg-accent/20 px-3 py-1 text-[11px] text-foreground/85 hover:bg-accent/30">Add</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/15">
        <table className="w-full text-[11px]">
          <thead className="bg-background/40 text-left text-foreground/65">
            <tr>
              <th className="px-2 py-2">Gender</th>
              <th className="px-2 py-2">Cat</th>
              <th className="px-2 py-2">Size</th>
              <th className="px-1 py-2">Chest</th>
              <th className="px-1 py-2">Waist</th>
              <th className="px-1 py-2">Hip</th>
              <th className="px-1 py-2">Shldr</th>
              <th className="px-1 py-2">Slv</th>
              <th className="px-1 py-2">Len</th>
              <th className="px-1 py-2">Inseam</th>
              <th className="px-1 py-2">Thigh</th>
              <th className="px-1 py-2">Rise</th>
              <th className="px-2 py-2 text-right">—</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/10">
                <td className="px-2 py-2 text-foreground/80">{r.gender}</td>
                <td className="px-2 py-2 text-foreground/80">{r.category}</td>
                <td className="px-2 py-2 text-foreground/85">{r.size_label}</td>
                <td className="px-1 py-2">{num(r.chest_cm, (n) => save({ ...r, chest_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.waist_cm, (n) => save({ ...r, waist_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.hip_cm, (n) => save({ ...r, hip_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.shoulder_cm, (n) => save({ ...r, shoulder_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.sleeve_cm, (n) => save({ ...r, sleeve_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.length_cm, (n) => save({ ...r, length_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.inseam_cm, (n) => save({ ...r, inseam_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.thigh_cm, (n) => save({ ...r, thigh_cm: n }))}</td>
                <td className="px-1 py-2">{num(r.rise_cm, (n) => save({ ...r, rise_cm: n }))}</td>
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
