import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  BodyMeasurements, ConfidenceLevel, defaultBodyMeasurements,
  computeFit, mockProductFitData, FitResult, ProductFitData
} from "@/lib/fitEngine";
import FitBodyScan from "@/components/fit/FitBodyScan";
import FitMeasurements from "@/components/fit/FitMeasurements";
import FitProductCheck from "@/components/fit/FitProductCheck";
import FitResults from "@/components/fit/FitResults";
import FitTryOnTrigger from "@/components/fit/FitTryOnTrigger";
import BodyPhotoPicker from "@/components/fit/BodyPhotoPicker";
import type { UserBodyImage } from "@/lib/fit/userBodyImages";
import { recordEvent } from "@/lib/diagnostics";
import { toast } from "sonner";

type Tab = "scan" | "measurements" | "check" | "results";
export type FitMode = "free" | "premium";

interface SelectedProduct {
  id: string;
  name: string;
  brand: string;
  price: number | null;
  image: string;
  url: string;
  category: string;
  fitType: string;
  dataQuality: number;
  source: "mock" | "db";
}

const TABS: { id: Tab; label: string }[] = [
  { id: "scan", label: "SCAN" },
  { id: "measurements", label: "BODY" },
  { id: "check", label: "CHECK" },
  { id: "results", label: "RESULTS" },
];

function generateApproximateFitData(product: SelectedProduct): ProductFitData {
  const cat = product.category === "bottoms" ? "bottoms" : "tops";
  const fitType = (product.fitType || "regular") as "slim" | "regular" | "relaxed" | "oversized";
  const fitOffsets = { slim: 0, regular: 4, relaxed: 8, oversized: 14 };
  const offset = fitOffsets[fitType] || 4;

  if (cat === "tops") {
    return {
      category: "tops",
      fitType,
      hasStretch: false,
      dataQualityScore: product.dataQuality,
      sizes: {
        S:  { shoulder: 42 + offset/2, chest: 92 + offset, waist: 86 + offset, sleeveLength: 60, bodyLength: 66 },
        M:  { shoulder: 44 + offset/2, chest: 98 + offset, waist: 92 + offset, sleeveLength: 62, bodyLength: 68 },
        L:  { shoulder: 46 + offset/2, chest: 104 + offset, waist: 98 + offset, sleeveLength: 64, bodyLength: 70 },
        XL: { shoulder: 48 + offset/2, chest: 110 + offset, waist: 104 + offset, sleeveLength: 66, bodyLength: 72 },
      },
    };
  }

  return {
    category: "bottoms",
    fitType,
    hasStretch: false,
    dataQualityScore: product.dataQuality,
    sizes: {
      "30": { waist: 78 + offset, hip: 96 + offset, thigh: 56 + offset/2, inseam: 80, rise: 26 },
      "32": { waist: 82 + offset, hip: 100 + offset, thigh: 60 + offset/2, inseam: 81, rise: 27 },
      "34": { waist: 86 + offset, hip: 104 + offset, thigh: 64 + offset/2, inseam: 82, rise: 28 },
      "36": { waist: 90 + offset, hip: 108 + offset, thigh: 68 + offset/2, inseam: 83, rise: 29 },
    },
  };
}

const FitPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { productId: routeProductId } = useParams<{ productId?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [fitMode, setFitMode] = useState<FitMode>("free");
  const [scanQuality, setScanQuality] = useState(0);
  const [measurements, setMeasurements] = useState<
    Record<keyof BodyMeasurements, { value: number; confidence: ConfidenceLevel }>
  >(() => {
    const m = {} as any;
    for (const [k, v] of Object.entries(defaultBodyMeasurements)) {
      m[k] = { value: v, confidence: "medium" as ConfidenceLevel };
    }
    return m;
  });
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [refining, setRefining] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [userBodyImageUrl, setUserBodyImageUrl] = useState<string | null>(null);
  const [selectedBodyImage, setSelectedBodyImage] = useState<UserBodyImage | null>(null);
  // Simple shape inputs — refine fit accuracy without raw cm.
  const [bodyShape, setBodyShape] = useState<import("@/lib/fit/bodyShape").BodyShapeInput>({});

  const handleSelectBodyImage = useCallback((image: UserBodyImage, url: string) => {
    setSelectedBodyImage(image);
    setUserBodyImageUrl(url);
  }, []);

  const handleClearBodyImage = useCallback(() => {
    setSelectedBodyImage(null);
    setUserBodyImageUrl(null);
  }, []);

  // Default activeSize to the recommended size whenever a new fit result lands.
  useEffect(() => {
    if (fitResult?.recommendedSize) setActiveSize(fitResult.recommendedSize);
  }, [fitResult?.recommendedSize]);

  // Load latest body scan front photo so the photo-based try-on path can fire.
  useEffect(() => {
    if (!user) { setUserBodyImageUrl(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("body_scan_images")
        .select("public_url")
        .eq("user_id", user.id)
        .eq("image_type", "front")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setUserBodyImageUrl(data?.public_url ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const canUsePremium = subscription.isPremium;

  useEffect(() => { if (user) loadBodyProfile(); }, [user]);

  // ── DEEP LINK: /fit/:productId — auto-load product and jump to RESULTS ──
  const deepLinkAttempted = useRef<string | null>(null);
  useEffect(() => {
    if (!routeProductId) return;
    if (deepLinkAttempted.current === routeProductId) return;
    deepLinkAttempted.current = routeProductId;

    (async () => {
      try {
        // Try sessionStorage hand-off first (set by ProductDetailSheet)
        const cached = sessionStorage.getItem(`fit:product:${routeProductId}`);
        let product: SelectedProduct | null = null;
        if (cached) {
          try { product = JSON.parse(cached) as SelectedProduct; } catch { /* ignore */ }
        }
        if (!product) {
          const { data } = await supabase
            .from("product_cache")
            .select("id, name, brand, price, image_url, source_url, category, fit, style_tags")
            .eq("id", routeProductId)
            .maybeSingle();
          if (!data) {
            toast.error("Product not found");
            return;
          }
          const parsed = data.price ? parseFloat(String(data.price).replace(/[^0-9.]/g, "")) : NaN;
          product = {
            id: data.id,
            name: data.name,
            brand: data.brand || "Unknown",
            price: Number.isFinite(parsed) ? parsed : null,
            image: data.image_url || "",
            url: data.source_url || "#",
            category: (data.category || "tops").toLowerCase().includes("bottom") ? "bottoms" : "tops",
            fitType: data.fit || "regular",
            dataQuality: 60,
            source: "db",
          };
        }
        // Ensure we have a weight so we can compute fit and jump straight to RESULTS
        if (!weightKg) setWeightKg(70);
        // Wait a tick so body profile is loaded before computing fit
        setTimeout(() => handleSelectProduct(product!, { silent: true }), 350);
      } catch (e) {
        console.error("[FitPage] deep-link load failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProductId]);

  const loadBodyProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      const update = { ...measurements };
      if (data.height_cm) update.heightCm = { value: Number(data.height_cm), confidence: "high" };
      if (data.shoulder_width_cm) update.shoulderWidthCm = { value: Number(data.shoulder_width_cm), confidence: "high" };
      if (data.waist_cm) update.waistCm = { value: Number(data.waist_cm), confidence: "high" };
      if (data.inseam_cm) update.inseamCm = { value: Number(data.inseam_cm), confidence: "high" };
      if (data.scan_confidence) setScanQuality(Number(data.scan_confidence));
      if (data.weight_kg) setWeightKg(Number(data.weight_kg));
      setMeasurements(update);
    }
  };

  const saveBodyProfile = async () => {
    if (!user) return;
    await supabase.from("body_profiles").upsert({
      user_id: user.id,
      height_cm: measurements.heightCm.value,
      shoulder_width_cm: measurements.shoulderWidthCm.value,
      waist_cm: measurements.waistCm.value,
      inseam_cm: measurements.inseamCm.value,
      weight_kg: weightKg,
      scan_confidence: scanQuality,
      silhouette_type: "balanced",
    }, { onConflict: "user_id" });
  };

  const handleScanComplete = useCallback((quality: number, estimatedMeasurements?: Record<string, number>, mode?: FitMode) => {
    setScanQuality(quality);
    if (mode) setFitMode(mode);
    if (estimatedMeasurements) {
      setMeasurements(prev => {
        const updated = { ...prev };
        const conf: ConfidenceLevel = mode === "premium" ? "high" : "medium";
        if (estimatedMeasurements.height_cm) updated.heightCm = { value: estimatedMeasurements.height_cm, confidence: conf };
        if (estimatedMeasurements.shoulder_width_cm) updated.shoulderWidthCm = { value: estimatedMeasurements.shoulder_width_cm, confidence: conf };
        if (estimatedMeasurements.waist_cm) updated.waistCm = { value: estimatedMeasurements.waist_cm, confidence: conf };
        if (estimatedMeasurements.inseam_cm) updated.inseamCm = { value: estimatedMeasurements.inseam_cm, confidence: conf };
        if (estimatedMeasurements.chest_cm) updated.chestCm = { value: estimatedMeasurements.chest_cm, confidence: mode === "premium" ? "medium" : "low" };
        if (estimatedMeasurements.hip_cm) updated.hipCm = { value: estimatedMeasurements.hip_cm, confidence: mode === "premium" ? "medium" : "low" };
        return updated;
      });
    }
    setTimeout(() => { setActiveTab("measurements"); if (user) saveBodyProfile(); }, 800);
  }, [user, measurements]);

  const handleMeasurementUpdate = useCallback((key: keyof BodyMeasurements, value: number) => {
    setMeasurements(prev => ({ ...prev, [key]: { value, confidence: "high" as ConfidenceLevel } }));
    if (user) {
      const saveMap: Partial<Record<keyof BodyMeasurements, () => void>> = {
        heightCm: () => supabase.from("body_profiles").update({ height_cm: value }).eq("user_id", user.id),
        shoulderWidthCm: () => supabase.from("body_profiles").update({ shoulder_width_cm: value }).eq("user_id", user.id),
        waistCm: () => supabase.from("body_profiles").update({ waist_cm: value }).eq("user_id", user.id),
        inseamCm: () => supabase.from("body_profiles").update({ inseam_cm: value }).eq("user_id", user.id),
      };
      saveMap[key]?.();
    }
  }, [user]);

  const handleBulkUpdate = useCallback((updates: Partial<Record<keyof BodyMeasurements, number>>) => {
    setMeasurements(prev => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) {
          next[key as keyof BodyMeasurements] = {
            value: val,
            confidence: "medium" as ConfidenceLevel,
          };
        }
      }
      return next;
    });
  }, []);

  const handleSelectProduct = useCallback((product: SelectedProduct, opts?: { silent?: boolean }) => {
    // ── INSTANT-DEMO MODE ────────────────────────────────────────────────
    // FIT must run the moment a product is selected. Inject safe defaults
    // for any missing body data so we never block on onboarding.
    const SAFE_DEFAULTS = {
      heightCm: 175, weightKg: 70, shoulderWidthCm: 45,
      chestCm: 96, waistCm: 80, hipCm: 96, inseamCm: 80,
    };
    const effectiveWeight = (weightKg && weightKg >= 40 && weightKg <= 120) ? weightKg : SAFE_DEFAULTS.weightKg;
    if (!weightKg) setWeightKg(SAFE_DEFAULTS.weightKg);

    const startedAt = performance.now();
    let fitData: ProductFitData;
    if (product.source === "mock" && mockProductFitData[product.id]) {
      fitData = mockProductFitData[product.id];
    } else {
      fitData = generateApproximateFitData(product);
    }

    // Build a complete body — fill any missing measurement with defaults.
    const body: BodyMeasurements = {} as any;
    for (const [k, v] of Object.entries(measurements)) {
      const val = (v as { value: number }).value;
      const fallback = (SAFE_DEFAULTS as any)[k];
      (body as any)[k] = (val && val > 0) ? val : (fallback ?? val);
    }
    let result: FitResult | null = null;
    try {
      result = computeFit(body, fitData, scanQuality || 75);
      setSelectedProduct(product);
      setFitResult(result);
      setActiveTab("results");
      const recommended = result.sizeResults.find(s => s.recommended);
      recordEvent({
        event_name: "fit_generate",
        status: "success",
        duration_ms: performance.now() - startedAt,
        metadata: {
          source: product.source,
          fit_type: product.fitType,
          scan_quality: scanQuality || 75,
          fit_score: recommended?.fitScore ?? null,
          confidence_modifier: result.confidenceModifier,
          recommended_size: result.recommendedSize,
          weight_kg: effectiveWeight,
          used_defaults: !weightKg,
        },
      });
      fetchExplanation(result, product, fitMode);
    } catch (err) {
      recordEvent({
        event_name: "fit_generate",
        status: "error",
        duration_ms: performance.now() - startedAt,
        metadata: { error: (err as Error)?.message?.slice(0, 200) || "unknown", source: product.source },
      });
      // Never throw — surface a friendly toast and keep the user in flow.
      if (!opts?.silent) toast.error("Couldn't compute fit — try a different product");
    }
  }, [measurements, scanQuality, fitMode, weightKg]);

  const fetchExplanation = async (result: FitResult, product: SelectedProduct, mode: FitMode) => {
    setLoadingExplanation(true);
    setExplanation(null);
    try {
      const regions = result.sizeResults.find(s => s.recommended)?.regions || [];
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "fit-explanation",
          fitMode: mode,
          context: {
            summary: result.summary,
            recommendedSize: result.recommendedSize,
            alternateSize: result.alternateSize,
            fitScore: result.sizeResults.find(s => s.recommended)?.fitScore,
            productName: product.name,
            productBrand: product.brand,
            productDataQuality: result.productDataQuality,
            scanQuality: result.scanQuality,
            regionText: regions.map(r => `${r.region}: ${r.fit} (${r.delta}cm)`).join(", "),
          },
        },
      });
      if (!error && data?.response) setExplanation(data.response);
    } catch { /* fallback to summary */ } finally { setLoadingExplanation(false); }
  };

  const handleRefineFit = useCallback(async () => {
    if (!canUsePremium) {
      toast("Premium subscription required for high-precision scan");
      return;
    }
    if (!selectedProduct || !fitResult) return;
    if (scanQuality < 65) {
      toast.error("Scan quality too low for precision analysis. Please retake your scan with clearer images.");
      return;
    }

    setRefining(true);
    setFitMode("premium");

    try {
      // Re-fetch explanation with premium tier
      const regions = fitResult.sizeResults.find(s => s.recommended)?.regions || [];
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "fit-explanation",
          fitMode: "premium",
          context: {
            summary: fitResult.summary,
            recommendedSize: fitResult.recommendedSize,
            alternateSize: fitResult.alternateSize,
            fitScore: fitResult.sizeResults.find(s => s.recommended)?.fitScore,
            productName: selectedProduct.name,
            productBrand: selectedProduct.brand,
            productCategory: selectedProduct.category,
            productFitType: selectedProduct.fitType,
            productDataQuality: fitResult.productDataQuality,
            scanQuality: fitResult.scanQuality,
            regionText: regions.map(r => `${r.region}: ${r.fit} (${r.delta}cm)`).join(", "),
            allSizes: fitResult.sizeResults.map(s => ({
              size: s.size,
              score: s.fitScore,
              regions: s.regions.map(r => `${r.region}:${r.fit}(${r.delta}cm)`).join(","),
            })),
          },
        },
      });
      if (!error && data?.response) {
        setExplanation(data.response);
        toast.success("Refined fit analysis complete");
      }
    } catch {
      toast.error("Refinement failed");
    } finally {
      setRefining(false);
    }
  }, [canUsePremium, selectedProduct, fitResult, scanQuality]);

  const fitResultProduct = selectedProduct ? {
    id: selectedProduct.id,
    name: selectedProduct.name,
    brand: selectedProduct.brand,
    price: selectedProduct.price,
    image: selectedProduct.image,
    url: selectedProduct.url,
    category: selectedProduct.category,
  } : null;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-baseline justify-between mb-10 md:mb-12 lg:mb-14">
          <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 md:text-[13px] lg:hidden">WARDROBE</span>
          <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/75 md:text-[11px]">FIT</span>
        </div>

        <div className="flex">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative flex-1 pb-5 text-center md:pb-6">
              <span className={`text-[10px] font-medium tracking-[0.2em] transition-colors duration-300 md:text-[11px] ${
                activeTab === tab.id ? "text-foreground/85" : "text-foreground/75"
              }`}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div layoutId="fit-tab" className="absolute bottom-0 left-1/4 right-1/4 h-px bg-accent/50" />
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-accent/[0.14]" />
      </div>

      {/* ── HEADLESS TRY-ON TRIGGER ──────────────────────────────────────────
          Mounts the moment a product + size are selected, regardless of which
          tab the user is on. Generation kicks off immediately so the hero is
          ready (or in flight) by the time RESULTS opens. */}
      {selectedProduct && activeSize && (
        <FitTryOnTrigger
          productKey={`${selectedProduct.url || selectedProduct.name}::${selectedProduct.brand || ""}`.toLowerCase().slice(0, 200)}
          productImageUrl={selectedProduct.image}
          productName={selectedProduct.name}
          productCategory={selectedProduct.category}
          productFitType={selectedProduct.fitType}
          productUrl={selectedProduct.url}
          selectedSize={activeSize}
          userImageUrl={userBodyImageUrl}
          bodyImageHash={selectedBodyImage?.image_hash ?? null}
          body={{
            heightCm: measurements.heightCm.value,
            weightKg: weightKg ?? null,
            shoulderWidthCm: measurements.shoulderWidthCm.value,
            chestCm: measurements.chestCm?.value ?? null,
            waistCm: measurements.waistCm.value,
            gender: null,
          }}
        />
      )}

      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12 lg:pt-12">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {activeTab === "scan" && (
              <>
                <BodyPhotoPicker
                  className="mb-8"
                  selectedImageId={selectedBodyImage?.id ?? null}
                  selectedImageUrl={userBodyImageUrl}
                  onSelect={handleSelectBodyImage}
                  onClear={handleClearBodyImage}
                />
                <FitBodyScan
                  onScanComplete={handleScanComplete}
                  canUsePremium={canUsePremium}
                />
                <NextButton onClick={() => setActiveTab("measurements")} label="Next: Body" />
              </>
            )}
            {activeTab === "measurements" && (
              <>
                <FitMeasurements
                  measurements={measurements}
                  onUpdate={handleMeasurementUpdate}
                  onBulkUpdate={handleBulkUpdate}
                  weightKg={weightKg}
                  onWeightChange={(w) => {
                    setWeightKg(w);
                    if (user) {
                      supabase.from("body_profiles")
                        .upsert({ user_id: user.id, weight_kg: w, height_cm: measurements.heightCm.value }, { onConflict: "user_id" })
                        .then(() => {});
                    }
                  }}
                  bodyShape={bodyShape}
                  onBodyShapeChange={setBodyShape}
                />
                <NextButton onClick={() => setActiveTab("check")} label="Next: Check" />
              </>
            )}
            {activeTab === "check" && (
              <>
                <FitProductCheck onSelectProduct={handleSelectProduct} />
                <NextButton onClick={() => setActiveTab("results")} label="Next: Results" />
              </>
            )}
            {activeTab === "results" && fitResult && fitResultProduct ? (
              <>
                <FitResults
                  result={fitResult}
                  product={fitResultProduct}
                  explanation={explanation}
                  loadingExplanation={loadingExplanation}
                  fitMode={fitMode}
                  canUsePremium={canUsePremium}
                  refining={refining}
                  bodyHeightCm={measurements.heightCm.value}
                  bodyWeightKg={weightKg}
                  bodyShape={bodyShape}
                  onRefineFit={handleRefineFit}
                  onRescan={() => setActiveTab("scan")}
                  onEditMeasurements={() => setActiveTab("measurements")}
                />
                <NextButton onClick={() => setActiveTab("scan")} label="Try Another · Restart" />
              </>
            ) : activeTab === "results" && (
              <div className="py-24 text-center space-y-4 md:py-28 lg:py-32">
                <p className="text-[14px] text-foreground/80">Select a product first</p>
                <p className="text-[11px] text-foreground/80">Go to CHECK to pick an item</p>
                <NextButton onClick={() => setActiveTab("check")} label="Go to Check" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const NextButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <div className="mt-10 flex justify-center md:mt-12">
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-8 py-3 text-[11px] font-medium tracking-[0.25em] text-foreground/85 transition-all duration-300 hover:border-accent/60 hover:bg-accent/20 md:px-10 md:py-3.5"
    >
      {label.toUpperCase()}
      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
    </button>
  </div>
);

export default FitPage;
