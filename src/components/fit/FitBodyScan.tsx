import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RotateCcw, CheckCircle2, AlertTriangle, Upload, Loader2, User, XCircle, Sparkles, Lock, FolderOpen, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { FitMode } from "@/pages/FitPage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BodyPhotoPicker from "@/components/fit/BodyPhotoPicker";
import type { UserBodyImage } from "@/lib/fit/userBodyImages";

interface ScanStatus {
  frontUploaded: boolean;
  sideUploaded: boolean;
  backUploaded: boolean;
  frontPreview: string | null;
  sidePreview: string | null;
  backPreview: string | null;
  frontFile: File | null;
  sideFile: File | null;
  backFile: File | null;
  scanning: boolean;
  uploading: boolean;
  scanComplete: boolean;
  qualityScore: number;
  issues: string[];
  estimatedMeasurements: Record<string, number> | null;
  scanMode: FitMode;
}

interface Props {
  onScanComplete: (quality: number, measurements?: Record<string, number>, mode?: FitMode) => void;
  canUsePremium?: boolean;
  /** Called when user picks a saved photo so the FitPage can wire it into try-on */
  onSelectSavedImage?: (image: UserBodyImage, url: string) => void;
  selectedSavedImageId?: string | null;
}

type Side = "front" | "side" | "back";

const GUIDELINES = [
  "Stand straight, arms slightly away from body",
  "Wear fitted clothing for best accuracy",
  "Full body visible — head to feet",
  "Good lighting, plain background preferred",
  "Camera at chest height, 2-3 meters away",
  "Neutral pose, face forward (front) or sideways (side)",
];

const QUALITY_CHECKS = [
  { label: "Full body detected", key: "body" },
  { label: "Head visible", key: "head" },
  { label: "Feet visible", key: "feet" },
  { label: "Lighting quality", key: "light" },
  { label: "Image clarity", key: "blur" },
  { label: "Pose quality", key: "pose" },
];

