import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StarAction = "share_ootd" | "discover_import" | "join_circle";

const LABELS: Record<StarAction, string> = {
  share_ootd: "Shared #OOTD",
  discover_import: "Imported from Discover",
  join_circle: "Joined a Circle",
};

/**
 * Try to claim a daily +1 star reward for an action. Silently no-ops if the
 * user is logged out or has already claimed today. Shows a small toast on
 * success so users see the reward.
 */
export async function claimStarAction(action: StarAction): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase.rpc("claim_star_action", { _action: action });
    if (error) return false;
    const ok = (data as any)?.ok === true;
    if (ok) {
      toast.success(`+1 ⭐ · ${LABELS[action]}`, { duration: 2200 });
    }
    return ok;
  } catch {
    return false;
  }
}
