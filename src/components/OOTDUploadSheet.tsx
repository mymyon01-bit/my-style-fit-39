import { useState, useRef, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, MapPin, Tag, Hash, Plus, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWeather } from "@/hooks/useWeather";
import { prepareImage, validateMedia } from "@/lib/imageUpload";
import { recordEvent } from "@/lib/diagnostics";
import { pickPhotoFile } from "@/lib/native/pickPhotoFile";
import { toast } from "sonner";
import { useEmailVerified } from "@/hooks/useEmailVerified";
import EmailVerificationModal from "@/components/legal/EmailVerificationModal";
import SquareCropDialog from "@/components/SquareCropDialog";

// Sentinel topic — when present in a post's `topics` array it signals that
// the author has disabled sharing. Stored in `topics` to avoid a schema
// migration; hidden from any UI that lists topics.
export const NO_SHARE_FLAG = "__noshare";

interface Props {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}

const STYLE_TAGS = ["minimal", "streetwear", "classic", "chic", "clean fit", "old money", "sporty", "casual"];
const OCCASION_TAGS = ["daily", "office", "date", "travel", "party", "weekend"];
const MAX_MESSAGE = 100;
const MAX_HASHTAGS = 8;

interface Topic {
  id: string;
  name: string;
  post_count: number;
}

