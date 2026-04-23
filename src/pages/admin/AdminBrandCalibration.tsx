import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/admin/audit";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Brand = {
  id?: string;
  brand: string;
  fit_bias: string;
  chest_adjustment_cm: number;
  waist_adjustment_cm: number;
  shoulder_adjustment_cm: number;
  length_adjustment_cm: number;
  hip_adjustment_cm: number;
  inseam_adjustment_cm: number;
  notes?: string | null;
  is_active?: boolean;
};

const BIAS = ["runs_small", "true_to_size", "runs_large"] as const;

const BLANK: Brand = {
  brand: "",
  fit_bias: "true_to_size",
  chest_adjustment_cm: 0,
  waist_adjustment_cm: 0,
  shoulder_adjustment_cm: 0,
  length_adjustment_cm: 0,
  hip_adjustment_cm: 0,
  inseam_adjustment_cm: 0,
  is_active: true,
};

export default function AdminBrandCalibration() {
  const [rows, setRows] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Brand>(BLANK);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("brand_fit_profiles").select("*").order("brand");
    setRows((data as Brand[]) ?? []);
    setLoading(false);
  }

  async function save(row: Brand) {
    const before = rows.find((r) => r.id === row.id) ?? null;
    const { error, data } = await supabase
      .from("brand_fit_profiles")
      .upsert({ ...row })
      .select()
      .maybeSingle();
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: row.id ? "update" : "create",
      targetTable: "brand_fit_profiles",
      targetId: data?.id ?? row.id ?? row.brand,
      before,
      after: data ?? row,
    });
    toast.success("Saved");
    if (!row.id) setDraft(BLANK);
    load();
  }

  async function remove(row: Brand) {
    if (!row.id) return;
    if (!confirm(`Delete brand calibration for ${row.brand}?`)) return;
    const { error } = await supabase.from("brand_fit_profiles").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAdminAction({ action: "delete", targetTable: "brand_fit_profiles", targetId: row.id, before: row });
    toast.success("Deleted");
    load();
  }

  function field(value: number, onChange: (n: number) => void) {
    return (
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px] text-foreground/85 outline-none"
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
        <h1 className="text-lg font-display text-foreground/80">Brand Calibration</h1>
        <span className="text-[11px] text-foreground/60">{rows.length} brands</span>
      </div>
      <p className="text-[11px] text-foreground/60">
        Adjustments correct real-world brand sizing differences. Positive cm values = brand runs larger than baseline.
      </p>

      {/* New brand row */}
      <div className="rounded-xl border border-accent/20 bg-card/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent/70" />
          <p className="text-[12px] font-medium text-foreground/80">Add brand profile</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
          <input
            placeholder="Brand"
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            className="rounded border border-border/25 bg-background/40 px-2 py-1 text-[12px] outline-none"
          />
          <select
            value={draft.fit_bias}
            onChange={(e) => setDraft({ ...draft, fit_bias: e.target.value })}
            className="rounded border border-border/25 bg-background/40 px-1.5 py-1 text-[11px]"
          >
            {BIAS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {field(draft.chest_adjustment_cm, (n) => setDraft({ ...draft, chest_adjustment_cm: n }))}
          {field(draft.waist_adjustment_cm, (n) => setDraft({ ...draft, waist_adjustment_cm: n }))}
          {field(draft.shoulder_adjustment_cm, (n) => setDraft({ ...draft, shoulder_adjustment_cm: n }))}
          {field(draft.length_adjustment_cm, (n) => setDraft({ ...draft, length_adjustment_cm: n }))}
          {field(draft.hip_adjustment_cm, (n) => setDraft({ ...draft, hip_adjustment_cm: n }))}
          {field(draft.inseam_adjustment_cm, (n) => setDraft({ ...draft, inseam_adjustment_cm: n }))}
          <button
            onClick={() => draft.brand && save(draft)}
            className="rounded-md bg-accent/20 px-3 py-1 text-[11px] text-foreground/85 hover:bg-accent/30"
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-[9.5px] uppercase tracking-wider text-foreground/45">
          brand · bias · chest · waist · shoulder · length · hip · inseam
        </p>
      </div>

      {/* Existing rows */}
      <div className="overflow-x-auto rounded-xl border border-border/15">
        <table className="w-full text-[11px]">
          <thead className="bg-background/40 text-left text-foreground/65">
            <tr>
              <th className="px-3 py-2">Brand</th>
              <th className="px-2 py-2">Bias</th>
              <th className="px-1 py-2">Chest</th>
              <th className="px-1 py-2">Waist</th>
              <th className="px-1 py-2">Shldr</th>
              <th className="px-1 py-2">Length</th>
              <th className="px-1 py-2">Hip</th>
              <th className="px-1 py-2">Inseam</th>
              <th className="px-2 py-2">Active</th>
              <th className="px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/10">
                <td className="px-3 py-2 text-foreground/85">{r.brand}</td>
                <td className="px-2 py-2">
                  <select
                    value={r.fit_bias}
                    onChange={(e) => save({ ...r, fit_bias: e.target.value })}
                    className="rounded border border-border/25 bg-background/40 px-1 py-0.5 text-[10.5px]"
                  >
                    {BIAS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                <td className="px-1 py-2">{field(r.chest_adjustment_cm, (n) => save({ ...r, chest_adjustment_cm: n }))}</td>
                <td className="px-1 py-2">{field(r.waist_adjustment_cm, (n) => save({ ...r, waist_adjustment_cm: n }))}</td>
                <td className="px-1 py-2">{field(r.shoulder_adjustment_cm, (n) => save({ ...r, shoulder_adjustment_cm: n }))}</td>
                <td className="px-1 py-2">{field(r.length_adjustment_cm, (n) => save({ ...r, length_adjustment_cm: n }))}</td>
                <td className="px-1 py-2">{field(r.hip_adjustment_cm, (n) => save({ ...r, hip_adjustment_cm: n }))}</td>
                <td className="px-1 py-2">{field(r.inseam_adjustment_cm, (n) => save({ ...r, inseam_adjustment_cm: n }))}</td>
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={!!r.is_active}
                    onChange={(e) => save({ ...r, is_active: e.target.checked })}
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => remove(r)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                  >
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
