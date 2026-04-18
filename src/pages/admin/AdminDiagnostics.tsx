/**
 * Admin → Diagnostics
 *
 * Surfaces operational health from `diagnostics_events` (admin-only RLS).
 * Read-only. Aggregates the last 24h + last 7d for the three demo flows.
 *
 * NOTE: this is intentionally a single-file panel — no charts, no realtime,
 * no fancy state. It exists so the team can verify the system is healthy
 * before an investor demo.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Camera, Ruler, MessageCircle, RefreshCw, Database } from "lucide-react";

type EventRow = {
  id: string;
  event_name: string;
  status: "success" | "partial" | "error";
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type IngestionRunRow = {
  id: string;
  source: string;
  source_actor: string | null;
  query_family: string | null;
  seed_query: string | null;
  trigger: string;
  fetched_count: number;
  inserted_count: number;
  deduped_count: number;
  failed_count: number;
  status: string;
  duration_ms: number | null;
  started_at: string;
};

const TRACKED_EVENTS = ["search_session", "post_create", "comment_create", "fit_generate"] as const;
type TrackedEvent = (typeof TRACKED_EVENTS)[number];

const EVENT_META: Record<TrackedEvent, { label: string; icon: typeof Search; flow: string }> = {
  search_session: { label: "Search sessions", icon: Search, flow: "Discover (Flow A)" },
  post_create: { label: "OOTD posts", icon: Camera, flow: "Social (Flow B)" },
  comment_create: { label: "Comments", icon: MessageCircle, flow: "Social (Flow B)" },
  fit_generate: { label: "FIT calculations", icon: Ruler, flow: "FIT (Flow C)" },
};

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

function summarize(rows: EventRow[]) {
  const total = rows.length;
  const errors = rows.filter((r) => r.status === "error").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  const success = total - errors - partial;
  const durations = rows
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === "number" && d > 0);
  return {
    total,
    success,
    partial,
    errors,
    successRate: total ? Math.round((success / total) * 100) : 0,
    errorRate: total ? Math.round((errors / total) * 100) : 0,
    medianMs: Math.round(median(durations)),
    p95Ms: Math.round(p95(durations)),
  };
}

export default function AdminDiagnostics() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [ingestionRows, setIngestionRows] = useState<IngestionRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase
        .from("diagnostics_events")
        .select("id, event_name, status, duration_ms, metadata, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("source_ingestion_runs")
        .select(
          "id, source, source_actor, query_family, seed_query, trigger, fetched_count, inserted_count, deduped_count, failed_count, status, duration_ms, started_at",
        )
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(500),
    ]).then(([eventsRes, ingestionRes]) => {
      if (cancelled) return;
      if (eventsRes.error) {
        setError(eventsRes.error.message);
        setRows([]);
      } else {
        setRows((eventsRes.data || []) as unknown as EventRow[]);
      }
      if (!ingestionRes.error) {
        setIngestionRows((ingestionRes.data || []) as unknown as IngestionRunRow[]);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Aggregate ingestion runs by source over last 24h
  const ingestionStats = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = ingestionRows.filter(
      (r) => new Date(r.started_at).getTime() >= cutoff,
    );
    const bySource: Record<
      string,
      { runs: number; fetched: number; inserted: number; failed: number }
    > = {};
    for (const r of recent) {
      const key = r.source;
      if (!bySource[key])
        bySource[key] = { runs: 0, fetched: 0, inserted: 0, failed: 0 };
      bySource[key].runs += 1;
      bySource[key].fetched += r.fetched_count || 0;
      bySource[key].inserted += r.inserted_count || 0;
      if (r.status === "failed") bySource[key].failed += 1;
    }
    const totalInserted = Object.values(bySource).reduce(
      (n, s) => n + s.inserted,
      0,
    );
    return {
      bySource,
      totalRuns: recent.length,
      totalInserted,
      lastTickAt: recent[0]?.started_at ?? null,
    };
  }, [ingestionRows]);

  const since24h = useMemo(() => Date.now() - 24 * 60 * 60 * 1000, []);
  const recent = useMemo(
    () => rows.filter((r) => new Date(r.created_at).getTime() >= since24h),
    [rows, since24h],
  );

  // Per-event summaries
  const summaries = useMemo(() => {
    const out: Record<TrackedEvent, ReturnType<typeof summarize>> = {} as never;
    for (const ev of TRACKED_EVENTS) {
      out[ev] = summarize(recent.filter((r) => r.event_name === ev));
    }
    return out;
  }, [recent]);

  // Search-specific aggregates
  const searchAggregates = useMemo(() => {
    const sessions = recent.filter((r) => r.event_name === "search_session");
    const clusterHits = sessions.filter(
      (r) => (r.metadata as Record<string, unknown> | null)?.cluster_hit === true,
    ).length;
    const candidates = sessions
      .map((r) => Number((r.metadata as Record<string, unknown> | null)?.candidates ?? 0))
      .reduce((a, b) => a + b, 0);
    const validated = sessions
      .map((r) => Number((r.metadata as Record<string, unknown> | null)?.validated ?? 0))
      .reduce((a, b) => a + b, 0);
    const results = sessions
      .map((r) => Number((r.metadata as Record<string, unknown> | null)?.results ?? 0))
      .reduce((a, b) => a + b, 0);
    return {
      sessions: sessions.length,
      clusterHitRate: sessions.length ? Math.round((clusterHits / sessions.length) * 100) : 0,
      validationRate: candidates ? Math.round((validated / candidates) * 100) : 0,
      avgResults: sessions.length ? Math.round(results / sessions.length) : 0,
      totalCandidates: candidates,
      totalValidated: validated,
    };
  }, [recent]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            System Diagnostics
          </h1>
          <p className="mt-1 text-[12px] text-foreground/60">
            Last 24h activity from the live telemetry log. Updated on refresh.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-[11px] tracking-wide text-foreground/70 transition-colors hover:bg-card/80"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-foreground/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[12px]">Loading telemetry…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[12px] text-destructive">
          Failed to load diagnostics: {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-border/30 bg-card/40 p-6 text-center">
          <p className="text-[13px] text-foreground/70">
            No diagnostic events recorded yet.
          </p>
          <p className="mt-1 text-[11px] text-foreground/50">
            Run a search, create a post, or generate a FIT result — events
            will appear here within a few seconds.
          </p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Per-flow summary cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TRACKED_EVENTS.map((ev) => {
              const s = summaries[ev];
              const meta = EVENT_META[ev];
              const Icon = meta.icon;
              const healthy = s.total === 0 || s.errorRate < 10;
              return (
                <div
                  key={ev}
                  className="rounded-xl border border-border/30 bg-card/50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-accent/70" />
                      <span className="text-[11px] font-medium tracking-wide text-foreground/80">
                        {meta.label}
                      </span>
                    </div>
                    <span
                      className={`h-2 w-2 rounded-full ${healthy ? "bg-emerald-500/70" : "bg-destructive/80"}`}
                      aria-label={healthy ? "healthy" : "needs attention"}
                    />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {s.total}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/50">
                    last 24h · {meta.flow}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-foreground/60">
                    <div>
                      <p className="text-foreground/40">Success</p>
                      <p className="text-foreground/80">{s.successRate}%</p>
                    </div>
                    <div>
                      <p className="text-foreground/40">Errors</p>
                      <p className={s.errorRate >= 10 ? "text-destructive" : "text-foreground/80"}>
                        {s.errorRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground/40">Median</p>
                      <p className="text-foreground/80">{s.medianMs}ms</p>
                    </div>
                    <div>
                      <p className="text-foreground/40">p95</p>
                      <p className="text-foreground/80">{s.p95Ms}ms</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search-specific deep-dive */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-5">
            <h2 className="mb-4 text-[13px] font-medium tracking-wide text-foreground/80">
              Search engine — last 24h
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Sessions" value={searchAggregates.sessions.toString()} />
              <Stat
                label="Cluster hit rate"
                value={`${searchAggregates.clusterHitRate}%`}
                hint="DB-first served instantly"
              />
              <Stat
                label="Validation rate"
                value={`${searchAggregates.validationRate}%`}
                hint={`${searchAggregates.totalValidated} / ${searchAggregates.totalCandidates}`}
              />
              <Stat
                label="Avg results / session"
                value={searchAggregates.avgResults.toString()}
              />
            </div>
          </div>

          {/* Recent events table */}
          <div className="rounded-xl border border-border/30 bg-card/40">
            <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
              <h2 className="text-[13px] font-medium tracking-wide text-foreground/80">
                Recent events
              </h2>
              <span className="text-[10px] text-foreground/50">
                showing {Math.min(recent.length, 50)} of {recent.length}
              </span>
            </div>
            <div className="divide-y divide-border/20">
              {recent.slice(0, 50).map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-12 gap-3 px-5 py-2.5 text-[11px]"
                >
                  <span className="col-span-3 truncate font-mono text-foreground/70">
                    {r.event_name}
                  </span>
                  <span
                    className={`col-span-1 ${r.status === "error" ? "text-destructive" : r.status === "partial" ? "text-amber-500" : "text-emerald-500/80"}`}
                  >
                    {r.status}
                  </span>
                  <span className="col-span-2 text-foreground/60">
                    {typeof r.duration_ms === "number" ? `${Math.round(r.duration_ms)}ms` : "—"}
                  </span>
                  <span className="col-span-3 text-foreground/40">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span className="col-span-3 truncate text-foreground/50">
                    {r.metadata ? JSON.stringify(r.metadata).slice(0, 80) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-foreground/50">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-foreground/40">{hint}</p>}
    </div>
  );
}