const OOTDUploadSheet = forwardRef<HTMLDivElement, Props>(({ open, onClose, onPosted }, ref) => {
  const { user } = useAuth();
  const weather = useWeather();
  const { verified: emailVerified } = useEmailVerified();
  const [emailGateOpen, setEmailGateOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [occasionTags, setOccasionTags] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [existingTopics, setExistingTopics] = useState<Topic[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [allowShares, setAllowShares] = useState(true);
  // Raw file the user just picked — held while the crop dialog is open.
  const [pendingCrop, setPendingCrop] = useState<File | null>(null);

  // Gate: when an unverified user opens the upload sheet, show email modal first.
  useEffect(() => {
    if (open && user && emailVerified === false) {
      setEmailGateOpen(true);
    }
  }, [open, user, emailVerified]);

  useEffect(() => {
    if (open) { loadTopics(); setStep(1); setAllowShares(true); }
  }, [open]);

  const loadTopics = async () => {
    const { data } = await supabase.from("ootd_topics").select("*").order("post_count", { ascending: false }).limit(20);
    setExistingTopics((data as Topic[]) || []);
  };

  const toggleTag = (tag: string, arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>) =>
    set(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const toggleTopic = (name: string) => {
    setSelectedTopics(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);
  };

  const handleAddTopic = async () => {
    const cleaned = newTopic.trim().toLowerCase().replace(/[^a-z0-9_\-\s]/g, "").replace(/\s+/g, "-");
    if (!cleaned || !user) return;
    if (selectedTopics.includes(cleaned)) { setNewTopic(""); return; }
    const exists = existingTopics.find(t => t.name === cleaned);
    if (!exists) {
      await supabase.from("ootd_topics").insert({ name: cleaned, created_by: user.id });
      await loadTopics();
    }
    setSelectedTopics(prev => [...prev, cleaned]);
    setNewTopic("");
  };

  const addHashtag = () => {
    if (hashtags.length >= MAX_HASHTAGS) return;
    const cleaned = hashtagInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleaned || hashtags.includes(cleaned)) { setHashtagInput(""); return; }
    setHashtags(prev => [...prev, cleaned]);
    setHashtagInput("");
  };

  const removeHashtag = (tag: string) => {
    setHashtags(prev => prev.filter(t => t !== tag));
  };

  const ingestFile = async (f: File) => {
    try {
      validateMedia(f, { allowVideo: false, maxBytes: 50 * 1024 * 1024 });
      setError(null);
      // Open the interactive 1:1 crop dialog. The user picks the framing,
      // which we then run through prepareImage for compression / HEIC fix.
      setPendingCrop(f);
    } catch (err: any) {
      const msg = err?.message || "Couldn't read that photo";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleCropConfirmed = async (cropped: File) => {
    try {
      setPendingCrop(null);
      const prepared = await prepareImage(cropped, { square: false });
      setFile(prepared);
      setPreview(URL.createObjectURL(prepared));
      setStep(2);
    } catch (err: any) {
      const msg = err?.message || "Couldn't process that photo";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await ingestFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePickPhoto = async () => {
    // Native iOS/Android: open OS sheet (camera + library); web: <input>.
    const native = await pickPhotoFile({ source: "prompt" });
    if (native) {
      await ingestFile(native);
    } else {
      fileRef.current?.click();
    }
  };

  const handlePost = async () => {
    if (!user || !file) return;
    setUploading(true);
    setError(null);
    const startedAt = performance.now();

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ootd-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("ootd-photos")
        .getPublicUrl(path);

      const baseTopics = [...new Set([...selectedTopics, ...hashtags])];
      const allTopics = allowShares ? baseTopics : [...baseTopics, NO_SHARE_FLAG];

      const { error: insertError } = await supabase.from("ootd_posts").insert({
        user_id: user.id,
        image_url: publicUrl,
        caption: caption.slice(0, MAX_MESSAGE) || null,
        style_tags: styleTags,
        occasion_tags: occasionTags,
        topics: allTopics,
        weather_tag: weather.condition,
      });
      if (insertError) throw insertError;

      await supabase.from("interactions").insert({
        user_id: user.id,
        event_type: "ootd_uploaded",
        target_id: "ootd",
        target_type: "ootd",
        metadata: { style_tags: styleTags, occasion_tags: occasionTags, topics: allTopics, hashtags },
      });

      // Telemetry: post_create success — admin-only read.
      recordEvent({
        event_name: "post_create",
        status: "success",
        duration_ms: performance.now() - startedAt,
        metadata: {
          file_size: file.size,
          style_tags: styleTags.length,
          occasion_tags: occasionTags.length,
          topics: allTopics.length,
        },
      });

      toast.success("Posted to OOTD");
      onPosted();
      resetForm();
      onClose();
    } catch (e: any) {
      const msg = e?.message || "Upload failed. Please try again.";
      console.error("[ootd-upload]", e);
      recordEvent({
        event_name: "post_create",
        status: "error",
        duration_ms: performance.now() - startedAt,
        metadata: { error: msg.slice(0, 200), file_size: file?.size ?? 0 },
      });
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setPreview(null);
    setFile(null);
    setCaption("");
    setHashtags([]);
    setHashtagInput("");
    setStyleTags([]);
    setOccasionTags([]);
    setSelectedTopics([]);
    setNewTopic("");
    setError(null);
    setStep(1);
    setAllowShares(true);
  };

  const canProceed = (s: number) => {
    if (s === 1) return !!file;
    return true;
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="ootd-upload-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm sm:p-4"
            onClick={onClose}
          >
            <motion.div
              key="ootd-upload-sheet"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-card border border-border p-6 pb-10 sm:my-6 sm:max-h-[90vh] sm:overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-semibold text-foreground">Post Your OOTD</h3>
                <div className="flex items-center gap-3">
                  {/* Step indicator */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(s => (
                      <div key={s} className={`h-1 w-4 rounded-full transition-colors ${step >= s ? "bg-accent/60" : "bg-foreground/10"}`} />
                    ))}
                  </div>
                  <button onClick={onClose} className="text-foreground/70 hover:text-foreground/70">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Step 1: Photo */}
              {step === 1 && (
                <>
                  {preview ? (
                    <div className="relative mb-4 rounded-2xl overflow-hidden">
                      <img src={preview} alt="Preview" className="w-full aspect-square object-cover" />
                      <button
                        onClick={() => { setPreview(null); setFile(null); }}
                        className="absolute top-3 right-3 rounded-full bg-black/50 p-1.5 text-white/70 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePickPhoto}
                      className="mb-4 flex w-full aspect-square max-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/[0.02] transition-colors hover:border-accent/30"
                    >
                      <Camera className="h-8 w-8 text-foreground/15 mb-2" />
                      <span className="text-xs font-semibold tracking-[0.1em] text-foreground/70">TAP TO ADD PHOTO</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  {file && (
                    <button onClick={() => setStep(2)} className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-background hover:opacity-90 transition-opacity">
                      Next
                    </button>
                  )}
                </>
              )}

              {/* Step 2: Message */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/50 uppercase">Short Message</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={caption}
                      onChange={e => setCaption(e.target.value.slice(0, MAX_MESSAGE))}
                      placeholder="clean minimal fit today…"
                      maxLength={MAX_MESSAGE}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/40 transition-colors"
                    />
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[9px] ${caption.length >= MAX_MESSAGE ? "text-destructive/60" : "text-foreground/30"}`}>
                      {caption.length}/{MAX_MESSAGE}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground/30">Optional — keep it short and expressive</p>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/60 hover:text-foreground/80 transition-colors">
                      Back
                    </button>
                    <button onClick={() => setStep(3)} className="flex-1 rounded-xl bg-foreground py-3 text-sm font-semibold text-background hover:opacity-90 transition-opacity">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Hashtags */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/50 uppercase">Add Hashtags</p>

                  {/* Current hashtags */}
                  {hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => removeHashtag(tag)}
                          className="rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent flex items-center gap-1"
                        >
                          #{tag}
                          <X className="h-2.5 w-2.5" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 text-sm">#</span>
                      <input
                        type="text"
                        value={hashtagInput}
                        onChange={e => setHashtagInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        onKeyDown={e => e.key === "Enter" && addHashtag()}
                        placeholder="minimal"
                        maxLength={20}
                        className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50 transition-colors"
                      />
                    </div>
                    <button
                      onClick={addHashtag}
                      disabled={!hashtagInput.trim() || hashtags.length >= MAX_HASHTAGS}
                      className="rounded-lg border border-border px-3 py-2 text-foreground/70 hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[9px] text-foreground/30">{hashtags.length}/{MAX_HASHTAGS} hashtags · press enter to add</p>

                  {/* Topics section */}
                  <div className="pt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Hash className="h-3 w-3 text-accent/70" />
                      <span className="text-[10px] font-semibold tracking-[0.15em] text-foreground/75">TOPICS</span>
                    </div>

                    {selectedTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {selectedTopics.map(tp => (
                          <button key={tp} onClick={() => toggleTopic(tp)} className="rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent flex items-center gap-1">
                            #{tp} <X className="h-2.5 w-2.5" />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mb-2.5">
                      <input
                        type="text"
                        value={newTopic}
                        onChange={e => setNewTopic(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddTopic()}
                        placeholder="Create or search topic…"
                        maxLength={30}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/50 transition-colors"
                      />
                      <button onClick={handleAddTopic} disabled={!newTopic.trim()} className="rounded-lg border border-border px-3 py-2 text-foreground/70 hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-30">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {existingTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {existingTopics.filter(t => !selectedTopics.includes(t.name)).slice(0, 8).map(topic => (
                          <button key={topic.id} onClick={() => toggleTopic(topic.name)} className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-foreground/70 hover:border-accent/20 transition-all">
                            <span className="text-accent/65 mr-0.5">#</span>{topic.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setStep(2)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/60 hover:text-foreground/80 transition-colors">
                      Back
                    </button>
                    <button onClick={() => setStep(4)} className="flex-1 rounded-xl bg-foreground py-3 text-sm font-semibold text-background hover:opacity-90 transition-opacity">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Style + Confirm */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Preview summary */}
                  <div className="flex gap-3 mb-2">
                    {preview && (
                      <img src={preview} alt="" className="h-20 w-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {caption && <p className="text-[12px] text-foreground/70 line-clamp-2 mb-1">"{caption}"</p>}
                      {hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {hashtags.map(t => <span key={t} className="text-[9px] text-accent/60">#{t}</span>)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Style tags */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="h-3 w-3 text-foreground/70" />
                      <span className="text-[10px] font-semibold tracking-[0.15em] text-foreground/70">STYLE</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLE_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag, styleTags, setStyleTags)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                            styleTags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/75"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Occasion tags */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="h-3 w-3 text-foreground/70" />
                      <span className="text-[10px] font-semibold tracking-[0.15em] text-foreground/70">OCCASION</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {OCCASION_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag, occasionTags, setOccasionTags)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                            occasionTags.includes(tag) ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground/75"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sharing toggle — author can disable shares for this post */}
                  <button
                    type="button"
                    onClick={() => setAllowShares((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-3.5 py-3 text-left transition-colors hover:border-accent/30"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Share2 className="h-3.5 w-3.5 shrink-0 text-foreground/60" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-foreground/85">Allow others to share</p>
                        <p className="mt-0.5 text-[10px] text-foreground/50">
                          {allowShares ? "Anyone can share this look" : "Sharing is blocked for this post"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        allowShares ? "bg-accent/70" : "bg-foreground/15"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                          allowShares ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </button>

                  {/* Weather */}
                  {!weather.loading && !weather.error && (
                    <p className="text-[10px] text-foreground/70">
                      Weather: {weather.condition.replace(/-/g, " ")} · {weather.temp}°C
                    </p>
                  )}

                  {error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setStep(3)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/60 hover:text-foreground/80 transition-colors">
                      Back
                    </button>
                    <button
                      onClick={handlePost}
                      disabled={!file || uploading}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-40 transition-opacity hover:opacity-90"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <EmailVerificationModal
        open={emailGateOpen}
        onOpenChange={(o) => {
          setEmailGateOpen(o);
          if (!o && emailVerified === false) onClose();
        }}
        onVerified={() => setEmailGateOpen(false)}
      />
      <SquareCropDialog
        open={!!pendingCrop}
        file={pendingCrop}
        onClose={() => setPendingCrop(null)}
        onCropped={handleCropConfirmed}
        title="Crop your OOTD"
      />
    </>
  );
});

OOTDUploadSheet.displayName = "OOTDUploadSheet";

export default OOTDUploadSheet;