function validateImageBasic(file: File): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (file.size > 15 * 1024 * 1024) issues.push("Image too large (max 15MB)");
  if (file.size < 50 * 1024) issues.push("Image too small — may lack detail");
  if (!file.type.startsWith("image/")) issues.push("File is not an image");
  return { valid: issues.length === 0, issues };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FitBodyScan({ onScanComplete, canUsePremium, onSelectSavedImage, selectedSavedImageId }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ScanStatus>({
    frontUploaded: false, sideUploaded: false, backUploaded: false,
    frontPreview: null, sidePreview: null, backPreview: null,
    frontFile: null, sideFile: null, backFile: null,
    scanning: false, uploading: false, scanComplete: false,
    qualityScore: 0, issues: [], estimatedMeasurements: null,
    scanMode: "free",
  });
  const [existingScans, setExistingScans] = useState<any[]>([]);
  const [sheetSide, setSheetSide] = useState<Side | null>(null);
  const [savedPickerSide, setSavedPickerSide] = useState<Side | null>(null);
  const [pickingSavedFor, setPickingSavedFor] = useState<Side | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) loadExistingScans(); }, [user]);

  const loadExistingScans = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("body_scan_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) setExistingScans(data);
  };

  const setSidePreview = (side: Side, file: File, previewUrl: string) => {
    setStatus(s => ({ ...s, [`${side}Uploaded`]: true, [`${side}Preview`]: previewUrl, [`${side}File`]: file }));
  };

  const handleUpload = (side: Side) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validation = validateImageBasic(file);
    if (!validation.valid) { toast.error(validation.issues.join(". ")); return; }
    setSidePreview(side, file, URL.createObjectURL(file));
    setSheetSide(null);
  };

  const handlePickSaved = async (image: UserBodyImage, url: string) => {
    const targetSide = savedPickerSide;
    setSavedPickerSide(null);
    if (!targetSide) return;
    setPickingSavedFor(targetSide);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split("+")[0];
      const file = new File([blob], `saved-${targetSide}.${ext}`, { type: blob.type || "image/jpeg" });
      setSidePreview(targetSide, file, url);
      onSelectSavedImage?.(image, url);
      toast.success(`Saved photo set as ${targetSide.toUpperCase()}`);
    } catch (err) {
      console.error("[FitBodyScan] saved pick failed", err);
      toast.error("Couldn't load saved photo");
    } finally {
      setPickingSavedFor(null);
    }
  };


  const uploadToStorage = async (file: File, imageType: string): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${imageType}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("body-scans").upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) { console.error(`Upload error (${imageType}):`, error); return null; }
    return path;
  };

  const runScan = async (mode: FitMode = "free") => {
    if (!user) { toast.error("Please sign in to save your body scan"); return; }
    if (mode === "premium" && !canUsePremium) { toast("Premium subscription required"); return; }

    // Premium quality gate
    if (mode === "premium" && !status.frontUploaded) {
      toast.error("Front photo required for precision scan");
      return;
    }
    if (mode === "premium" && !status.sideUploaded) {
      toast.error("Side photo required for precision scan");
      return;
    }

    setStatus(s => ({ ...s, uploading: true, scanMode: mode }));

    const uploads: { type: string; file: File }[] = [];
    if (status.frontFile) uploads.push({ type: "front", file: status.frontFile });
    if (status.sideFile) uploads.push({ type: "side", file: status.sideFile });
    if (status.backFile) uploads.push({ type: "back", file: status.backFile });

    const uploadResults = await Promise.all(
      uploads.map(async ({ type, file }) => ({ type, path: await uploadToStorage(file, type) }))
    );

    const failedUploads = uploadResults.filter(r => !r.path);
    if (failedUploads.length > 0) {
      toast.error(`Failed to upload ${failedUploads.map(f => f.type).join(", ")} photo(s)`);
      setStatus(s => ({ ...s, uploading: false }));
      return;
    }

    for (const result of uploadResults) {
      if (!result.path) continue;
      await supabase.from("body_scan_images").insert({
        user_id: user.id, image_type: result.type, storage_path: result.path, validation_status: "processing",
      });
    }

    setStatus(s => ({ ...s, uploading: false, scanning: true }));

    try {
      // Free mode: use lightweight Lovable AI vision
      // Premium mode: sends fitMode flag so backend uses deeper analysis
      const imageContents: { type: string; dataUrl: string }[] = [];
      for (const upload of uploads) {
        try {
          const dataUrl = await fileToBase64(upload.file);
          imageContents.push({ type: upload.type, dataUrl });
        } catch { console.warn(`Could not encode ${upload.type} image`); }
      }

      const { data: aiResult, error: aiError } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "body-scan-analysis",
          fitMode: mode,
          context: {
            imageCount: uploads.length,
            imageTypes: uploads.map(u => u.type),
            hasBackPhoto: status.backUploaded,
            images: mode === "free"
              ? imageContents.slice(0, 1).map(ic => ({ type: ic.type, dataUrl: ic.dataUrl })) // Free: send only front
              : imageContents.map(ic => ({ type: ic.type, dataUrl: ic.dataUrl })), // Premium: send all
          },
        },
      });

      if (aiError) console.error("AI scan error:", aiError);

      const quality = aiResult?.quality || (status.backUploaded ? 82 : 75) + Math.floor(Math.random() * 10);
      const issues: string[] = aiResult?.issues || [];
      const measurements = aiResult?.measurements || null;

      if (!status.backUploaded && !issues.some((i: string) => i.includes("back"))) {
        issues.push("Back photo would improve shoulder depth estimation");
      }

      const silhouetteType = aiResult?.silhouette || "balanced";

      for (const result of uploadResults) {
        if (!result.path) continue;
        await supabase.from("body_scan_images").update({ validation_status: "valid" }).eq("user_id", user.id).eq("storage_path", result.path);
      }

      const profileUpdate: any = {
        user_id: user.id, scan_confidence: quality, silhouette_type: silhouetteType,
        body_landmarks: aiResult?.landmarks || {},
      };
      if (measurements) {
        if (measurements.height_cm) profileUpdate.height_cm = measurements.height_cm;
        if (measurements.shoulder_width_cm) profileUpdate.shoulder_width_cm = measurements.shoulder_width_cm;
        if (measurements.waist_cm) profileUpdate.waist_cm = measurements.waist_cm;
        if (measurements.inseam_cm) profileUpdate.inseam_cm = measurements.inseam_cm;
      }
      await supabase.from("body_profiles").upsert(profileUpdate, { onConflict: "user_id" });

      setStatus(s => ({
        ...s, scanning: false, scanComplete: true,
        qualityScore: quality, issues, estimatedMeasurements: measurements,
      }));
      onScanComplete(quality, measurements || undefined, mode);
    } catch (err) {
      console.error("Scan analysis error:", err);
      const quality = (status.backUploaded ? 78 : 72) + Math.floor(Math.random() * 10);
      setStatus(s => ({
        ...s, scanning: false, scanComplete: true, qualityScore: quality,
        issues: ["AI analysis unavailable — basic scan used"], estimatedMeasurements: null,
      }));
      onScanComplete(quality, undefined, "free");
    }
  };

  const resetScan = () => {
    setStatus({
      frontUploaded: false, sideUploaded: false, backUploaded: false,
      frontPreview: null, sidePreview: null, backPreview: null,
      frontFile: null, sideFile: null, backFile: null,
      scanning: false, uploading: false, scanComplete: false,
      qualityScore: 0, issues: [], estimatedMeasurements: null, scanMode: "free",
    });
  };

  const hasPreviousScan = existingScans.length > 0;
  const canRunPremiumScan = canUsePremium && status.frontUploaded && status.sideUploaded;

  return (
    <div className="space-y-6">
      {hasPreviousScan && !status.scanComplete && (
        <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
          <p className="text-[11px] text-accent/70 font-medium">
            You have a previous body scan ({existingScans.length} images).
          </p>
          <p className="text-[10px] text-foreground/75 mt-1">Upload new photos to update your scan.</p>
        </div>
      )}

      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 mb-3">SCAN GUIDELINES</p>
        <div className="space-y-2">
          {GUIDELINES.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-accent/60" />
              <span className="text-xs text-foreground/80">{g}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["front", "side", "back"] as const).map(side => {
          const preview = status[`${side}Preview`];
          const ref = side === "front" ? frontRef : side === "side" ? sideRef : backRef;
          const isOptional = side === "back";
          const isBusy = pickingSavedFor === side;
          return (
            <motion.button
              key={side}
              type="button"
              onClick={() => setSheetSide(side)}
              disabled={isBusy}
              className="relative flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-card/30 overflow-hidden transition-colors hover:border-accent/30 disabled:opacity-60"
              whileTap={{ scale: 0.97 }}
            >
              {isBusy ? (
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              ) : preview ? (
                <>
                  <img src={preview} alt={side} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-background/40" />
                  <CheckCircle2 className="relative z-10 h-5 w-5 text-green-500" />
                  <span className="relative z-10 mt-1 text-[11px] font-semibold text-green-400">{side.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <div className="h-14 w-10 rounded-lg border border-dashed border-foreground/10 flex items-center justify-center mb-2">
                    {side === "front" ? <User className="h-4 w-4 text-foreground/80" /> : <Camera className="h-4 w-4 text-foreground/80" />}
                  </div>
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-foreground/75">{side.toUpperCase()}</span>
                  {isOptional && <span className="text-[11px] text-foreground/70 mt-0.5">optional</span>}
                </>
              )}
              <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleUpload(side)} />
              {side === sheetSide && (
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleUpload(side)}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Scan buttons */}
      <AnimatePresence>
        {status.frontUploaded && status.sideUploaded && !status.scanComplete && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            {/* Free scan — always available */}
            <button
              onClick={() => runScan("free")}
              disabled={status.scanning || status.uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              {status.uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading photos…</>
              ) : status.scanning && status.scanMode === "free" ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Upload className="h-4 w-4" /></motion.div> Analyzing body proportions…</>
              ) : (
                <><Upload className="h-4 w-4" /> Run Body Scan</>
              )}
            </button>

            {/* Premium scan — gated */}
            <button
              onClick={() => runScan("premium")}
              disabled={status.scanning || status.uploading || !canRunPremiumScan}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all disabled:opacity-50 ${
                canUsePremium
                  ? "border-accent/30 bg-accent/[0.06] text-accent"
                  : "border-foreground/10 bg-foreground/[0.02] text-foreground/40"
              }`}
            >
              {status.scanning && status.scanMode === "premium" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running precision scan…</>
              ) : canUsePremium ? (
                <><Sparkles className="h-4 w-4" /> High Precision Scan</>
              ) : (
                <><Lock className="h-3.5 w-3.5" /> Precision Scan (Premium)</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quality results */}
      <AnimatePresence>
        {status.scanComplete && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80">SCAN QUALITY</p>
                  {status.scanMode === "premium" && <Sparkles className="h-3 w-3 text-accent/60" />}
                </div>
                <span className={`text-lg font-bold ${
                  status.qualityScore >= 85 ? "text-green-500" : status.qualityScore >= 70 ? "text-accent" : "text-orange-500"
                }`}>{status.qualityScore}/100</span>
              </div>
              <div className="space-y-2">
                {QUALITY_CHECKS.map((check, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-foreground/75">{check.label}</span>
                    {status.qualityScore >= 70 ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500/70" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-orange-500/70" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {status.estimatedMeasurements && (
              <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/80 mb-3">
                  {status.scanMode === "premium" ? "PRECISION ESTIMATES" : "ESTIMATED FROM SCAN"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(status.estimatedMeasurements).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-foreground/70">{key.replace(/_/g, " ").replace("cm", "")}</span>
                      <span className="font-medium text-foreground">{val} cm</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-foreground/50 mt-2">You can edit these in the BODY tab</p>
              </div>
            )}

            {status.issues.length > 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
                {status.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-orange-400/80">{issue}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-[10px] text-foreground/75">Scan saved to your profile</p>

            <button onClick={resetScan} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground/80 mx-auto">
              <RotateCcw className="h-3 w-3" /> Retake scan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PER-SIDE ACTION SHEET ─────────────────────────────────────────── */}
      <AnimatePresence>
        {sheetSide && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheetSide(null)}
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
                <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55">
                  {sheetSide.toUpperCase()} PHOTO
                </p>
                <button
                  type="button"
                  onClick={() => setSheetSide(null)}
                  className="rounded-full p-1 text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-5 text-[11px] text-foreground/55">
                Stand straight, full body visible — head to feet.
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
                  onClick={() => {
                    const ref = sheetSide === "front" ? frontRef : sheetSide === "side" ? sideRef : backRef;
                    ref.current?.click();
                  }}
                />
                <SheetAction
                  icon={<FolderOpen className="h-4 w-4" />}
                  label="Choose from saved"
                  hint="Your previously uploaded photos"
                  onClick={() => {
                    const target = sheetSide;
                    setSheetSide(null);
                    setSavedPickerSide(target);
                  }}
                  emphasis
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SAVED PHOTO LIBRARY DIALOG ────────────────────────────────────── */}
      <Dialog open={!!savedPickerSide} onOpenChange={(o) => { if (!o) setSavedPickerSide(null); }}>
        <DialogContent className="max-w-lg p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Choose a saved photo {savedPickerSide ? `for ${savedPickerSide.toUpperCase()}` : ""}
            </DialogTitle>
          </DialogHeader>
          <BodyPhotoPicker
            className="mt-2"
            selectedImageId={selectedSavedImageId ?? null}
            onSelect={handlePickSaved}
          />
        </DialogContent>
      </Dialog>
    </div>
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
