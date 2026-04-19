/**
 * Query coverage health
 * ---------------------
 * Cheap, deterministic check used by `useDiscoverSearch` to decide whether
 * to fire the AI interpreter + background discovery. Thresholds are tuned
 * so that any thin grid (or grid with few fresh items) is treated as weak.
 */
export interface QueryCoverageInput {
  query: string;
  candidateCount: number;
  visibleCount: number;
  lockedCategory?: string | null;
  freshCount?: number;
}

export interface QueryCoverageResult {
  isWeak: boolean;
  isNewLike: boolean;
  reason: string[];
}

export function assessQueryCoverage(input: QueryCoverageInput): QueryCoverageResult {
  const reasons: string[] = [];
  if (input.candidateCount < 20) reasons.push("LOW_CANDIDATE_COUNT");
  if (input.visibleCount < 12) reasons.push("LOW_VISIBLE_COUNT");
  if ((input.freshCount ?? 0) < 6) reasons.push("LOW_FRESHNESS");
  return {
    isWeak: reasons.length > 0,
    isNewLike: reasons.length > 0,
    reason: reasons,
  };
}
