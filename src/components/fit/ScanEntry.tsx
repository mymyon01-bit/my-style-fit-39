// ── SCAN ENTRY ─────────────────────────────────────────────────────────────
// One clean entry surface for the FIT > SCAN tab. Replaces the multi-box
// upload grid. Tapping the entry opens a sheet with three clear choices:
//   1. Take photo  (camera capture)
//   2. Upload from device
//   3. Saved       (open user's body photo library)
//
// Status block above the entry surfaces a previous-scan summary in a
// premium way (small status card · subtle icon · one CTA).

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Upload, FolderOpen, Sparkles, Loader2, X, Image as ImageIcon,
} from "lucide-react";

interface Props {
  /** number of previously saved body photos (0 = no status card shown) */
  savedCount?: number;
  /** True while uploading/processing a freshly captured/picked file */
  busy?: boolean;
  /** Called with a File from camera or device picker */
  onPickFile: (file: File) => void;
  /** Called when user taps "Saved" — opens the saved library */
  onOpenSaved: () => void;
  /** Optional: called when user clicks "Use saved photos" CTA in status card */
  onUseSaved?: () => void;
  className?: string;
}

export default function ScanEntry({
  savedCount = 0, busy, onPickFile, onOpenSaved, onUseSaved, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      setOpen(false);
      onPickFile(file);
    }
  };

  return (
    <section className={className}>
      {/* ── PREVIOUS SCAN STATUS ──────────────────────────────────────────── */}
      {savedCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground/90">Previous scan available</p>
            <p className="mt-0.5 text-[11px] text-foreground/60">
              {savedCount} saved {savedCount === 1 ? "photo" : "photos"} ready to reuse
            </p>
          </div>
          <button
            type="button"
            onClick={onUseSaved ?? onOpenSaved}
            className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-background hover:opacity-90"
          >
            USE SAVED
          </button>
        </div>
      )}

      {/* ── PRIMARY ENTRY CARD ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-card/80 to-card/30 p-5 text-left transition-all hover:border-foreground/25 hover:shadow-[0_8px_32px_-12px_hsl(var(--accent)/0.25)] disabled:opacity-60"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background ring-4 ring-foreground/5 transition-transform group-hover:scale-105">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55">BODY PHOTO</p>
          <p className="mt-1 font-display text-[15px] font-semibold text-foreground">
            {busy ? "Processing…" : "Add a photo"}
          </p>
          <p className="mt-0.5 text-[11px] text-foreground/55">
            Take, upload, or pick from your saved library
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-foreground/15 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-foreground/65 sm:inline">
          OPEN
        </span>
      </button>

      {/* ── ACTION SHEET ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-md rounded-t-3xl border border-foreground/10 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:bottom-1/2 sm:translate-y-1/2 sm:rounded-3xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55">ADD BODY PHOTO</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-5 text-[11px] text-foreground/55">
                We use this photo to estimate fit. Stand straight, full body visible.
              </p>

              <div className="space-y-2">
                <SheetAction
                  icon={<Camera className="h-4 w-4" />}
                  label="Take photo"
                  hint="Use your camera"
                  onClick={() => cameraRef.current?.click()}
                />
                <SheetAction
                  icon={<Upload className="h-4 w-4" />}
                  label="Upload from device"
                  hint="Choose an image file"
                  onClick={() => fileRef.current?.click()}
                />
                <SheetAction
                  icon={<FolderOpen className="h-4 w-4" />}
                  label="Saved"
                  hint={savedCount > 0 ? `${savedCount} ready to reuse` : "Your previously uploaded photos"}
                  onClick={() => { setOpen(false); onOpenSaved(); }}
                  emphasis={savedCount > 0}
                />
              </div>

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}

function SheetAction({
  icon, label, hint, onClick, emphasis,
}: {
  icon: React.ReactNode; label: string; hint?: string;
  onClick: () => void; emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
        emphasis
          ? "border-accent/30 bg-accent/[0.06] hover:border-accent/55"
          : "border-foreground/10 bg-card/40 hover:border-foreground/25 hover:bg-card/70"
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
        emphasis ? "bg-accent text-background" : "bg-foreground text-background"
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-foreground/55">{hint}</p>}
      </div>
      <ImageIcon className="h-3.5 w-3.5 text-foreground/30" />
    </button>
  );
}
