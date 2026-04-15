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

// Product info keyed to fit data IDs
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

  useEffect(() => {
    if (user) loadBodyProfile();
  }, [user]);

  const loadBodyProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("body_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
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
    const body = {
      user_id: user.id,
      height_cm: measurements.heightCm.value,
      shoulder_width_cm: measurements.shoulderWidthCm.value,
      waist_cm: measurements.waistCm.value,
      inseam_cm: measurements.inseamCm.value,
      weight_kg: null,
      scan_confidence: scanQuality,
      silhouette_type: "balanced",
    };
    await supabase.from("body_profiles").upsert(body, { onConflict: "user_id" });
  };

  const handleScanComplete = useCallback((quality: number) => {
    setScanQuality(quality);
    setTimeout(() => {
      setActiveTab("measurements");
      if (user) saveBodyProfile();
    }, 800);
  }, [user, measurements]);

  const handleMeasurementUpdate = useCallback((key: keyof BodyMeasurements, value: number) => {
    setMeasurements(prev => ({
      ...prev,
      [key]: { value, confidence: "high" as ConfidenceLevel },
    }));
  }, []);

  const handleSelectProduct = useCallback((productId: string) => {
    const fitData = mockProductFitData[productId];
    if (!fitData) return;

    const body: BodyMeasurements = {} as any;
    for (const [k, v] of Object.entries(measurements)) {
      (body as any)[k] = v.value;
    }

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
            summary: result.summary,
            recommendedSize: result.recommendedSize,
            alternateSize: result.alternateSize,
            fitScore: result.sizeResults.find(s => s.recommended)?.fitScore,
            productName: product?.name,
            productBrand: product?.brand,
            productDataQuality: result.productDataQuality,
            scanQuality: result.scanQuality,
            regionText: regions.map(r => `${r.region}: ${r.fit} (${r.delta}cm)`).join(", "),
          },
        },
      });
      if (!error && data?.response) {
        setExplanation(data.response);
      }
    } catch {
      // fallback to summary
    } finally {
      setLoadingExplanation(false);
    }
  };

  const selectedProduct = selectedProductId ? PRODUCT_INFO[selectedProductId] : null;

  const fitResultProduct = selectedProduct ? {
    id: selectedProductId!,
    name: selectedProduct.name,
    brand: selectedProduct.brand,
    price: selectedProduct.price,
    category: selectedProduct.category,
    image: "",
    url: "#",
    fitScore: 0,
    reason: "",
    recommendedSize: "",
    fitComment: "",
  } : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-foreground/[0.04]">
        <div className="mx-auto max-w-lg px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/70">WARDROBE</span>
            <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">FIT ENGINE</span>
          </div>
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 pb-3 text-center"
              >
                <span className={`text-[10px] font-semibold tracking-[0.15em] transition-colors ${
                  activeTab === tab.id ? "text-foreground" : "text-foreground/30"
                }`}>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="fit-tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 pt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "scan" && (
              <FitBodyScan onScanComplete={handleScanComplete} />
            )}
            {activeTab === "measurements" && (
              <FitMeasurements
                measurements={measurements}
                onUpdate={handleMeasurementUpdate}
              />
            )}
            {activeTab === "check" && (
              <FitProductCheck onSelectProduct={handleSelectProduct} />
            )}
            {activeTab === "results" && fitResult && fitResultProduct ? (
              <FitResults
                result={fitResult}
                product={fitResultProduct}
                explanation={explanation}
                loadingExplanation={loadingExplanation}
              />
            ) : activeTab === "results" && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                <p className="text-sm text-foreground/30">Select a product in CHECK tab first</p>
                <p className="text-xs text-foreground/20">Your body profile will be used for fit analysis</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FitPage;
