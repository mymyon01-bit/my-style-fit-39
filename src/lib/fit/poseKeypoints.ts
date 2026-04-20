// ─── POSE KEYPOINTS — MediaPipe Tasks Vision wrapper ───────────────────────
// Detects body landmarks from a user photo. Returns normalized 0..1 coords
// for the anchors the canvas compositor needs. Lazy-loads the WASM + model
// on first use. If detection fails, callers fall back to a measurement-based
// silhouette (handled in useBodyKeypoints).

import type { BodyFrame } from "./buildBodyFrame";

export interface PoseKeypoints {
  // Normalized 0..1 (relative to the source image)
  leftShoulder: { x: number; y: number };
  rightShoulder: { x: number; y: number };
  leftHip: { x: number; y: number };
  rightHip: { x: number; y: number };
  nose: { x: number; y: number };
  leftElbow?: { x: number; y: number };
  rightElbow?: { x: number; y: number };
  leftWrist?: { x: number; y: number };
  rightWrist?: { x: number; y: number };
  /** Detection confidence 0..1 (averaged over the four torso anchors). */
  confidence: number;
}

let detectorPromise: Promise<any> | null = null;

async function loadDetector() {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );
    return await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numPoses: 1,
    });
  })().catch((err) => {
    detectorPromise = null;
    throw err;
  });
  return detectorPromise;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = url;
  });
}

export async function detectPoseFromUrl(url: string): Promise<PoseKeypoints | null> {
  try {
    const [detector, img] = await Promise.all([loadDetector(), loadImage(url)]);
    const result = detector.detect(img);
    const lm = result?.landmarks?.[0];
    if (!lm || lm.length < 33) return null;
    // MediaPipe pose indices
    const k = (i: number) => ({ x: lm[i].x, y: lm[i].y });
    const v = (i: number) => (typeof lm[i].visibility === "number" ? lm[i].visibility : 0.8);
    const conf =
      (v(11) + v(12) + v(23) + v(24)) / 4; // shoulders + hips
    if (conf < 0.4) return null;
    return {
      nose: k(0),
      leftShoulder: k(11),
      rightShoulder: k(12),
      leftElbow: k(13),
      rightElbow: k(14),
      leftWrist: k(15),
      rightWrist: k(16),
      leftHip: k(23),
      rightHip: k(24),
      confidence: conf,
    };
  } catch (err) {
    console.warn("[poseKeypoints] detection failed", err);
    return null;
  }
}

/** Project normalized pose keypoints onto a fixed canvas size. */
export function projectPoseToCanvas(
  pose: PoseKeypoints,
  canvasW: number,
  canvasH: number
) {
  const px = (p: { x: number; y: number }) => ({
    x: Math.round(p.x * canvasW),
    y: Math.round(p.y * canvasH),
  });
  return {
    nose: px(pose.nose),
    leftShoulder: px(pose.leftShoulder),
    rightShoulder: px(pose.rightShoulder),
    leftElbow: pose.leftElbow ? px(pose.leftElbow) : undefined,
    rightElbow: pose.rightElbow ? px(pose.rightElbow) : undefined,
    leftWrist: pose.leftWrist ? px(pose.leftWrist) : undefined,
    rightWrist: pose.rightWrist ? px(pose.rightWrist) : undefined,
    leftHip: px(pose.leftHip),
    rightHip: px(pose.rightHip),
    confidence: pose.confidence,
  };
}

/** Build a synthetic projected pose from BodyFrame when MediaPipe fails. */
export function projectFrameAsPose(frame: BodyFrame) {
  return {
    nose: { x: Math.round((frame.leftShoulderX + frame.rightShoulderX) / 2), y: frame.shoulderLineY - 130 },
    leftShoulder: { x: frame.leftShoulderX, y: frame.shoulderLineY },
    rightShoulder: { x: frame.rightShoulderX, y: frame.shoulderLineY },
    leftElbow: { x: frame.armLeftBox.x + frame.armLeftBox.w / 2, y: frame.armLeftBox.y + frame.armLeftBox.h * 0.5 },
    rightElbow: { x: frame.armRightBox.x + frame.armRightBox.w / 2, y: frame.armRightBox.y + frame.armRightBox.h * 0.5 },
    leftWrist: { x: frame.armLeftBox.x + frame.armLeftBox.w / 2, y: frame.armLeftBox.y + frame.armLeftBox.h },
    rightWrist: { x: frame.armRightBox.x + frame.armRightBox.w / 2, y: frame.armRightBox.y + frame.armRightBox.h },
    leftHip: { x: frame.waistLeftX, y: frame.hipLineY },
    rightHip: { x: frame.waistRightX, y: frame.hipLineY },
    confidence: 0.0, // 0 = synthesized
  };
}

export type ProjectedPose = ReturnType<typeof projectPoseToCanvas>;
