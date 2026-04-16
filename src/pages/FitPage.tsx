import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
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

type Tab = "scan" | "measurements" | "check" | "results";

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

// Generate approximate fit data for DB products without exact measurements
function generateApproximateFitData(product: SelectedProduct): ProductFitData {
  const cat = product.category === "bottoms" ? "bottoms" : "tops";
  const fitType = (product.fitType || "regular") as "slim" | "regular" | "relaxed" | "oversized";
  
  // Generate approximate size chart based on category and fit type
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
  const [activeTab, setActiveTab] = useState<Tab>("scan");
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

  useEffect(() => { if (user) loadBodyProfile(); }, [user]);

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
      weight_kg: null,
      scan_confidence: scanQuality,
      silhouette_type: "balanced",
    }, { onConflict: "user_id" });
  };

  const handleScanComplete = useCallback((quality: number, estimatedMeasurements?: Record<string, number>) => {
    setScanQuality(quality);
    // If scan returned estimated measurements, apply them
    if (estimatedMeasurements) {
      setMeasurements(prev => {
        const updated = { ...prev };
        if (estimatedMeasurements.height_cm) updated.heightCm = { value: estimatedMeasurements.height_cm, confidence: "medium" };
        if (estimatedMeasurements.shoulder_width_cm) updated.shoulderWidthCm = { value: estimatedMeasurements.shoulder_width_cm, confidence: "medium" };
        if (estimatedMeasurements.waist_cm) updated.waistCm = { value: estimatedMeasurements.waist_cm, confidence: "medium" };
        if (estimatedMeasurements.inseam_cm) updated.inseamCm = { value: estimatedMeasurements.inseam_cm, confidence: "medium" };
        if (estimatedMeasurements.chest_cm) updated.chestCm = { value: estimatedMeasurements.chest_cm, confidence: "low" };
        if (estimatedMeasurements.hip_cm) updated.hipCm = { value: estimatedMeasurements.hip_cm, confidence: "low" };
        return updated;
      });
    }
    setTimeout(() => { setActiveTab("measurements"); if (user) saveBodyProfile(); }, 800);
  }, [user, measurements]);

  const handleMeasurementUpdate = useCallback((key: keyof BodyMeasurements, value: number) => {
    setMeasurements(prev => ({ ...prev, [key]: { value, confidence: "high" as ConfidenceLevel } }));
    // Auto-save after manual edit
    if (user) {
      const dbMap: Record<string, string> = {
        heightCm: "height_cm",
        shoulderWidthCm: "shoulder_width_cm",
        waistCm: "waist_cm",
        inseamCm: "inseam_cm",
      };
      const dbKey = dbMap[key];
      if (dbKey) {
        supabase.from("body_profiles").upsert({
          user_id: user.id,
          [dbKey]: value,
        }, { onConflict: "user_id" }).then(({ error }) => {
          if (error) console.error("Auto-save error:", error);
        });
      }
    }
  }, [user]);

  const handleSelectProduct = useCallback((product: SelectedProduct) => {
    // Get fit data - from mock if available, otherwise generate approximate
    let fitData: ProductFitData;
    if (product.source === "mock" && mockProductFitData[product.id]) {
      fitData = mockProductFitData[product.id];
    } else {
      fitData = generateApproximateFitData(product);
    }

    const body: BodyMeasurements = {} as any;
    for (const [k, v] of Object.entries(measurements)) (body as any)[k] = v.value;
    const result = computeFit(body, fitData, scanQuality || 75);
    
    setSelectedProduct(product);
    setFitResult(result);
    setActiveTab("results");
    fetchExplanation(result, product);
  }, [measurements, scanQuality]);

  const fetchExplanation = async (result: FitResult, product: SelectedProduct) => {
    setLoadingExplanation(true);
    setExplanation(null);
    try {
      const regions = result.sizeResults.find(s => s.recommended)?.regions || [];
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "fit-explanation",
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
      {/* Header */}
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-baseline justify-between mb-10 md:mb-12 lg:mb-14">
          <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 md:text-[13px] lg:hidden">WARDROBE</span>
          <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/75 md:text-[11px]">FIT</span>
        </div>

        {/* Tabs */}
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

      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12 lg:pt-12">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {activeTab === "scan" && <FitBodyScan onScanComplete={handleScanComplete} />}
            {activeTab === "measurements" && <FitMeasurements measurements={measurements} onUpdate={handleMeasurementUpdate} />}
            {activeTab === "check" && <FitProductCheck onSelectProduct={handleSelectProduct} />}
            {activeTab === "results" && fitResult && fitResultProduct ? (
              <FitResults
                result={fitResult}
                product={fitResultProduct}
                explanation={explanation}
                loadingExplanation={loadingExplanation}
                onRescan={() => setActiveTab("scan")}
                onEditMeasurements={() => setActiveTab("measurements")}
              />
            ) : activeTab === "results" && (
              <div className="py-24 text-center space-y-4 md:py-28 lg:py-32">
                <p className="text-[14px] text-foreground/80">Select a product first</p>
                <p className="text-[11px] text-foreground/80">Go to CHECK to pick an item</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FitPage;
