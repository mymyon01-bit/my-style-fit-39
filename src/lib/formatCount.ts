/**
 * Format counts for OOTD UI.
 *  - <1000   → exact integer (e.g. "999")
 *  - 1K–99K  → one decimal place (e.g. "2.4K", "12.3K")
 *  - 100K+   → integer K (e.g. "120K")
 *  - 1M+     → one decimal place (e.g. "1.2M"); 100M+ → integer
 *
 * Decimals are truncated (not rounded) so a count never appears larger
 * than reality — 2,499 reads as "2.4K", not "2.5K".
 */
export function formatCount(n: number | null | undefined): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    if (k >= 100) return Math.floor(k).toString() + "K";
    // Truncate to 1 decimal (floor at 0.1 step)
    return (Math.floor(k * 10) / 10).toFixed(1) + "K";
  }
  const m = v / 1_000_000;
  if (m >= 100) return Math.floor(m).toString() + "M";
  return (Math.floor(m * 10) / 10).toFixed(1) + "M";
}
