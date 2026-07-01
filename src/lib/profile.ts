import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MyProfile = Database["public"]["Tables"]["profiles"]["Row"];

// Sensitive profile fields (phone, birthdate, gender, star balance, dismissed
// cards, etc.) are no longer directly readable via `select` — the underlying
// column grants were revoked so that other authenticated users can't scrape
// them. Callers now go through the `get_my_profile` SECURITY DEFINER RPC,
// which returns the full row for the caller only.
//
// We cache the result per-session and let callers opt into a refresh.

let cache: MyProfile | null = null;
let inflight: Promise<MyProfile | null> | null = null;

export async function getMyProfile(opts: { refresh?: boolean } = {}): Promise<MyProfile | null> {
  if (!opts.refresh && cache) return cache;
  if (!opts.refresh && inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase.rpc("get_my_profile");
    if (error) {
      inflight = null;
      return cache; // fall back to any prior value on transient errors
    }
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as MyProfile) : null;
    cache = row;
    inflight = null;
    return row;
  })();

  return inflight;
}

export function invalidateMyProfile() {
  cache = null;
  inflight = null;
}
