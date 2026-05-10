import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Upload, Film, Camera, Wand2, Scissors, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { VIDEO_FILTERS, filterCssById, type VideoFilterId } from "@/lib/videoFilters";
import { reencodeClip, captureFilteredThumbnail } from "@/lib/videoEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

const MAX_DURATION_S = 60;
const MAX_SIZE_MB = 80;

const parseTags = (raw: string): string[] => {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 24)
        .map((t) => t.replace(/[^a-z0-9_가-힣]/g, "")),
    ),
  ).slice(0, 8);
};

export default function OOTDShortUploadSheet({ open, onClose, onPosted }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [filterId, setFilterId] = useState<VideoFilterId>("none");
  const [caption, setCaption] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"pick" | "edit">("pick");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setDuration(0);
      setTrimStart(0);
      setTrimEnd(0);
      setFilterId("none");
      setCaption("");
      setTagsRaw("");
      setProgress(0);
      setStage("pick");
    }
  }, [open]);

  const filterCss = useMemo(() => filterCssById(filterId), [filterId]);
  const tags = useMemo(() => parseTags(tagsRaw), [tagsRaw]);

  const handleFile = (f: File) => {
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Video too large (max ${MAX_SIZE_MB}MB)`);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(url);
    setStage("edit");
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onLoadedMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const d = e.currentTarget.duration || 0;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(Math.min(MAX_DURATION_S, d));
  };

  const seek = (sec: number) => {
    const v = previewVideoRef.current;
    if (v) v.currentTime = sec;
  };

  const trimDur = Math.max(0, trimEnd - trimStart);
  const needsReencode = !!file && (trimStart > 0.05 || trimEnd < duration - 0.05 || filterId !== "none");

  const handlePost = async () => {
    if (!user) {
      toast.error("Sign in to post");
      return;
    }
    if (!file) return;
    if (trimDur < 1) {
      toast.error("Clip must be at least 1 second");
      return;
    }
    if (trimDur > MAX_DURATION_S + 0.5) {
      toast.error(`Max ${MAX_DURATION_S} seconds`);
      return;
    }

    setSubmitting(true);
    setProgress(0);
    try {
      let uploadBlob: Blob = file;
      let uploadType: string = file.type || "video/mp4";
      let finalDur = trimDur;
      let ext = (file.name.split(".").pop() || "mp4").toLowerCase();

      if (needsReencode) {
        try {
          const result = await reencodeClip(file, {
            startS: trimStart,
            endS: trimEnd,
            filterCss,
            onProgress: (r) => setProgress(Math.round(r * 80)),
          });
          uploadBlob = result.blob;
          uploadType = result.mime;
          finalDur = result.duration;
          ext = result.mime.includes("mp4") ? "mp4" : "webm";
        } catch (err: any) {
          // If re-encode fails (e.g. unsupported browser), fall back to original.
          // Filter will still be applied via CSS at playback.
          console.warn("Re-encode failed, using original:", err);
          toast.message("Editing not supported in this browser, posting original");
        }
      }

      setProgress(85);

      // Thumbnail (with filter) from a frame in the trim range
      const thumbAt = trimStart + Math.min(0.4, trimDur / 4);
      let thumbBlob: Blob;
      try {
        thumbBlob = await captureFilteredThumbnail(file, thumbAt, filterCss);
      } catch {
        // Fallback unfiltered thumbnail at start
        thumbBlob = new Blob();
      }

      const stamp = Date.now();
      const videoPath = `${user.id}/${stamp}.${ext}`;
      const thumbPath = `${user.id}/${stamp}_thumb.jpg`;

      const upVideo = await supabase.storage
        .from("ootd-videos")
        .upload(videoPath, uploadBlob, { contentType: uploadType, upsert: false });
      if (upVideo.error) throw upVideo.error;

      if (thumbBlob.size > 0) {
        await supabase.storage
          .from("ootd-videos")
          .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: false });
      }

      const videoUrl = supabase.storage.from("ootd-videos").getPublicUrl(videoPath).data.publicUrl;
      const thumbUrl = thumbBlob.size > 0
        ? supabase.storage.from("ootd-videos").getPublicUrl(thumbPath).data.publicUrl
        : null;

      setProgress(95);

      const { error } = await supabase.from("ootd_videos").insert({
        user_id: user.id,
        video_url: videoUrl,
        thumb_url: thumbUrl,
        caption: caption.trim() || null,
        duration_s: Math.min(MAX_DURATION_S, Math.round(finalDur * 100) / 100),
        tags,
        // Only persist filter when it wasn't baked-in via re-encode
        filter: needsReencode ? null : (filterId === "none" ? null : filterId),
      } as any);
      if (error) throw error;

      setProgress(100);
      toast.success("Posted to #OOTD");
      onPosted?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !submitting && onClose()}
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-background border border-border/40 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={() => !submitting && onClose()}
              className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5 z-10"
              disabled={submitting}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-accent" />
              <h3 className="text-[15px] font-bold text-foreground">New #OOTD video</h3>
            </div>
            <p className="mt-1 text-[11px] text-foreground/55">
              Up to {MAX_DURATION_S}s · vertical 9:16 looks best
            </p>

            {/* STAGE: PICK */}
            {stage === "pick" && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-4 text-left text-white shadow-lg shadow-black/20"
                >
                  <span className="rounded-full bg-white/20 p-2">
                    <Camera className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-semibold">Record now</span>
                    <span className="block text-[11px] text-white/80">Open camera</span>
                  </span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-foreground/[0.04] px-4 py-4 text-left text-foreground hover:bg-foreground/[0.08] transition-colors"
                >
                  <span className="rounded-full bg-foreground/10 p-2">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-semibold">Pick from gallery</span>
                    <span className="block text-[11px] text-foreground/55">MP4 / MOV / WebM · max {MAX_SIZE_MB}MB</span>
                  </span>
                </button>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPick}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/*"
                  className="hidden"
                  onChange={onPick}
                />
              </div>
            )}

            {/* STAGE: EDIT */}
            {stage === "edit" && previewUrl && (
              <div className="mt-4 space-y-4">
                <div className="relative aspect-[9/16] max-h-[48vh] overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={previewVideoRef}
                    src={previewUrl}
                    controls
                    playsInline
                    onLoadedMetadata={onLoadedMeta}
                    style={{ filter: filterCss }}
                    className="h-full w-full object-contain"
                  />
                  <button
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setFile(null);
                      setPreviewUrl(null);
                      setDuration(0);
                      setStage("pick");
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/65 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {trimDur.toFixed(1)}s
                    {trimDur > MAX_DURATION_S && <span className="ml-1 text-rose-400">· too long</span>}
                  </div>
                </div>

                {/* TRIM */}
                {duration > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/75 mb-2">
                      <Scissors className="h-3 w-3" /> Trim · {trimStart.toFixed(1)}s → {trimEnd.toFixed(1)}s
                    </div>
                    <div className="space-y-2">
                      <div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, duration - 1)}
                          step={0.1}
                          value={trimStart}
                          onChange={(e) => {
                            const v = Math.min(parseFloat(e.target.value), trimEnd - 1);
                            setTrimStart(v);
                            seek(v);
                          }}
                          className="w-full accent-accent"
                        />
                        <div className="text-[10px] text-foreground/45">Start</div>
                      </div>
                      <div>
                        <input
                          type="range"
                          min={Math.min(duration, trimStart + 1)}
                          max={duration}
                          step={0.1}
                          value={trimEnd}
                          onChange={(e) => {
                            const raw = parseFloat(e.target.value);
                            const v = Math.min(raw, trimStart + MAX_DURATION_S);
                            setTrimEnd(Math.max(v, trimStart + 1));
                            seek(v);
                          }}
                          className="w-full accent-accent"
                        />
                        <div className="text-[10px] text-foreground/45">End (max {MAX_DURATION_S}s)</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FILTERS */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/75 mb-2">
                    <Wand2 className="h-3 w-3" /> Filter
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                    {VIDEO_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterId(f.id)}
                        className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all ${
                          filterId === f.id
                            ? "bg-accent text-accent-foreground ring-2 ring-accent/40"
                            : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/10"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TAGS */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/75 mb-1.5">
                    <Hash className="h-3 w-3" /> Tags
                  </div>
                  <input
                    type="text"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="ootd streetwear summer"
                    className="w-full rounded-xl bg-foreground/[0.06] px-3 py-2 text-[12px] outline-none focus:bg-foreground/[0.1]"
                  />
                  {tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <span key={t} className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* CAPTION */}
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                  placeholder="Caption (optional)"
                  rows={2}
                  className="w-full resize-none rounded-xl bg-foreground/[0.06] px-3 py-2.5 text-[13px] outline-none focus:bg-foreground/[0.1]"
                />

                {/* PROGRESS */}
                {submitting && progress > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                <button
                  onClick={handlePost}
                  disabled={submitting || !file || trimDur < 1 || trimDur > MAX_DURATION_S + 0.5}
                  className="w-full rounded-xl bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progress < 80 ? "Editing…" : "Uploading…"}
                    </span>
                  ) : (
                    "Post"
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
