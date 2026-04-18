/**
 * WARDROBE diagnostics — fire-and-forget client telemetry.
 *
 * Goals:
 *  - Never throw, never block the UI thread.
 *  - Batch writes so a noisy page doesn't hammer the DB.
 *  - Capture only operational data (event name, status, duration, small JSON).
 *    NO PII, NO message bodies, NO auth tokens.
 *
 * Read access is admin-only (RLS); inserts are open so we can capture
 * failures even from guest sessions.
 */
import { supabase } from "@/integrations/supabase/client";

export type DiagnosticStatus = "success" | "partial" | "error";

export interface DiagnosticEvent {
  event_name: string;
  status?: DiagnosticStatus;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

interface QueuedEvent extends DiagnosticEvent {
  user_id: string | null;
  status: DiagnosticStatus;
  metadata: Record<string, unknown>;
}

const QUEUE: QueuedEvent[] = [];
const FLUSH_AFTER_MS = 1500;
const FLUSH_AFTER_COUNT = 8;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cachedUserId: string | null | undefined; // undefined = not yet resolved

async function resolveUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { data } = await supabase.auth.getUser();
    cachedUserId = data?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

// Invalidate cached id when auth state changes so events get attributed
// to the right user (and to null after sign-out).
supabase.auth.onAuthStateChange((_evt, session) => {
  cachedUserId = session?.user?.id ?? null;
});

async function flush() {
  if (QUEUE.length === 0) return;
  const batch = QUEUE.splice(0, QUEUE.length);
  flushTimer = null;
  try {
    // Best-effort insert. If RLS or network fails, swallow the error —
    // diagnostics must never break the app. Cast through unknown because
    // generated `Json` type is recursive and our metadata is loosely typed.
    await supabase
      .from("diagnostics_events")
      .insert(batch as unknown as Parameters<typeof supabase.from<"diagnostics_events">>[0] extends never ? never : never[]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[diagnostics] flush failed", err);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_AFTER_MS);
}

/**
 * Record a single diagnostic event. Returns immediately; the actual write
 * is batched and best-effort. Safe to call on every render path.
 *
 * Keep `metadata` small (< ~1KB) and free of PII.
 */
export function recordEvent(event: DiagnosticEvent): void {
  try {
    const queued: QueuedEvent = {
      event_name: event.event_name,
      status: event.status ?? "success",
      duration_ms: typeof event.duration_ms === "number" ? Math.round(event.duration_ms) : undefined,
      metadata: event.metadata ?? {},
      user_id: null,
    };
    QUEUE.push(queued);

    // Resolve user id lazily; attach to all queued events that lack one.
    void resolveUserId().then((uid) => {
      if (!uid) return;
      for (const e of QUEUE) if (e.user_id == null) e.user_id = uid;
    });

    if (QUEUE.length >= FLUSH_AFTER_COUNT) {
      void flush();
    } else {
      scheduleFlush();
    }
  } catch {
    // never throw from a logger
  }
}

/**
 * Convenience: time an async operation and record a single event with the
 * resulting duration + status. Re-throws the original error so call sites
 * keep their normal control flow.
 */
export async function trackAsync<T>(
  event_name: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    recordEvent({
      event_name,
      status: "success",
      duration_ms: performance.now() - start,
      metadata: meta,
    });
    return result;
  } catch (err) {
    recordEvent({
      event_name,
      status: "error",
      duration_ms: performance.now() - start,
      metadata: { ...(meta ?? {}), error: (err as Error)?.message?.slice(0, 200) || "unknown" },
    });
    throw err;
  }
}

// Flush any pending events when the tab is being hidden / closed.
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => {
    void flush();
  });
}
