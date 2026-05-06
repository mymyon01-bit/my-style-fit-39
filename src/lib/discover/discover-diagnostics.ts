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
  | "discover_ladder_complete"
  | "discover_kr_translated";

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

/**
 * Logged once per DB-first selector pass. Captures EXACTLY what Phase 10
 * of the upgrade spec asks for: raw, normalized, tokens, expanded tokens,
 * locked category, DB result count, fallback stage, and the top product
 * ids returned (truncated to 10 to keep the row small).
 */
export interface GridRenderDiagnostic {
  query: string;
  normalized: string;
  tokens: string[];
  expandedTokens: string[];
  lockedCategory: string | null;
  dbResultCount: number;
  fallbackStage: "tokens" | "longest-token" | "recent" | "category-ilike" | "trending";
  topProductIds: string[];
  layer?: "db" | "live" | "looks";
}

export function logGridRender(d: GridRenderDiagnostic): void {
  // Always console-log during this rollout pass — admin diagnostics page
  // can read the same data from `diagnostics_events` afterwards.
  // eslint-disable-next-line no-console
  console.log("[discover_grid_render]", {
    raw: d.query,
    normalized: d.normalized,
    tokens: d.tokens,
    expanded: d.expandedTokens,
    locked: d.lockedCategory,
    count: d.dbResultCount,
    stage: d.fallbackStage,
    topIds: d.topProductIds.slice(0, 5),
  });
  logDiscoverEvent("discover_grid_render", {
    query: d.query,
    layer: d.layer ?? "db",
    metadata: {
      normalized: d.normalized,
      tokens: d.tokens,
      expanded_tokens: d.expandedTokens,
      locked_category: d.lockedCategory,
      db_result_count: d.dbResultCount,
      fallback_stage: d.fallbackStage,
      top_product_ids: d.topProductIds.slice(0, 10),
    },
  });
}
