import { useCallback, useEffect, useState } from "react";

const PREFIX = "ootd:info:";
const VERSION = "v1";
const CHANGE_EVENT = "ootd:info-card-changed";

function key(id: string) { return `${PREFIX}${id}:seen=${VERSION}`; }

export function isInfoCardSeen(id: string): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(key(id)) === "1"; } catch { return true; }
}

export function markInfoCardSeen(id: string) {
  try {
    localStorage.setItem(key(id), "1");
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id } }));
  } catch { /* ignore */ }
}

/** Reset all OOTD info cards so they show again. */
export function resetAllInfoCards() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
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
