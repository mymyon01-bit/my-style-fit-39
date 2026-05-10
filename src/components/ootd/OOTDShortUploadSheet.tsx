import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Upload, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}

const MAX_DURATION_S = 60;
const MAX_SIZE_MB = 80;

/** Capture first frame of the video as a JPEG blob (auto-thumbnail). */
const extractThumbnail = (file: File): Promise<{ blob: Blob; duration: number }> =>
  new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      // Seek slightly past 0 to avoid black first frame
      video.currentTime = Math.min(0.1, video.duration);
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth || 720;
        const h = video.videoHeight || 1280;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            if (!blob) return reject(new Error("Thumbnail failed"));
            resolve({ blob, duration: video.duration });
          },
          "image/jpeg",
          0.85,
        );
      } catch (e) {
        reject(e);
      }
    };
    video.onerror = () => reject(new Error("Could not read video"));
  });

export default function OOTDShortUploadSheet({ open, onClose, onPosted }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUrl(null);
      setDuration(0);
      setCaption("");
    }
  }, [open]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Video too large (max ${MAX_SIZE_MB}MB)`);
      return;
    }
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(url);
  };

  const handlePost = async () => {
    if (!user) {
      toast.error("Sign in to post");
      return;
    }
    if (!file) return;
    setSubmitting(true);
    try {
      // Extract thumbnail + verify duration
      const { blob: thumbBlob, duration: dur } = await extractThumbnail(file);
      if (dur > MAX_DURATION_S + 1) {
        toast.error(`Max ${MAX_DURATION_S} seconds`);
        setSubmitting(false);
        return;
      }
      const stamp = Date.now();
      const ext = file.name.split(".").pop() || "mp4";
      const videoPath = `${user.id}/${stamp}.${ext}`;
      const thumbPath = `${user.id}/${stamp}_thumb.jpg`;

      const upVideo = await supabase.storage
        .from("ootd-videos")
        .upload(videoPath, file, { contentType: file.type, upsert: false });
      if (upVideo.error) throw upVideo.error;

      const upThumb = await supabase.storage
        .from("ootd-videos")
        .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: false });
      if (upThumb.error) throw upThumb.error;

      const videoUrl = supabase.storage.from("ootd-videos").getPublicUrl(videoPath).data.publicUrl;
      const thumbUrl = supabase.storage.from("ootd-videos").getPublicUrl(thumbPath).data.publicUrl;

      const { error } = await supabase.from("ootd_videos").insert({
        user_id: user.id,
        video_url: videoUrl,
        thumb_url: thumbUrl,
        caption: caption.trim() || null,
        duration_s: Math.min(MAX_DURATION_S, Math.round(dur * 100) / 100),
      });
      if (error) throw error;
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
          onClick={onClose}
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-background border border-border/40 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-accent" />
              <h3 className="text-[15px] font-bold text-foreground">New #OOTD video</h3>
            </div>
            <p className="mt-1 text-[11px] text-foreground/55">
              Up to {MAX_DURATION_S}s, vertical 9:16 looks best
            </p>

            <div className="mt-4 space-y-3">
              {!previewUrl ? (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-[9/16] max-h-[55vh] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/50 bg-foreground/[0.03] hover:border-accent/50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-foreground/45" />
                  <span className="text-[12px] font-medium text-foreground/70">Pick a video</span>
                  <span className="text-[10px] text-foreground/40">MP4 / MOV · max {MAX_SIZE_MB}MB</span>
                </button>
              ) : (
                <div className="relative aspect-[9/16] max-h-[55vh] overflow-hidden rounded-2xl bg-black">
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  />
                  <button
                    onClick={() => {
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setFile(null);
                      setPreviewUrl(null);
                      setDuration(0);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/65 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {duration > 0 && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {Math.min(MAX_DURATION_S, Math.round(duration))}s
                      {duration > MAX_DURATION_S && (
                        <span className="ml-1 text-rose-400">· too long</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={onPick}
              />
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                placeholder="Caption (optional)"
                rows={2}
                className="w-full resize-none rounded-xl bg-foreground/[0.06] px-3 py-2.5 text-[13px] outline-none focus:bg-foreground/[0.1]"
              />
              <button
                onClick={handlePost}
                disabled={submitting || !file || duration > MAX_DURATION_S + 1}
                className="w-full rounded-xl bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Post"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
