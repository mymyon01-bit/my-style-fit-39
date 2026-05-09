import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Loader2, Waves } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { createWave } from "@/hooks/useWaves";
import { toast } from "sonner";

interface CreateWaveDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (waveId: string) => void;
}

export default function CreateWaveDialog({ open, onClose, onCreated }: CreateWaveDialogProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/wave-covers/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("ootd-photos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("ootd-photos").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const wave = await createWave({
        name: name.trim(),
        description: desc.trim() || null,
        cover_image_url: coverUrl,
        is_private: true,
      });
      toast.success(t("waveCreatedToast"));
      onCreated?.(wave.id);
      onClose();
      // reset
      setName(""); setDesc(""); setCoverUrl(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create wave");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ y: 30, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 20, scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-background shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition hover:bg-foreground/20"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-6 pt-7 pb-2">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)]">
                <Waves className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-[18px] font-bold text-foreground">{t("waveCreateTitle")}</h3>
            </div>
            <p className="text-[12px] text-foreground/60">{t("waveCreateDesc")}</p>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-4">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-foreground/60">
                {t("waveNameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder={t("waveNamePlaceholder")}
                className="w-full rounded-xl bg-foreground/[0.06] px-4 py-3 text-[14px] text-foreground placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.1]"
              />
            </div>
            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-foreground/60">
                {t("waveDescLabel")}
              </label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value.slice(0, 200))}
                rows={2}
                className="w-full resize-none rounded-xl bg-foreground/[0.06] px-4 py-3 text-[13px] text-foreground placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.1]"
              />
            </div>
            {/* Cover */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold tracking-wide text-foreground/60">
                {t("waveCoverLabel")}
              </label>
              <div className="flex items-center gap-3">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-foreground/[0.06]">
                    <Upload className="h-5 w-5 text-foreground/40" />
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-foreground/[0.08] px-3 py-2 text-[12px] font-semibold text-foreground/80 transition hover:bg-foreground/[0.14]">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {t("waveUpload")}
                  <input type="file" accept="image/*" onChange={handleCover} className="hidden" />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-foreground/[0.08] px-4 py-3 text-[13px] font-semibold text-foreground/75 transition hover:bg-foreground/[0.14]"
              >
                {t("waveCancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
                className="flex-[1.3] rounded-xl bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_hsl(330_85%_60%/0.5)] transition hover:opacity-95 disabled:opacity-40"
              >
                {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("waveCreate")}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
