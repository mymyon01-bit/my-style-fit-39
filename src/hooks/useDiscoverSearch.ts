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
import { interpretQuery } from "@/lib/discover/discover-interpreter";
import { expandDiscoverQuery, type ExpansionPlan } from "@/lib/discover/discover-query-expander";
import { loadSeenContext, markRendered } from "@/lib/discover/discover-seen-filter";
import {
  logDiscoverEvent,
  logQueryParsed,
} from "@/lib/discover/discover-diagnostics";
import { upsertCluster } from "@/lib/search/query-cluster-service";
import { parseIntent, summarizeIntent, type ParsedIntent } from "@/lib/discover/discover-intent-parser";
import { runSearchLadder, type LadderStage } from "@/lib/discover/discover-search-ladder";
import { shouldUseAiFallback, expandIntentWithAi, mergeAiIntoIntent } from "@/lib/discover/discover-intent-ai";
import { enforceDiversity } from "@/lib/discover/rankResults";
import { detectLuxuryBrand } from "@/lib/discover/luxuryBrands";
import { assessQueryCoverage } from "@/lib/discover/queryHealth";
import { interpretQueryWithAI } from "@/lib/discover/aiQueryInterpreter";
import { triggerAutoDiscovery, loadCachedInterpretation } from "@/lib/discover/triggerAutoDiscovery";
import { parseGenderIntent, prioritizeGenderPool, type GenderFilter } from "@/lib/discover/genderFilter";
import { translateQueryToEn } from "@/lib/discover/translateQueryToEn";
import { isKoreanQuery } from "@/lib/discover/krAliasMap";
import { supabase } from "@/integrations/supabase/client";

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
  /** Gender filter applied to live results ("all" | "women" | "men"). */
  gender?: GenderFilter;
}

export interface DiscoverSearchState {
  query: string;
  parsed: ParsedDiscoverQuery | null;
  expansion: ExpansionPlan | null;
  intent: ParsedIntent | null;
  intentChips: string[];
  intentFallback: "alias" | "ai" | null;
  ladderStage: LadderStage | null;
  results: DiscoverRenderableProduct[];
  diagnostics: (DiscoverGridDiagnostics & { query: string }) | null;
  status: "idle" | "searching" | "partial" | "complete" | "error";
  errorMessage: string | null;
  /** Number of new products silently appended after a background refresh. */
  appendedCount: number;
  /** True while the background refresh re-query is in flight. */
  isRefreshing: boolean;
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
  intent: null,
  intentChips: [],
  intentFallback: null,
  ladderStage: null,
  results: [],
  diagnostics: null,
  status: "idle",
  errorMessage: null,
  appendedCount: 0,
  isRefreshing: false,
};

