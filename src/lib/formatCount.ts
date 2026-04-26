/**
 * Format counts for OOTD UI.
 *  - <1000  → exact integer (e.g. "999")
 *  - 1000+  → "1K", "1.1K", "12.3K"
 *  - 1M+    → "1M", "1.2M"
 * Trailing ".0" is stripped so 1000 reads as "1K", not "1.0K".
 */
export function formatCount(n: number | null | undefined): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return (k >= 100 ? Math.floor(k).toString() : k.toFixed(1).replace(/\.0$/, "")) + "K";
  }
  const m = v / 1_000_000;
  return (m >= 100 ? Math.floor(m).toString() : m.toFixed(1).replace(/\.0$/, "")) + "M";
}
