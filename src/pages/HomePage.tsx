import { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { mockProducts, mockBrands, mockOutfits, mockUserProfile } from "@/lib/mockData";
import { rankProducts, defaultUserProfile, defaultBodyProfile, defaultBehavior, getDefaultContext } from "@/lib/recommendation";
import ProductCard from "@/components/ProductCard";
import BrandCard from "@/components/BrandCard";
import OutfitCard from "@/components/OutfitCard";
import SectionHeader from "@/components/SectionHeader";
import { ProductCardSkeleton, OutfitCardSkeleton } from "@/components/Skeleton";
import { Settings, CloudSun, Sparkles, Lock, MapPin } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Ranked products using recommendation engine
  const context = useMemo(() => getDefaultContext(selectedMood), [selectedMood]);
  const trendingBrands = useMemo(() => ["COS", "Lemaire"], []);

  const rankedProducts = useMemo(
    () => rankProducts(mockProducts, defaultUserProfile, defaultBodyProfile, context, defaultBehavior, trendingBrands),
    [context, trendingBrands]
  );

  const moodProducts = useMemo(
    () => selectedMood ? rankedProducts.filter(p => p.scoreBreakdown.context > 60).slice(0, 4) : [],
    [selectedMood, rankedProducts]
  );

  const weatherProducts = rankedProducts.filter(p => p.scoreBreakdown.context > 55).slice(0, 4);
  const bestForYou = rankedProducts.slice(0, 4);
  const bodyFitProducts = rankedProducts.filter(p => p.scoreBreakdown.bodyCompat > 80).slice(0, 4);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold tracking-[0.15em] text-foreground">
            {t("appName")}
          </h1>
          <button onClick={() => navigate("/settings")} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-secondary text-muted-foreground">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        {/* Greeting + Weather */}
        <div className="px-4 pt-5">
          <p className="text-lg font-display font-semibold text-foreground">{greeting}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5">
              <CloudSun className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-medium text-foreground">22°C</span>
              <span className="text-[11px] text-muted-foreground">Partly cloudy</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Seoul</span>
            </div>
          </div>
        </div>

        {/* Mood Selection */}
        <div className="px-4 pt-5">
          <p className="text-sm font-medium text-foreground">{t("howAreYouFeeling")}</p>
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {moods.map(mood => (
              <button
                key={mood.key}
                onClick={() => setSelectedMood(selectedMood === mood.key ? null : mood.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
                  selectedMood === mood.key
                    ? "border-accent bg-accent/10 text-accent shadow-sm"
                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                }`}
              >
                <span>{mood.emoji}</span>
                {t(mood.key as any)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Style Summary */}
        <div className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
                {t("forYou")}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                {mockUserProfile.aiSummary[0]}
              </p>
            </div>
          </div>
        </div>

        {/* AI Stylist Promo */}
        <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-r from-accent/5 via-accent/8 to-accent/5 p-4">
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
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t("stylistDesc")}</p>
        </div>

        {/* Mood-based recommendations */}
        {selectedMood && moodProducts.length > 0 && (
          <>
            <SectionHeader title={t("basedOnMood")} subtitle={`${t(selectedMood as any)} · ${moodProducts.length} picks`} />
            <div className="grid grid-cols-2 gap-3 px-4">
              {isLoading
                ? [1,2].map(i => <ProductCardSkeleton key={i} />)
                : moodProducts.slice(0, 2).map(product => (
                    <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
                  ))
              }
            </div>
          </>
        )}

        {/* Today's Looks */}
        <SectionHeader title={t("todaysLooks")} onSeeAll={() => navigate("/discover")} />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {isLoading
            ? [1,2].map(i => <OutfitCardSkeleton key={i} />)
            : mockOutfits.map(outfit => (
                <OutfitCard key={outfit.id} outfit={outfit} />
              ))
          }
        </div>

        {/* Best For You — ranked by algorithm */}
        <SectionHeader title={t("bestForYouToday")} subtitle="AI-ranked for your profile" />
        <div className="grid grid-cols-2 gap-3 px-4">
          {isLoading
            ? [1,2,3,4].map(i => <ProductCardSkeleton key={i} />)
            : bestForYou.map(product => (
                <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
              ))
          }
        </div>

        {/* Weather Optimized */}
        <SectionHeader title={t("weatherOptimized")} subtitle="22°C · Lightweight layers" />
        <div className="grid grid-cols-2 gap-3 px-4">
          {weatherProducts.slice(0, 2).map(product => (
            <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
          ))}
        </div>

        {/* Recommended Brands */}
        <SectionHeader title={t("recommendedBrands")} />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {mockBrands.map(brand => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>

        {/* Body-Fit Products */}
        {bodyFitProducts.length > 0 && (
          <>
            <SectionHeader title={t("bodyFitOptimized")} subtitle="Matches your silhouette" />
            <div className="grid grid-cols-2 gap-3 px-4">
              {bodyFitProducts.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;
