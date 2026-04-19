// ─── BODY ANCHORS ───────────────────────────────────────────────────────────
// Percentages relative to the FIT stage. Used to attach garments to the body
// (NOT center them in the frame). Keeps cloth aligned to shoulders/chest.

export interface BodyAnchors {
  /** vertical position of shoulder line as % of stage height */
  shoulderY: number;
  /** vertical position of chest as % of stage height */
  chestY: number;
  /** vertical position of waist as % of stage height */
  waistY: number;
  /** vertical position of hip as % of stage height */
  hipY: number;
  /** horizontal center of body as % of stage width */
  centerX: number;
}

export function getAnchors(): BodyAnchors {
  return {
    shoulderY: 22,
    chestY: 35,
    waistY: 55,
    hipY: 68,
    centerX: 50,
  };
}
