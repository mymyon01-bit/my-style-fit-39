// ─── BODY FRAME (NORMALIZED 2D COORDINATE SCAFFOLD) ─────────────────────────
// Stable 2D scaffold the body BASE image and the garment OVERLAY image are
// both authored against. Same canvas, same pose, same anchor lines — so the
// composite step can blend them without geometry drift.
//
// Not a 3D mesh. Not a try-on warp. Just consistent landmarks (in pixels)
// driven by the user's BodyProfile.

import type { BodyProfile } from "./buildBodyProfile";

export interface BodyFrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BodyFrame {
  /** Output canvas size — fixed so body base + garment overlay align 1:1. */
  canvasWidth: number;
  canvasHeight: number;
  /** Bounding box of the visible body (head→knees crop). */
  bodyBox: BodyFrameBox;
  // Horizontal anchor lines (Y in pixels)
  shoulderLineY: number;
  chestLineY: number;
  waistLineY: number;
  hipLineY: number;
  hemLineY: number;
  // Vertical anchors at chest level (X in pixels)
  leftShoulderX: number;
  rightShoulderX: number;
  // Vertical anchors at chest level
  torsoLeftX: number;
  torsoRightX: number;
  // Vertical anchors at waist
  waistLeftX: number;
  waistRightX: number;
  // Arm boxes (sleeve insertion regions)
  armLeftBox: BodyFrameBox;
  armRightBox: BodyFrameBox;
  /** Echoed back for prompt / debugging. */
  bodySummary: string;
}

const CANVAS_W = 768;
const CANVAS_H = 1024;

// Reference person centered in canvas. Anchor positions are then nudged by
// the user's body ratios so silhouettes vary visibly between users.
const CENTER_X = CANVAS_W / 2;

// Vertical layout (head at top, knees near bottom — fashion 3:4 crop)
const HEAD_TOP_Y = 90;
const SHOULDER_Y = 260;
const CHEST_Y = 360;
const WAIST_Y = 500;
const HIP_Y = 600;
const HEM_BASE_Y = 740;       // base hem line (regular length)
const KNEES_Y = 940;

// Reference half-widths (px) that get scaled by body ratios
const REF_SHOULDER_HALF = 150;
const REF_CHEST_HALF = 130;
const REF_WAIST_HALF = 110;
const REF_ARM_W = 70;
const REF_ARM_H = 320;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function buildBodyFrame(body: BodyProfile): BodyFrame {
  const shoulderHalf = clamp(REF_SHOULDER_HALF * body.shoulderRatio, 110, 200);
  const chestHalf = clamp(REF_CHEST_HALF * body.chestRatio, 95, 175);
  const waistHalf = clamp(REF_WAIST_HALF * body.waistRatio, 80, 160);

  const leftShoulderX = Math.round(CENTER_X - shoulderHalf);
  const rightShoulderX = Math.round(CENTER_X + shoulderHalf);
  const torsoLeftX = Math.round(CENTER_X - chestHalf);
  const torsoRightX = Math.round(CENTER_X + chestHalf);
  const waistLeftX = Math.round(CENTER_X - waistHalf);
  const waistRightX = Math.round(CENTER_X + waistHalf);

  // Arms hang just outside the shoulder line
  const armW = Math.round(REF_ARM_W * (body.armScale ?? 1));
  const armLeftBox: BodyFrameBox = {
    x: leftShoulderX - armW,
    y: SHOULDER_Y - 10,
    w: armW,
    h: REF_ARM_H,
  };
  const armRightBox: BodyFrameBox = {
    x: rightShoulderX,
    y: SHOULDER_Y - 10,
    w: armW,
    h: REF_ARM_H,
  };

  return {
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    bodyBox: {
      x: leftShoulderX - 20,
      y: HEAD_TOP_Y,
      w: rightShoulderX - leftShoulderX + 40,
      h: KNEES_Y - HEAD_TOP_Y,
    },
    shoulderLineY: SHOULDER_Y,
    chestLineY: CHEST_Y,
    waistLineY: WAIST_Y,
    hipLineY: HIP_Y,
    hemLineY: HEM_BASE_Y,
    leftShoulderX,
    rightShoulderX,
    torsoLeftX,
    torsoRightX,
    waistLeftX,
    waistRightX,
    armLeftBox,
    armRightBox,
    bodySummary: body.bodySummary,
  };
}

/** Used by prompt builders so the body BASE image always frames consistently. */
export const BODY_FRAME_PROMPT_HEADER = [
  "Composition: front-facing standing fashion pose, single subject, full upper body and hips visible, head fully in frame, knees just visible at the bottom.",
  "Camera: eye-level, no tilt, neutral 50mm equivalent lens, no fisheye, no extreme angles.",
  "Background: clean light neutral studio backdrop, soft floor shadow, soft directional fashion lighting.",
  "Aspect ratio 3:4. Centered subject. No text, no watermark, no props.",
].join(" ");
