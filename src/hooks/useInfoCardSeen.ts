import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "ootd:info:";
const VERSION = "v1";
const CHANGE_EVENT = "ootd:info-card-changed";
const SYNC_FLAG = "ootd:info:synced";

function key(id: string) { return `${PREFIX}${id}:seen=${VERSION}`; }

export function isInfoCardSeen(id: string): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(key(id)) === "1"; } catch { return true; }
}

/** Mark dismissed locally only (this device + version). */
export function markInfoCardSeen(id: string) {
  try {
    localStorage.setItem(key(id), "1");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id } }));
  } catch { /* ignore */ }
}

/**
 * Mark dismissed PERMANENTLY across all devices/app versions.
 * Persists to the user's profile so the notice never shows again on any
 * device, web/Android/iOS, after they sign in.
 */
export async function markInfoCardSeenForever(id: string) {
  markInfoCardSeen(id);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("dismissed_info_cards")
      .eq("user_id", user.id)
      .maybeSingle();
    const current: string[] = ((prof as any)?.dismissed_info_cards ?? []) as string[];
    if (current.includes(id)) return;
    await supabase
      .from("profiles")
      .update({ dismissed_info_cards: [...current, id] } as any)
      .eq("user_id", user.id);
  } catch { /* ignore */ }
}

/** Reset all OOTD info cards locally and (if signed in) on the user's profile. */
export async function resetAllInfoCards() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(SYNC_FLAG);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: "*" } }));
  } catch { /* ignore */ }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ dismissed_info_cards: [] } as any).eq("user_id", user.id);
  } catch { /* ignore */ }
}

/** Pull remote dismissed list into localStorage on first OOTD load. */
export async function syncDismissedInfoCardsFromProfile() {
  if (typeof window === "undefined") return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("dismissed_info_cards")
      .eq("user_id", user.id)
      .maybeSingle();
    const remote: string[] = ((data as any)?.dismissed_info_cards ?? []) as string[];
    remote.forEach((id) => {
      try { localStorage.setItem(key(id), "1"); } catch {}
    });
    localStorage.setItem(SYNC_FLAG, "1");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: "*" } }));
  } catch { /* ignore */ }
}

/** Reactive helper: returns whether the card should be visible. */
export function useInfoCardSeen(id: string) {
  const [seen, setSeen] = useState(() => isInfoCardSeen(id));

  useEffect(() => {
    const handler = () => setSeen(isInfoCardSeen(id));
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [id]);

  const dismiss = useCallback(() => markInfoCardSeen(id), [id]);
  return { seen, dismiss };
}
