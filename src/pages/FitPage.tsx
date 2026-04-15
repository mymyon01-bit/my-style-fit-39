import { useState, useCallback, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  BodyMeasurements, ConfidenceLevel, defaultBodyMeasurements,
  computeFit, mockProductFitData, FitResult
} from "@/lib/fitEngine";
import FitBodyScan from "@/components/fit/FitBodyScan";
import FitMeasurements from "@/components/fit/FitMeasurements";
import FitProductCheck from "@/components/fit/FitProductCheck";
import FitResults from "@/components/fit/FitResults";

type Tab = "scan" | "measurements" | "check" | "results";

const TABS: { id: Tab; label: string }[] = [
  { id: "scan", label: "SCAN" },
  { id: "measurements", label: "BODY" },
  { id: "check", label: "CHECK" },
  { id: "results", label: "RESULTS" },
];

const PRODUCT_INFO: Record<string, { name: string; brand: string; price: number; category: "tops" | "bottoms" }> = {
  "3": { name: "Oversized Cotton Shirt", brand: "Lemaire", price: 195, category: "tops" },
  "5": { name: "Merino Crew Neck", brand: "AMI Paris", price: 220, category: "tops" },
  "2": { name: "Straight Leg Trousers", brand: "ARKET", price: 89, category: "bottoms" },
  "6": { name: "Wide Leg Linen Pants", brand: "Our Legacy", price: 175, category: "bottoms" },
};

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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
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

  const handleScanComplete = useCallback((quality: number) => {
    setScanQuality(quality);
    setTimeout(() => { setActiveTab("measurements"); if (user) saveBodyProfile(); }, 800);
  }, [user, measurements]);

  const handleMeasurementUpdate = useCallback((key: keyof BodyMeasurements, value: number) => {
    setMeasurements(prev => ({ ...prev, [key]: { value, confidence: "high" as ConfidenceLevel } }));
  }, []);

  const handleSelectProduct = useCallback((productId: string) => {
    const fitData = mockProductFitData[productId];
    if (!fitData) return;
    const body: BodyMeasurements = {} as any;
    for (const [k, v] of Object.entries(measurements)) (body as any)[k] = v.value;
    const result = computeFit(body, fitData, scanQuality || 75);
    setSelectedProductId(productId);
    setFitResult(result);
    setActiveTab("results");
    fetchExplanation(result, productId);
  }, [measurements, scanQuality]);

  const fetchExplanation = async (result: FitResult, productId: string) => {
    setLoadingExplanation(true);
    setExplanation(null);
    try {
      const product = PRODUCT_INFO[productId];
      const regions = result.sizeResults.find(s => s.recommended)?.regions || [];
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "fit-explanation",
          context: {
            summary: result.summary, recommendedSize: result.recommendedSize, alternateSize: result.alternateSize,
            fitScore: result.sizeResults.find(s => s.recommended)?.fitScore, productName: product?.name,
            productBrand: product?.brand, productDataQuality: result.productDataQuality, scanQuality: result.scanQuality,
            regionText: regions.map(r => `${r.region}: ${r.fit} (${r.delta}cm)`).join(", "),
          },
        },
      });
      if (!error && data?.response) setExplanation(data.response);
    } catch { /* fallback */ } finally { setLoadingExplanation(false); }
  };

  const selectedProduct = selectedProductId ? PRODUCT_INFO[selectedProductId] : null;
  const fitResultProduct = selectedProduct ? {
    id: selectedProductId!, name: selectedProduct.name, brand: selectedProduct.brand,
    price: selectedProduct.price, category: selectedProduct.category,
    image: "", url: "#", fitScore: 0, reason: "", recommendedSize: "", fitComment: "",
  } : null;

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-16 lg:pt-20">
      {/* Header */}
      <div className="mx-auto max-w-lg px-8 pt-8 lg:max-w-2xl lg:px-12 lg:pt-12">
        <div className="flex items-baseline justify-between mb-8 lg:mb-12">
          <span className="font-display text-[11px] font-medium tracking-[0.35em] text-foreground/25 lg:hidden">WARDROBE</span>
          <span className="text-[9px] font-medium tracking-[0.25em] text-foreground/20 lg:text-[10px]">FIT</span>
        </div>

        {/* Tabs */}
        <div className="flex">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="relative flex-1 pb-4 text-center lg:pb-5">
              <span className={`text-[9px] font-medium tracking-[0.2em] transition-colors duration-300 lg:text-[10px] ${
                activeTab === tab.id ? "text-foreground/70" : "text-foreground/20"
              }`}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div layoutId="fit-tab" className="absolute bottom-0 left-1/4 right-1/4 h-px bg-accent/50" />
              )}
            </button>
          ))}
        </div>
        <div className="h-px bg-foreground/[0.04]" />
      </div>

      <div className="mx-auto max-w-lg px-8 pt-8 lg:max-w-2xl lg:px-12 lg:pt-12">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            {activeTab === "scan" && <FitBodyScan onScanComplete={handleScanComplete} />}
            {activeTab === "measurements" && <FitMeasurements measurements={measurements} onUpdate={handleMeasurementUpdate} />}
            {activeTab === "check" && <FitProductCheck onSelectProduct={handleSelectProduct} />}
            {activeTab === "results" && fitResult && fitResultProduct ? (
              <FitResults result={fitResult} product={fitResultProduct} explanation={explanation} loadingExplanation={loadingExplanation} />
            ) : activeTab === "results" && (
              <div className="py-24 text-center space-y-3 lg:py-32">
                <p className="text-sm text-foreground/25">Select a product first</p>
                <p className="text-[10px] text-foreground/15">Go to CHECK to pick an item</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FitPage;