export function useDiscoverSearch(opts: UseDiscoverSearchOptions = {}): UseDiscoverSearchResult {
  const windowSize = opts.windowSize ?? DEFAULT_WINDOW;
  const minFreshRatio = opts.minFreshRatio ?? 0.4;
  const target = opts.target ?? 60;
  const maxCycles = opts.maxCycles ?? 4;
  const gender: GenderFilter = opts.gender ?? "all";

  const [state, setState] = useState<DiscoverSearchState>(INITIAL_STATE);
  const runIdRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);

  const applySession = useCallback(
    (session: SearchSession, dbSeen: Set<string>, status: DiscoverSearchState["status"]) => {
      let renderables = buildDiscoverRenderables(session, dbSeen);
      // Query-level gender intent OVERRIDES the toggle when toggle === "all".
      const queryGender = parseGenderIntent(session.query);
      const effectiveGender: GenderFilter = queryGender ?? gender;
      // Gender filter applied to the renderable pool BEFORE composition.
      if (effectiveGender !== "all") {
        renderables = prioritizeGenderPool(renderables as never[], effectiveGender).slice();
      }
      const composed = composeDiscoverGrid(renderables, { windowSize, minFreshRatio });
      // Enforce source/brand diversity caps on the visible window (35%/30%).
      const diversified = enforceDiversity(composed, windowSize);
      const diagnostics = buildDiscoverGridDiagnostics(session, renderables, diversified.slice(0, windowSize));
      setState((prev) => ({
        ...prev,
        results: diversified,
        diagnostics: { query: session.query, ...diagnostics },
        status,
      }));
    },
    [gender, minFreshRatio, windowSize],
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

      // Deterministic intent (KR/EN aliases, mood, family) — drives chips + ladder.
      let intent = parseIntent(trimmed);
      const usedAlias = intent.enAliases.length > 0;
      const initialChips = summarizeIntent(intent);
      const initialFallback: DiscoverSearchState["intentFallback"] = usedAlias ? "alias" : null;

      logQueryParsed(parsed);
      logDiscoverEvent("discover_search_started", {
        query: trimmed,
        metadata: {
          query_type: parsed.queryType,
          category_lock: lock,
          variant_count: expansion.variants.length,
          intent_category: intent.primaryCategory,
          intent_language: intent.language,
        },
      });

      // Optional AI fallback — only for vague unknowns; never blocks.
      if (shouldUseAiFallback(intent)) {
        void expandIntentWithAi(trimmed).then((ai) => {
          if (!ai || runIdRef.current !== runId) return;
          intent = mergeAiIntoIntent(intent, ai);
          setState((prev) => ({
            ...prev,
            intent,
            intentChips: summarizeIntent(intent),
            intentFallback: "ai",
          }));
        }).catch((err) => console.warn("[useDiscoverSearch] AI fallback failed", err));
      }

      // Background interpreter logging (KR/EN alias diagnostic) — fire-and-forget.
      void interpretQuery(trimmed)
        .then((interp) => {
          logDiscoverEvent("discover_query_interpreted", {
            query: trimmed,
            metadata: {
              category: interp.category,
              language: interp.language,
              ai_assisted: interp.aiAssisted,
              style_tags: interp.style,
              product_types: interp.productTypes,
            },
          });
        })
        .catch((err) => console.warn("[useDiscoverSearch] interpretQuery failed", err));

      setState({
        query: trimmed,
        parsed,
        expansion,
        intent,
        intentChips: initialChips,
        intentFallback: initialFallback,
        ladderStage: null,
        results: [],
        diagnostics: null,
        status: "searching",
        errorMessage: null,
        appendedCount: 0,
        isRefreshing: false,
      });

      const session = createSearchSession(trimmed);
      if (lock) session.categoryLock = lock;

      // Fire-and-forget cache warmer (Apify/CSE).
      void supabase.functions.invoke("discover-search-engine", { body: { query: trimmed } })
        .catch((err) => console.warn("[useDiscoverSearch] discover-search-engine kick failed", err));

      // Luxury brand boost — only triggers when query mentions a known luxury
      // brand (e.g. "Gucci shirt", "버버리 트렌치"). Reuses legal sources
      // (SerpAPI / Apify / Perplexity+Firecrawl) and caches results 6h.
      const luxury = detectLuxuryBrand(trimmed);
      if (luxury.isLuxury) {
        void supabase.functions.invoke("discover-luxury", { body: { query: trimmed } })
          .catch((err) => console.warn("[useDiscoverSearch] discover-luxury kick failed", err));
      }

      // Ladder seed — paint Live grid INSTANTLY from cache while runSearch warms up.
      void runSearchLadder(intent).then((ladder) => {
        if (runIdRef.current !== runId) return;
        setState((prev) => ({ ...prev, ladderStage: ladder.stageReached }));
        logDiscoverEvent("discover_ladder_complete", {
          query: trimmed,
          metadata: {
            stage: ladder.stageReached,
            pool_size: ladder.poolSize,
            per_stage: ladder.perStageCounts,
          },
        });
      }).catch((err) => console.warn("[useDiscoverSearch] ladder failed", err));

      // ── KR → EN parallel search ──
      // When the user types in Korean, translate the query into 3-5 natural
      // English queries (LLM) and fan out searches against EN-only sources
      // in parallel. Results are merged into the SAME session so the live
      // grid grows without a second render loop.
      if (isKoreanQuery(trimmed)) {
        void translateQueryToEn(trimmed).then(async (enQueries) => {
          if (runIdRef.current !== runId || enQueries.length === 0) return;
          logDiscoverEvent("discover_kr_translated", {
            query: trimmed,
            metadata: { en_queries: enQueries },
          });
          // Run each EN variant against the same session — appendToSession
          // dedupes, so duplicates are harmless.
          await Promise.all(
            enQueries.map((eq) =>
              runSearch(session, { target: 30, maxCycles: 1, onProgress: (next) => {
                if (runIdRef.current !== runId) return;
                applySession(next, dbSeen, "partial");
              } }).catch((err) =>
                console.warn("[useDiscoverSearch] EN translated runSearch failed", eq, err),
              ),
            ),
          );
          if (runIdRef.current !== runId) return;
          applySession(session, dbSeen, "complete");
        }).catch((err) => console.warn("[useDiscoverSearch] translate failed", err));
      }


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
        const completedCount = session.results.length;

        // ── AUTO AI EXPANSION + BACKGROUND INGESTION ────────────────────
        // Assess coverage of what we just rendered. If the grid is thin or
        // not fresh enough, ask the AI to interpret the query and fan out
        // discovery in the background. Never blocks the UI.
        try {
          const candidateCount = session.results.length;
          // Best-effort visible/fresh estimates (use windowSize and rendered fresh from session).
          const visibleCount = Math.min(candidateCount, windowSize);
          const freshCount = session.results.filter((r) => {
            const ts = r.createdAt ? new Date(r.createdAt).getTime() : 0;
            return ts > 0 && Date.now() - ts < 72 * 3600 * 1000;
          }).length;
          const strongImageCount = session.results
            .slice(0, windowSize)
            .filter((r) => typeof r.imageUrl === "string" && r.imageUrl.length > 10).length;
          const coverage = assessQueryCoverage({
            query: trimmed,
            candidateCount,
            visibleCount,
            lockedCategory: lock,
            freshCount,
            strongImageCount,
          });
          if (coverage.isWeak) {
            void (async () => {
              const cached = await loadCachedInterpretation(parsed.normalized);
              const interpreted = cached
                ? // Reuse cached: still call AI only if cache is stale (>24h) — for now, reuse always.
                  await interpretQueryWithAI(trimmed)
                : await interpretQueryWithAI(trimmed);
              const auto = await triggerAutoDiscovery({
                query: trimmed,
                interpreted,
                reason: coverage.reason,
              });
              if (!auto.shouldRefresh) return;
              if (runIdRef.current !== runId) return;
              // ── SOFT REFRESH ──
              // Wait for ingestion to land (no polling) and re-run search ONCE
              // so newly inserted rows surface as "appended" in the live grid.
              if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
              setState((prev) => ({ ...prev, isRefreshing: true }));
              refreshTimerRef.current = window.setTimeout(async () => {
                if (runIdRef.current !== runId) return;
                try {
                  const refreshSession = createSearchSession(trimmed);
                  if (lock) refreshSession.categoryLock = lock;
                  await runSearch(refreshSession, { target, maxCycles: 2 });
                  if (runIdRef.current !== runId) return;
                  const beforeCount = completedCount;
                  const newCount = Math.max(0, refreshSession.results.length - beforeCount);
                  applySession(refreshSession, dbSeen, "complete");
                  setState((prev) => ({
                    ...prev,
                    appendedCount: prev.appendedCount + newCount,
                    isRefreshing: false,
                  }));
                } catch (err) {
                  console.warn("[useDiscoverSearch] soft refresh failed", err);
                  setState((prev) => ({ ...prev, isRefreshing: false }));
                }
              }, 7000);
            })().catch((err) => console.warn("[useDiscoverSearch] auto-discovery failed", err));
          }
        } catch (err) {
          console.warn("[useDiscoverSearch] coverage assessment failed", err);
        }

        // Background cluster evolution — never blocks the UI. Pushes the
        // top-60 fresh DB-backed UUIDs into query_clusters so future searches
        // see an evolving pool, not a frozen one.
        void upsertCluster({
          query: trimmed,
          category: lock,
          tags: [parsed.queryType, ...parsed.styleModifiers].filter(Boolean),
          products: session.results.slice(0, 60),
        });
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
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  return { ...state, search, markVisibleSeen };
}
