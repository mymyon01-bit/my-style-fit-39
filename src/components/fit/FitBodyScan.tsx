import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RotateCcw, CheckCircle2, AlertTriangle, Upload } from "lucide-react";

interface ScanStatus {
  frontUploaded: boolean;
  sideUploaded: boolean;
  frontPreview: string | null;
  sidePreview: string | null;
  scanning: boolean;
  scanComplete: boolean;
  qualityScore: number;
  issues: string[];
}

interface Props {
  onScanComplete: (quality: number) => void;
}

const GUIDELINES = [
  "Stand straight, arms slightly away",
  "Wear fitted clothing",
  "Full body visible head to feet",
  "Good lighting, plain background",
  "Camera at chest height",
];

const QUALITY_CHECKS = [
  { label: "Full body detected", key: "body" },
  { label: "Head visible", key: "head" },
  { label: "Feet visible", key: "feet" },
  { label: "Lighting quality", key: "light" },
  { label: "Image clarity", key: "blur" },
];

export default function FitBodyScan({ onScanComplete }: Props) {
  const [status, setStatus] = useState<ScanStatus>({
    frontUploaded: false, sideUploaded: false,
    frontPreview: null, sidePreview: null,
    scanning: false, scanComplete: false,
    qualityScore: 0, issues: [],
  });
  const frontRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);

  const handleUpload = (side: "front" | "side") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setStatus(s => ({
      ...s,
      [`${side}Uploaded`]: true,
      [`${side}Preview`]: url,
    }));
  };

  const runScan = () => {
    setStatus(s => ({ ...s, scanning: true }));
    // Simulate scan analysis
    setTimeout(() => {
      const quality = 78 + Math.floor(Math.random() * 18);
      const issues = quality < 85 ? ["Loose clothing may reduce waist accuracy"] : [];
      setStatus(s => ({ ...s, scanning: false, scanComplete: true, qualityScore: quality, issues }));
      onScanComplete(quality);
    }, 2400);
  };

  const resetScan = () => {
    setStatus({
      frontUploaded: false, sideUploaded: false,
      frontPreview: null, sidePreview: null,
      scanning: false, scanComplete: false,
      qualityScore: 0, issues: [],
    });
  };

  return (
    <div className="space-y-6">
      {/* Guidelines */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30 mb-3">SCAN GUIDELINES</p>
        <div className="space-y-2">
          {GUIDELINES.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-accent/60" />
              <span className="text-xs text-foreground/50">{g}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upload areas */}
      <div className="grid grid-cols-2 gap-3">
        {(["front", "side"] as const).map(side => {
          const uploaded = side === "front" ? status.frontUploaded : status.sideUploaded;
          const preview = side === "front" ? status.frontPreview : status.sidePreview;
          const ref = side === "front" ? frontRef : sideRef;

          return (
            <motion.button
              key={side}
              onClick={() => ref.current?.click()}
              className="relative flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-card/30 overflow-hidden transition-colors hover:border-accent/30"
              whileTap={{ scale: 0.97 }}
            >
              {preview ? (
                <>
                  <img src={preview} alt={side} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-background/40" />
                  <CheckCircle2 className="relative z-10 h-6 w-6 text-green-500" />
                  <span className="relative z-10 mt-1 text-[10px] font-semibold text-green-400">{side.toUpperCase()}</span>
                </>
              ) : (
                <>
                  <div className="h-20 w-12 rounded-xl border border-dashed border-foreground/10 flex items-center justify-center mb-2">
                    <Camera className="h-5 w-5 text-foreground/15" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-[0.15em] text-foreground/25">
                    {side.toUpperCase()} PHOTO
                  </span>
                </>
              )}
              <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleUpload(side)} />
            </motion.button>
          );
        })}
      </div>

      {/* Scan button */}
      <AnimatePresence>
        {status.frontUploaded && status.sideUploaded && !status.scanComplete && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={runScan}
            disabled={status.scanning}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {status.scanning ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Upload className="h-4 w-4" />
                </motion.div>
                Analyzing body landmarks…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Run Body Scan
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Quality results */}
      <AnimatePresence>
        {status.scanComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">SCAN QUALITY</p>
                <span className={`text-lg font-bold ${
                  status.qualityScore >= 85 ? "text-green-500" : status.qualityScore >= 70 ? "text-accent" : "text-orange-500"
                }`}>{status.qualityScore}/100</span>
              </div>
              <div className="space-y-2">
                {QUALITY_CHECKS.map((check, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-foreground/40">{check.label}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500/70" />
                  </div>
                ))}
              </div>
            </div>

            {status.issues.length > 0 && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                {status.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-orange-400/80">{issue}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={resetScan} className="flex items-center gap-1.5 text-xs text-foreground/30 hover:text-foreground/50 mx-auto">
              <RotateCcw className="h-3 w-3" /> Retake scan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
