import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, MapPin, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWeather } from "@/hooks/useWeather";

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}

const STYLE_TAGS = ["minimal", "streetwear", "classic", "chic", "clean fit", "old money", "sporty", "casual"];
const OCCASION_TAGS = ["daily", "office", "date", "travel", "party", "weekend"];

export default function OOTDUploadSheet({ open, onClose, onPosted }: Props) {
  const { user } = useAuth();
  const weather = useWeather();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [occasionTags, setOccasionTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: string, arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>) =>
    set(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handlePost = async () => {
    if (!user || !file) return;
    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ootd-photos")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("ootd-photos")
        .getPublicUrl(path);

      const { error: insertError } = await supabase.from("ootd_posts").insert({
        user_id: user.id,
        image_url: publicUrl,
        caption: caption || null,
        style_tags: styleTags,
        occasion_tags: occasionTags,
        weather_tag: weather.condition,
      });
      if (insertError) throw insertError;

      // Track interaction
      await supabase.from("interactions").insert({
        user_id: user.id,
        event_type: "ootd_uploaded",
        target_id: "ootd",
        target_type: "ootd",
        metadata: { style_tags: styleTags, occasion_tags: occasionTags },
      });

      onPosted();
      resetForm();
      onClose();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setPreview(null);
    setFile(null);
    setCaption("");
    setStyleTags([]);
    setOccasionTags([]);
    setError(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl bg-card border-t border-border p-6 pb-10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-semibold text-foreground">Post Your OOTD</h3>
              <button onClick={onClose} className="text-foreground/30 hover:text-foreground/50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Photo */}
            {preview ? (
              <div className="relative mb-4 rounded-2xl overflow-hidden">
                <img src={preview} alt="Preview" className="w-full aspect-[3/4] object-cover" />
                <button
                  onClick={() => { setPreview(null); setFile(null); }}
                  className="absolute top-3 right-3 rounded-full bg-black/50 p-1.5 text-white/70 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="mb-4 flex w-full aspect-[3/4] max-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/[0.02] transition-colors hover:border-accent/30"
              >
                <Camera className="h-8 w-8 text-foreground/15 mb-2" />
                <span className="text-xs font-semibold tracking-[0.1em] text-foreground/30">TAP TO ADD PHOTO</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

            {/* Caption */}
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Add a caption…"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent transition-colors mb-4"
            />

            {/* Style tags */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="h-3 w-3 text-foreground/25" />
                <span className="text-[10px] font-semibold tracking-[0.15em] text-foreground/30">STYLE</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag, styleTags, setStyleTags)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                      styleTags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/40"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Occasion tags */}
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="h-3 w-3 text-foreground/25" />
                <span className="text-[10px] font-semibold tracking-[0.15em] text-foreground/30">OCCASION</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {OCCASION_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag, occasionTags, setOccasionTags)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                      occasionTags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/40"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather auto-tag */}
            {!weather.loading && !weather.error && (
              <p className="text-[10px] text-foreground/25 mb-4">
                Weather tag: {weather.condition.replace(/-/g, " ")} · {weather.temp}°C
              </p>
            )}

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive mb-3">{error}</p>
            )}

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={!file || uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background disabled:opacity-40 transition-opacity hover:opacity-90"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
