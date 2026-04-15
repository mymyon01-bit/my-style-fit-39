import { useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { mockProducts } from "@/lib/mockData";
import {
  BodyMeasurements, ConfidenceLevel, defaultBodyMeasurements,
  computeFit, mockProductFitData, FitResult
} from "@/lib/fitEngine";
import { supabase } from "@/integrations/supabase/client";
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

const FitPage = () => {
  const { t } = useI18n();
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

  const handleScanComplete = useCallback((quality: number) => {
    setScanQuality(quality);
    // After scan, auto-advance to measurements
    setTimeout(() => setActiveTab("measurements"), 800);
  }, []);

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

    // Fetch Perplexity explanation
    fetchExplanation(result, productId);
  }, [measurements, scanQuality]);

  const fetchExplanation = async (result: FitResult, productId: string) => {
    setLoadingExplanation(true);
    setExplanation(null);
    try {
      const product = mockProducts.find(p => p.id === productId);
      const { data, error } = await supabase.functions.invoke("fit-explain", {
        body: {
          summary: result.summary,
          recommendedSize: result.recommendedSize,
          alternateSize: result.alternateSize,
          fitScore: result.sizeResults.find(s => s.recommended)?.fitScore,
          productName: product?.name,
          productBrand: product?.brand,
          productDataQuality: result.productDataQuality,
          scanQuality: result.scanQuality,
          regions: result.sizeResults.find(s => s.recommended)?.regions,
        },
      });
      if (!error && data?.explanation) {
        setExplanation(data.explanation);
      }
    } catch {
      // fallback to summary
    } finally {
      setLoadingExplanation(false);
    }
  };

  const selectedProduct = selectedProductId ? mockProducts.find(p => p.id === selectedProductId) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-foreground/[0.04]">
        <div className="mx-auto max-w-lg px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/40">WARDROBE</span>
            <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/25">FIT ENGINE</span>
          </div>

          {/* Tab bar */}
          <div className="flex">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 pb-3 text-center"
              >
                <span className={`text-[10px] font-semibold tracking-[0.15em] transition-colors ${
                  activeTab === tab.id ? "text-foreground" : "text-foreground/25"
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

      {/* Content */}
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

            {activeTab === "results" && fitResult && selectedProduct ? (
              <FitResults
                result={fitResult}
                product={selectedProduct}
                explanation={explanation}
                loadingExplanation={loadingExplanation}
              />
            ) : activeTab === "results" && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-foreground/20">Select a product in CHECK tab first</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FitPage;
