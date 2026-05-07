import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export interface FitMemory {
  id: string;
  user_id: string;
  preferred_fit: string | null;
  oversized_tolerance: number;
  preferred_inseam_cm: number | null;
  preferred_rise: string | null;
  small_running_brands: string[];
  large_running_brands: string[];
  liked_silhouettes: string[];
  disliked_silhouettes: string[];
  reference_garments: any[];
  computed_at: string;
}

/**
 * V4.3 Fit Memory — derives a personal fit profile from fit_feedback +
 * style_profiles. Cached in the `fit_memory` table.
 *
 * Heuristic only; downstream size correlation engine should treat these
 * fields as soft hints rather than hard rules.
 */
export function useFitMemory() {
  const { user } = useAuth();
  const [memory, setMemory] = useState<FitMemory | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setMemory(null); setLoading(false); return; }
    const { data } = await supabase
      .from("fit_memory")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setMemory(data as FitMemory | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /**
   * Recompute the user's fit memory from raw signals.
   * - aggregates fit_feedback to detect "runs small" / "runs large" brands
   * - pulls preferred_fit from style_profiles
   * - records favorite reference garments (high satisfaction items)
   */
  const recompute = useCallback(async () => {
    if (!user) return null;

    const [{ data: feedback }, { data: style }] = await Promise.all([
      supabase
        .from("fit_feedback")
        .select("brand, satisfaction, feedback_type, recommended_size, chosen_size, product_key, category")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("style_profiles")
        .select("preferred_fit")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const small = new Set<string>();
    const large = new Set<string>();
    const refs: any[] = [];

    for (const f of feedback || []) {
      const brand = (f as any).brand?.toString().trim();
      const ft = (f as any).feedback_type;
      if (brand) {
        if (ft === "tight" || ft === "small") small.add(brand);
        if (ft === "loose" || ft === "large") large.add(brand);
      }
      if ((f as any).satisfaction && (f as any).satisfaction >= 4) {
        refs.push({
          product_key: (f as any).product_key,
          brand,
          size: (f as any).chosen_size || (f as any).recommended_size,
          fit_label: ft,
        });
      }
    }

    const payload = {
      user_id: user.id,
      preferred_fit: (style as any)?.preferred_fit || null,
      small_running_brands: Array.from(small).slice(0, 30),
      large_running_brands: Array.from(large).slice(0, 30),
      reference_garments: refs.slice(0, 20),
      computed_at: new Date().toISOString(),
    };

    const { data } = await supabase
      .from("fit_memory")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .maybeSingle();
    setMemory(data as FitMemory | null);
    return data as FitMemory | null;
  }, [user]);

  return { memory, loading, reload: load, recompute };
}
