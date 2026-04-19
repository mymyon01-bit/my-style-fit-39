/**
 * Discover search constants
 * -------------------------
 * SEARCH ≠ UI.
 *
 * SEARCH_POOL_LIMIT — how many candidate rows we pull from the DB
 *                     into memory BEFORE ranking + dedupe. Must be large
 *                     so ranking has variety and repetition drops.
 *
 * SEARCH_RANK_LIMIT — how many candidates we actually score/rank.
 *                     Equal to the pool — we rank the whole pool.
 *
 * UI_VISIBLE_LIMIT  — how many ranked items we render in the visible grid.
 *                     This is a UI cap, NOT a search cap.
 *
 * Never use magic numbers in discover search code — import these.
 */
export const SEARCH_POOL_LIMIT = 2000;
export const SEARCH_RANK_LIMIT = 2000;
export const UI_VISIBLE_LIMIT = 24;
