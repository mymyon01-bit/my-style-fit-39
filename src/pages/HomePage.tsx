import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { mockProducts, mockBrands, mockOutfits, mockUserProfile } from "@/lib/mockData";
import ProductCard from "@/components/ProductCard";
import BrandCard from "@/components/BrandCard";
import OutfitCard from "@/components/OutfitCard";
import SectionHeader from "@/components/SectionHeader";
import { Settings, CloudSun, Sparkles, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const moods = [
  { key: "relaxed2", emoji: "😌" },
  { key: "confident", emoji: "💪" },
  { key: "casual", emoji: "👋" },
  { key: "sharp", emoji: "🔥" },
  { key: "lazy", emoji: "🛋️" },
  { key: "dateReady", emoji: "💫" },
  { key: "energetic", emoji: "⚡" },
  { key: "creative", emoji: "🎨" },
] as const;

const HomePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground">
            {t("appName")}
          </h1>
          <button onClick={() => navigate("/settings")} className="text-muted-foreground">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        {/* Mood Selection */}
        <div className="px-4 pt-5">
          <p className="text-sm font-medium text-foreground">{t("howAreYouFeeling")}</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {moods.map(mood => (
              <button
                key={mood.key}
                onClick={() => setSelectedMood(selectedMood === mood.key ? null : mood.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
                  selectedMood === mood.key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                <span>{mood.emoji}</span>
                {t(mood.key as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Weather pill */}
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5">
          <CloudSun className="h-4 w-4 text-accent" />
          <span className="text-xs text-muted-foreground">
            22°C · Partly Cloudy — Lightweight layers recommended
          </span>
        </div>

        {/* AI Style Summary */}
        <div className="mx-4 mt-3 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                {t("forYou")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {mockUserProfile.aiSummary[0]}
              </p>
            </div>
          </div>
        </div>

        {/* AI Stylist Promo */}
        <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-accent/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">{t("aiStylist")}</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
                {t("premiumFeature")}
              </span>
            </div>
            <button onClick={() => navigate("/fit")} className="text-xs font-medium text-accent">
              {t("unlockStylist")} →
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("stylistDesc")}</p>
        </div>

        {/* Mood-based recommendations */}
        {selectedMood && (
          <>
            <SectionHeader title={t("basedOnMood")} />
            <div className="grid grid-cols-2 gap-3 px-4">
              {mockProducts.slice(0, 2).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}

        {/* Today's Looks */}
        <SectionHeader title={t("todaysLooks")} onSeeAll={() => navigate("/discover")} />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {mockOutfits.map(outfit => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </div>

        {/* Weather Optimized */}
        <SectionHeader title={t("weatherOptimized")} />
        <div className="grid grid-cols-2 gap-3 px-4">
          {mockProducts.slice(0, 4).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Recommended Brands */}
        <SectionHeader title={t("recommendedBrands")} />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {mockBrands.map(brand => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>

        {/* Best For You */}
        <SectionHeader title={t("bestForYouToday")} />
        <div className="grid grid-cols-2 gap-3 px-4">
          {mockProducts.slice(4).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
