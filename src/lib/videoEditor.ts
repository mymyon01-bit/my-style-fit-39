// Re-encode a video clip with optional trim + canvas filter (baked-in).
// Uses MediaRecorder + canvas.captureStream. Falls back gracefully when audio
// capture isn't supported (older Safari).
export interface ReencodeOpts {
  startS: number;
  endS: number;
  filterCss?: string; // CSS filter string to bake into pixels
  maxWidth?: number;
  fps?: number;
  bitrate?: number;
  onProgress?: (ratio: number) => void;
}

export interface ReencodeResult {
  blob: Blob;
  mime: string;
  duration: number;
}

const pickMime = (): string => {
  const c = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of c) {
    try {
      if ((window as any).MediaRecorder?.isTypeSupported?.(m)) return m;
    } catch {}
  }
  return "video/webm";
};

export async function reencodeClip(file: File, opts: ReencodeOpts): Promise<ReencodeResult> {
  const { startS, endS, filterCss = "none", maxWidth = 720, fps = 30, bitrate = 3_500_000, onProgress } = opts;
  if (!("MediaRecorder" in window)) {
    throw new Error("MediaRecorder not supported in this browser");
  }

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not read video"));
  });

  const srcW = video.videoWidth || 720;
  const srcH = video.videoHeight || 1280;
  const scale = srcW > maxWidth ? maxWidth / srcW : 1;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const stream = (canvas as any).captureStream(fps) as MediaStream;

  // Try to attach the source audio track so the output has sound.
  try {
    const vAny = video as any;
    if (typeof vAny.captureStream === "function") {
      const vs: MediaStream = vAny.captureStream();
      const at = vs.getAudioTracks?.()[0];
      if (at) stream.addTrack(at);
    }
  } catch {
    /* audio attach optional */
  }

  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Seek to start
  await new Promise<void>((res) => {
    const handler = () => {
      video.removeEventListener("seeked", handler);
      res();
    };
    video.addEventListener("seeked", handler);
    video.currentTime = Math.max(0, startS);
  });

  recorder.start(250);
  await video.play();

  const totalDur = Math.max(0.001, endS - startS);

  await new Promise<void>((res) => {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        recorder.stop();
      } catch {}
      try {
        video.pause();
      } catch {}
      res();
    };
    const draw = () => {
      if (stopped) return;
      if (video.ended || video.currentTime >= endS) {
        stop();
        return;
      }
      try {
        ctx.filter = filterCss || "none";
        ctx.drawImage(video, 0, 0, w, h);
      } catch {}
      onProgress?.(Math.min(1, (video.currentTime - startS) / totalDur));
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    video.addEventListener("ended", stop);
    // Safety cap (10s grace beyond requested duration)
    setTimeout(stop, (totalDur + 10) * 1000);
  });

  // Wait for recorder to flush
  await new Promise<void>((res) => {
    if (recorder.state === "inactive") return res();
    recorder.addEventListener("stop", () => res(), { once: true });
  });

  URL.revokeObjectURL(video.src);
  const blob = new Blob(chunks, { type: mime });
  return { blob, mime, duration: totalDur };
}

/** Capture a thumbnail from a video file at a given time (default 0.1s). */
export async function captureThumbnail(file: File, atSec = 0.1): Promise<{ blob: Blob; duration: number; width: number; height: number }> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not read video"));
  });
  await new Promise<void>((res) => {
    const h = () => {
      video.removeEventListener("seeked", h);
      res();
    };
    video.addEventListener("seeked", h);
    video.currentTime = Math.min(atSec, Math.max(0, (video.duration || 1) - 0.05));
  });
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(video, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Thumbnail failed"))), "image/jpeg", 0.85),
  );
  const duration = video.duration;
  URL.revokeObjectURL(video.src);
  return { blob, duration, width: w, height: h };
}

/** Capture a thumbnail from an existing video element at current frame, with a CSS filter applied. */
export async function captureFilteredThumbnail(file: File, atSec: number, filterCss: string): Promise<Blob> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not read video"));
  });
  await new Promise<void>((res) => {
    const h = () => {
      video.removeEventListener("seeked", h);
      res();
    };
    video.addEventListener("seeked", h);
    video.currentTime = Math.min(atSec, Math.max(0, (video.duration || 1) - 0.05));
  });
  const w = video.videoWidth || 720;
  const h = video.videoHeight || 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.filter = filterCss || "none";
  ctx.drawImage(video, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Thumbnail failed"))), "image/jpeg", 0.85),
  );
  URL.revokeObjectURL(video.src);
  return blob;
}
