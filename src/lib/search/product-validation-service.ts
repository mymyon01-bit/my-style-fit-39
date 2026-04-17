import type { Product } from "./types";

const HTTPS_RE = /^https:\/\//i;

/**
 * Relaxed validator: accept if image, link, and title are usable.
 * Category is inferred elsewhere — we don't reject on missing category.
 */
export function validateProduct(p: Product): boolean {
  if (!p) return false;
  if (!p.title || p.title.trim().length < 2) return false;
  if (!p.imageUrl || !HTTPS_RE.test(p.imageUrl)) return false;
  if (!p.externalUrl || !HTTPS_RE.test(p.externalUrl)) return false;
  return true;
}
