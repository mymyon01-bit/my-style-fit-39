import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, Video, Globe2, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { prepareImage, validateMedia } from "@/lib/imageUpload";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}

const MAX_VIDEO_SECONDS = 15;

const StoryUploadSheet = ({ open, onClose, onPosted }: Props) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<"all" | "circles" | "friends">("all");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setCaption("");
      setAudience("all");
      setUploading(false);
      setProgress("");
    }
  }, [open]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { isVideo } = validateMedia(f, { allowVideo: true, maxBytes: 60 * 1024 * 1024 });
      if (isVideo) {
        // verify duration
        const ok = await checkVideoDuration(f);
        if (!ok) {
          toast.error(`Video must be ${MAX_VIDEO_SECONDS}s or shorter`);
          return;
        }
        setMediaType("video");
        setFile(f);
        setPreview(URL.createObjectURL(f));
      } else {
        setProgress("Preparing photo…");
        const prepared = await prepareImage(f);
        setMediaType("image");
        setFile(prepared);
        setPreview(URL.createObjectURL(prepared));
        setProgress("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Couldn't read that file");
      setProgress("");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePost = async () => {
    if (!user || !file) return;
    setUploading(true);
    setProgress("Uploading…");
    try {
      const ext = (file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg")).toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(path);

      const { error: insErr } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        audience,
      } as any);
      if (insErr) throw insErr;

      toast.success("Story posted · expires in 24h");
      onPosted();
      onClose();
    } catch (err: any) {
      console.error("[story-upload]", err);
      toast.error(err?.message || "Couldn't post your story. Try again.");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-card border-t border-border p-6 pb-10"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-semibold text-foreground">Add to your story</h3>
              <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!preview ? (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={!!progress}
                className="flex w-full aspect-[9/16] max-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/[0.02] hover:border-accent/30 transition-colors gap-3"
              >
                {progress ? (
                  <>
                    <Loader2 className="h-7 w-7 text-accent animate-spin" />
                    <span className="text-[11px] text-foreground/60">{progress}</span>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <Camera className="h-7 w-7 text-foreground/40" />
                      <Video className="h-7 w-7 text-foreground/40" />
                    </div>
                    <span className="text-xs font-semibold tracking-[0.1em] text-foreground/70">TAP TO ADD PHOTO OR VIDEO</span>
                    <span className="text-[10px] text-foreground/40">Photos · Videos up to {MAX_VIDEO_SECONDS}s</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[60vh]">
                  {mediaType === "video" ? (
                    <video src={preview} className="w-full h-full object-contain" controls playsInline />
                  ) : (
                    <img src={preview} alt="Story preview" className="w-full h-full object-contain" />
                  )}
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 80))}
                  placeholder="Add a caption (optional)"
                  maxLength={80}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/40"
                />

                {/* Audience selector */}
                <div>
                  <p className="text-[10px] font-medium tracking-[0.18em] text-foreground/50 mb-2">SHARE WITH</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { v: "all", label: "Everyone", Icon: Globe2 },
                      { v: "circles", label: "My circle", Icon: Users },
                      { v: "friends", label: "Friends", Icon: UserCheck },
                    ] as const).map(({ v, label, Icon }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAudience(v)}
                        className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-all ${
                          audience === v
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border/40 text-foreground/55 hover:text-foreground/80"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-foreground/40 mt-1.5">
                    {audience === "all" && "Visible to everyone on Wardrobe."}
                    {audience === "circles" && "Only people who follow you can see this."}
                    {audience === "friends" && "Only people you follow back can see this."}
                  </p>
                </div>

                <button
                  onClick={handlePost}
                  disabled={uploading}
                  className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progress || "Posting…"}
                    </>
                  ) : (
                    "Share story"
                  )}
                </button>
                <p className="text-[10px] text-center text-foreground/40">Stories disappear after 24 hours</p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={handleFile}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

async function checkVideoDuration(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration <= MAX_VIDEO_SECONDS + 0.5);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(true); // be permissive if probing fails
    };
    video.src = url;
  });
}

export default StoryUploadSheet;
