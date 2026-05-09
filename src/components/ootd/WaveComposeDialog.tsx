import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Upload, Plus, Trash2 } from "lucide-react";
import { createWavePost } from "@/hooks/useWaveModules";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { WaveModule } from "@/hooks/useWaveModules";

interface Props {
  open: boolean;
  onClose: () => void;
  module: WaveModule;
  waveId: string;
  onCreated: () => void;
}

export default function WaveComposeDialog({ open, onClose, module, waveId, onCreated }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isPhotos = module.kind === "photos";
  const isPoll = module.kind === "poll";
  const isAnon = module.kind === "anon_board";
  const isBoard = module.kind === "board" || isAnon;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !user) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files.slice(0, 4 - images.length)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/wave/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("ootd-photos").upload(path, file);
        if (error) throw error;
        urls.push(supabase.storage.from("ootd-photos").getPublicUrl(path).data.publicUrl);
      }
      setImages(prev => [...prev, ...urls]);
    } catch (err: any) { toast.error(err.message ?? "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (isPhotos && images.length === 0) { toast.error("Add at least one photo"); return; }
    if (isPoll && (pollOptions.filter(o => o.trim()).length < 2 || !title.trim())) {
      toast.error("Need a question and at least 2 options"); return;
    }
    if (isBoard && !body.trim() && !title.trim()) { toast.error("Write something"); return; }
    setSubmitting(true);
    try {
      const kind = isPhotos ? "photo" : isPoll ? "poll" : isAnon ? "anon" : "text";
      await createWavePost({
        wave_id: waveId, module_id: module.id, kind: kind as any,
        title: title.trim() || null,
        body: body.trim() || null,
        image_urls: images,
        is_anonymous: isAnon,
        metadata: isPoll ? { question: title.trim(), options: pollOptions.map(o => o.trim()).filter(Boolean) } : {},
      });
      toast.success("Posted");
      onCreated();
      onClose();
      setTitle(""); setBody(""); setImages([]); setPollOptions(["", ""]);
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur p-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5"><X className="h-3.5 w-3.5" /></button>
          <h3 className="text-[16px] font-bold text-foreground">New post · {module.label}</h3>
          {isAnon && <p className="mt-1 text-[11px] text-amber-500">You'll be posted anonymously to other members.</p>}

          <div className="mt-4 space-y-3">
            {(isBoard || isPoll) && (
              <input value={title} onChange={e => setTitle(e.target.value.slice(0, 100))}
                placeholder={isPoll ? "Poll question" : "Title (optional)"}
                className="w-full rounded-xl bg-foreground/[0.06] px-3 py-2.5 text-[13px] outline-none focus:bg-foreground/[0.1]" />
            )}
            {(isBoard || isPhotos) && (
              <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 2000))}
                placeholder={isPhotos ? "Caption (optional)" : "Write something…"} rows={isBoard ? 5 : 2}
                className="w-full resize-none rounded-xl bg-foreground/[0.06] px-3 py-2.5 text-[13px] outline-none focus:bg-foreground/[0.1]" />
            )}

            {isPhotos && (
              <div>
                <div className="grid grid-cols-4 gap-1.5">
                  {images.map((u, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => setImages(p => p.filter((_, j) => j !== i))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ))}
                  {images.length < 4 && (
                    <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1]">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-foreground/50" />}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {isPoll && (
              <div className="space-y-1.5">
                {pollOptions.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={o} onChange={e => setPollOptions(p => p.map((v, j) => j === i ? e.target.value.slice(0, 60) : v))}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 rounded-xl bg-foreground/[0.06] px-3 py-2 text-[12.5px] outline-none focus:bg-foreground/[0.1]" />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(p => p.filter((_, j) => j !== i))}
                        className="rounded-full p-1.5 text-foreground/50 hover:bg-foreground/10"><Trash2 className="h-3 w-3" /></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions(p => [...p, ""])}
                    className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-3 py-1 text-[10.5px] font-semibold text-foreground/65">
                    <Plus className="h-3 w-3" /> Add option
                  </button>
                )}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40">
              {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Post"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
