// ─── useBodyKeypoints ──────────────────────────────────────────────────────
// Resolves a ProjectedPose for the canvas compositor.
//
//  • If userImageUrl is provided → run MediaPipe Pose on it
//  • If MediaPipe fails OR no image → fall back to BodyFrame-derived synthetic pose
//  • Always returns *some* pose so the compositor never blocks
//
// `degraded` flag tells the UI to surface the "approximate fit" warning.

import { useEffect, useRef, useState } from "react";
import {
  detectPoseFromUrl,
  projectFrameAsPose,
  projectPoseToCanvas,
  type ProjectedPose,
  type RawPose,
} from "@/lib/fit/poseKeypoints";
import { buildBodyFrame, type BodyFrame } from "@/lib/fit/buildBodyFrame";
import type { BodyProfile } from "@/lib/fit/buildBodyProfile";

// Module-level pose cache — keyed by image URL so re-mounts/size changes
// reuse the MediaPipe result instead of re-running detection (~600ms saved).
const POSE_CACHE = new Map<string, RawPose | null>();
const POSE_INFLIGHT = new Map<string, Promise<RawPose | null>>();

async function getPoseForUrl(url: string): Promise<RawPose | null> {
  if (POSE_CACHE.has(url)) return POSE_CACHE.get(url) ?? null;
  const inflight = POSE_INFLIGHT.get(url);
  if (inflight) return inflight;
  const promise = detectPoseFromUrl(url)
    .then((pose) => {
      POSE_CACHE.set(url, pose);
      POSE_INFLIGHT.delete(url);
      return pose;
    })
    .catch((err) => {
      POSE_CACHE.set(url, null);
      POSE_INFLIGHT.delete(url);
      throw err;
    });
  POSE_INFLIGHT.set(url, promise);
  return promise;
}

interface Args {
  userImageUrl?: string | null;
  body: BodyProfile;
}

export interface BodyKeypointsState {
  pose: ProjectedPose;
  frame: BodyFrame;
  source: "mediapipe" | "synthetic";
  degraded: boolean;
  loading: boolean;
}

export function useBodyKeypoints({ userImageUrl, body }: Args): BodyKeypointsState {
  const frame = buildBodyFrame(body);
  const [state, setState] = useState<BodyKeypointsState>(() => ({
    pose: projectFrameAsPose(frame),
    frame,
    source: "synthetic",
    degraded: !userImageUrl,
    loading: !!userImageUrl,
  }));
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = userImageUrl ?? null;

    if (!url) {
      lastUrlRef.current = null;
      setState({
        pose: projectFrameAsPose(frame),
        frame,
        source: "synthetic",
        degraded: true,
        loading: false,
      });
      return;
    }

    if (lastUrlRef.current === url && state.source === "mediapipe") {
      return; // already detected
    }
    lastUrlRef.current = url;

    setState((s) => ({ ...s, loading: true }));
    detectPoseFromUrl(url)
      .then((pose) => {
        if (cancelled) return;
        if (!pose) {
          setState({
            pose: projectFrameAsPose(frame),
            frame,
            source: "synthetic",
            degraded: true,
            loading: false,
          });
          return;
        }
        setState({
          pose: projectPoseToCanvas(pose, frame.canvasWidth, frame.canvasHeight),
          frame,
          source: "mediapipe",
          degraded: false,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          pose: projectFrameAsPose(frame),
          frame,
          source: "synthetic",
          degraded: true,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userImageUrl, body.shoulderRatio, body.chestRatio, body.waistRatio, body.armScale]);

  return state;
}
