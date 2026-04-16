import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, AlertTriangle, ExternalLink, User } from "lucide-react";
import { useState } from "react";
import {
  FitResult, SizeFitResult,
} from "@/lib/fitEngine";

interface FitProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  url: string;
  category: string;
}

interface Props {
  result: FitResult;
  product: FitProduct;
  explanation: string | null;
  loadingExplanation: boolean;
}

const fitColor = (fit: string) => {
  if (fit.includes("tight")) return "text-orange-500";
  if (fit.includes("short")) return "text-orange-400";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return "text-green-500";
  if (fit === "relaxed") return "text-blue-400";
  if (fit.includes("loose") || fit === "oversized") return "text-blue-500";
  if (fit.includes("long")) return "text-blue-400";
  return "text-foreground/75";
};

const fitBg = (fit: string) => {
  if (fit.includes("tight") || fit.includes("short")) return "bg-orange-500";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return "bg-green-500";
  return "bg-blue-500";
};

function SizeCard({ result, isExpanded, onToggle }: {
  result: SizeFitResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-2xl border transition-colors ${
      result.recommended
        ? "border-accent/30 bg-accent/5"
        : result.alternate
        ? "border-foreground/[0.08] bg-card/40"
        : "border-foreground/[0.04] bg-card/20"
    }`}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold text-foreground">{result.size}</span>
          {result.recommended && (
            <span className="text-[9px] font-semibold tracking-[0.1em] px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              RECOMMENDED
            </span>
          )}
          {result.alternate && (
            <span className="text-[9px] font-semibold tracking-[0.1em] px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/80">
              ALTERNATE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${
            result.fitScore >= 80 ? "text-green-500" : result.fitScore >= 60 ? "text-accent" : "text-orange-500"
          }`}>{result.fitScore}</span>
          <ChevronDown className={`h-4 w-4 text-foreground/75 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {result.regions.map(r => (
                <div key={r.region} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground/75">{r.region}</span>
                    <span className={`text-[10px] font-semibold ${fitColor(r.fit)}`}>
                      {r.fit.replace("-", " ")}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${fitBg(r.fit)}`}
                      style={{ width: `${Math.min(100, Math.max(10, 50 + r.delta * 2))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FitResults({ result, product, explanation, loadingExplanation }: Props) {
  const [expandedSize, setExpandedSize] = useState<string | null>(result.recommendedSize);

  return (
    <div className="space-y-5">
      {/* Product header */}
      <div className="flex gap-4">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-36 w-24 rounded-xl object-cover" />
        ) : (
          <div className="h-36 w-24 rounded-xl bg-foreground/[0.04] flex items-center justify-center">
            <span className="font-display text-2xl font-bold text-foreground/75">{product.name.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 space-y-2">
          <p className="text-[10px] tracking-[0.1em] text-foreground/80">{product.brand}</p>
          <p className="font-display text-base font-medium text-foreground">{product.name}</p>
          <p className="text-lg font-bold text-foreground">${product.price}</p>
          <div className="flex gap-3 mt-1">
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-foreground/75" />
              <span className="text-[9px] text-foreground/80">Data: {result.productDataQuality}/100</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-3 w-3 text-foreground/75" />
              <span className="text-[9px] text-foreground/80">Scan: {result.scanQuality}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence warning */}
      {result.confidenceModifier < 0.7 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
          <span className="text-xs text-orange-400/80">
            Limited confidence — product data or scan quality is below ideal.
          </span>
        </div>
      )}

      {/* Recommendation hero */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 mb-2">RECOMMENDED SIZE</p>
        <p className="font-display text-4xl font-bold text-foreground">{result.recommendedSize}</p>
        {result.alternateSize !== "N/A" && (
          <p className="text-xs text-foreground/80 mt-1">Alt: {result.alternateSize}</p>
        )}
      </div>

      {/* Size breakdown */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 mb-3">SIZE-BY-SIZE BREAKDOWN</p>
        <div className="space-y-2">
          {result.sizeResults.map(sr => (
            <SizeCard
              key={sr.size}
              result={sr}
              isExpanded={expandedSize === sr.size}
              onToggle={() => setExpandedSize(expandedSize === sr.size ? null : sr.size)}
            />
          ))}
        </div>
      </div>

      {/* AI Explanation */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 mb-3">FIT ANALYSIS</p>
        {loadingExplanation ? (
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-foreground/[0.04] animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-foreground/[0.04] animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-foreground/[0.04] animate-pulse" />
          </div>
        ) : (
          <p className="text-sm font-light leading-relaxed text-foreground/85">
            {explanation || result.summary}
          </p>
        )}
      </div>
    </div>
  );
}
