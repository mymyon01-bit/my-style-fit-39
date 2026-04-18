/**
 * useDiscoverSearch
 * -----------------
 * The single hook that wires the Discover pipeline together:
 *
 *   parse  →  guard  →  expand  →  runSearch (existing engine)
 *          →  annotate seen  →  rank / compose  →  diagnostics
 *
 * Sourcing logic lives in /lib/search (search-runner is unchanged).
 * Ranking + grid composition lives in /lib/search/discover-feed.
 * This hook is the public API the new Discover page should consume —
 * the page should not import search-runner directly anymore.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildDiscoverGridDiagnostics,
  buildDiscoverRenderables,
  composeDiscoverGrid,
  type DiscoverGridDiagnostics,
  type DiscoverRenderableProduct,
} from "@/lib/search/discover-feed";
import { runSearch } from "@/lib/search/search-runner";
import {
  createSearchSession,
  type SearchSession,
} from "@/lib/search/search-session";
import { parseDiscoverQuery, type ParsedDiscoverQuery } from "@/lib/discover/discover-query-parser";
import { getCategoryLock } from "@/lib/discover/discover-category-guard";
import { expandDiscoverQuery, type ExpansionPlan } from "@/lib/discover/discover-query-expander";
import { loadSeenContext, markRendered } from "@/lib/discover/discover-seen-filter";
import {
  logDiscoverEvent,
  logQueryParsed,
} from "@/lib/discover/discover-diagnostics";
import { upsertCluster } from "@/lib/search/query-cluster-service";

const DEFAULT_WINDOW = 24;

export interface UseDiscoverSearchOptions {
  /** Window size for the live results grid. */
  windowSize?: number;
  /** Min ratio of fresh+unseen items in the visible window. */
  minFreshRatio?: number;
  /** runSearch target. */
  target?: number;
  /** runSearch hard cycle cap. */
  maxCycles?: number;
}

export interface DiscoverSearchState {
  query: string;
  parsed: ParsedDiscoverQuery | null;
  expansion: ExpansionPlan | null;
  results: DiscoverRenderableProduct[];
  diagnostics: (DiscoverGridDiagnostics & { query: string }) | null;
  status: "idle" | "searching" | "partial" | "complete" | "error";
  errorMessage: string | null;
}

export interface UseDiscoverSearchResult extends DiscoverSearchState {
  /** Trigger a fresh search. Replaces in-flight searches via runId guard. */
  search: (query: string) => Promise<void>;
  /** Mark the currently visible products as seen (call after they hit the DOM). */
  markVisibleSeen: (visible: DiscoverRenderableProduct[]) => Promise<void>;
}

const INITIAL_STATE: DiscoverSearchState = {
  query: "",
  parsed: null,
  expansion: null,
  results: [],
  diagnostics: null,
  status: "idle",
  errorMessage: null,
};

export function useDiscoverSearch(opts: UseDiscoverSearchOptions = {}): UseDiscoverSearchResult {
  const windowSize = opts.windowSize ?? DEFAULT_WINDOW;
  const minFreshRatio = opts.minFreshRatio ?? 0.4;
  const target = opts.target ?? 60;
  const maxCycles = opts.maxCycles ?? 4;

  const [state, setState] = useState<DiscoverSearchState>(INITIAL_STATE);
  const runIdRef = useRef(0);

  const applySession = useCallback(
    (session: SearchSession, dbSeen: Set<string>, status: DiscoverSearchState["status"]) => {
      const renderables = buildDiscoverRenderables(session, dbSeen);
      const composed = composeDiscoverGrid(renderables, { windowSize, minFreshRatio });
      const diagnostics = buildDiscoverGridDiagnostics(session, renderables, composed.slice(0, windowSize));
      setState((prev) => ({
        ...prev,
        results: composed,
        diagnostics: { query: session.query, ...diagnostics },
        status,
      }));
    },
    [minFreshRatio, windowSize],
  );

  const search = useCallback(
    async (rawQuery: string) => {
      const trimmed = (rawQuery || "").trim();
      if (!trimmed) return;
      const runId = ++runIdRef.current;
      const startedAt = performance.now();

      const parsed = parseDiscoverQuery(trimmed);
      const expansion = expandDiscoverQuery(parsed);
      const lock = getCategoryLock(parsed);

      logQueryParsed(parsed);
      logDiscoverEvent("discover_search_started", {
        query: trimmed,
        metadata: {
          query_type: parsed.queryType,
          category_lock: lock,
          variant_count: expansion.variants.length,
        },
      });

      setState({
        query: trimmed,
        parsed,
        expansion,
        results: [],
        diagnostics: null,
        status: "searching",
        errorMessage: null,
      });

      const session = createSearchSession(trimmed);
      // search-runner detects its own lock from the query, but we make it
      // explicit here so style-with-category queries still respect it.
      if (lock) session.categoryLock = lock;

      let dbSeen: Set<string> = new Set();
      try {
        const ctx = await loadSeenContext();
        if (runIdRef.current !== runId) return;
        dbSeen = ctx.dbSeen;
      } catch (err) {
        console.warn("[useDiscoverSearch] loadSeenContext failed", err);
      }

      try {
        await runSearch(session, {
          target,
          maxCycles,
          onProgress: (next) => {
            if (runIdRef.current !== runId) return;
            applySession(next, dbSeen, "partial");
            logDiscoverEvent("discover_search_progress", {
              query: trimmed,
              status: "partial",
              metadata: {
                cycle: next.cycle,
                results_count: next.results.length,
                rejected_by_category: next.rejectedByCategory,
                rejected_by_dedupe: next.rejectedByDedupe,
              },
            });
          },
        });
        if (runIdRef.current !== runId) return;
        applySession(session, dbSeen, "complete");
        logDiscoverEvent("discover_search_complete", {
          query: trimmed,
          status: "success",
          durationMs: Math.round(performance.now() - startedAt),
          metadata: {
            results_count: session.results.length,
            ingested_count: session.ingestedCount,
          },
        });
      } catch (err) {
        if (runIdRef.current !== runId) return;
        const message = err instanceof Error ? err.message : "Discover search failed";
        console.error("[useDiscoverSearch] runSearch failed", err);
        setState((prev) => ({ ...prev, status: "error", errorMessage: message }));
        logDiscoverEvent("discover_search_failed", {
          query: trimmed,
          status: "error",
          metadata: { error_message: message },
        });
      }
    },
    [applySession, maxCycles, target],
  );

  const markVisibleSeen = useCallback(async (visible: DiscoverRenderableProduct[]) => {
    if (visible.length === 0) return;
    await markRendered(visible);
  }, []);

  // Reset on unmount so a stale runId can never apply state.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
    };
  }, []);

  return { ...state, search, markVisibleSeen };
}
