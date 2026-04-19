/**
 * Discover diagnostics
 * --------------------
 * Thin façade over the global `recordEvent` so every Discover-layer hook
 * logs to a consistent event namespace and metadata shape. Makes the admin
 * Diagnostics page queryable by `event_name LIKE 'discover_%'`.
 */
import { recordEvent } from "@/lib/diagnostics";
import type { ParsedDiscoverQuery } from "./discover-query-parser";

export type DiscoverEventName =
  | "discover_query_parsed"
  | "discover_query_interpreted"
  | "discover_search_started"
  | "discover_search_progress"
  | "discover_search_complete"
  | "discover_grid_render"
  | "discover_search_failed"
  | "discover_orchestrator_live"
  | "discover_orchestrator_cron"
  | "discover_ladder_complete";

export interface DiscoverEventPayload {
  query: string;
  layer?: "db" | "live" | "looks";
  status?: "success" | "partial" | "error";
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export function logDiscoverEvent(name: DiscoverEventName, payload: DiscoverEventPayload): void {
  recordEvent({
    event_name: name,
    status: payload.status ?? "success",
    duration_ms: payload.durationMs,
    metadata: {
      query: payload.query,
      layer: payload.layer ?? "live",
      ...(payload.metadata || {}),
    },
  });
}

export function logQueryParsed(parsed: ParsedDiscoverQuery): void {
  logDiscoverEvent("discover_query_parsed", {
    query: parsed.raw,
    metadata: {
      query_type: parsed.queryType,
      primary_category: parsed.primaryCategory,
      brand: parsed.brand,
      color: parsed.color,
      scenario: parsed.scenario,
      fit: parsed.fit,
      style_modifiers: parsed.styleModifiers,
    },
  });
}
