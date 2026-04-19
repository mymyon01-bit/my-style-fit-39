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
  /** Items in the visible window with a real product image — used to detect
   *  cosmetic emptiness even when raw counts look ok. */
  strongImageCount?: number;
}

export interface QueryCoverageResult {
  isWeak: boolean;
  isNewLike: boolean;
  reason: string[];
}

export function assessQueryCoverage(input: QueryCoverageInput): QueryCoverageResult {
  const reasons: string[] = [];
  // Stronger thresholds — Discover should feel abundant, not just "non-empty".
  if (input.candidateCount < 60) reasons.push("LOW_CANDIDATE_COUNT");
  if (input.visibleCount < 24) reasons.push("LOW_VISIBLE_COUNT");
  if ((input.freshCount ?? 0) < 12) reasons.push("LOW_FRESHNESS");
  if (input.strongImageCount !== undefined && input.strongImageCount < 12) {
    reasons.push("LOW_IMAGE_QUALITY_COUNT");
  }
  return {
    isWeak: reasons.length > 0,
    isNewLike: reasons.length > 0,
    reason: reasons,
  };
}
