import { useI18n } from "@/lib/i18n";
import { mockProducts, mockBrands, mockOutfits, mockUserProfile } from "@/lib/mockData";
import ProductCard from "@/components/ProductCard";
import BrandCard from "@/components/BrandCard";
import OutfitCard from "@/components/OutfitCard";
import SectionHeader from "@/components/SectionHeader";
import { Settings, CloudSun } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

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
        {/* AI Style Summary Card */}
        <div className="mx-4 mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <span className="text-lg">✨</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                {t("forYou")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {mockUserProfile.aiSummary[0]}
              </p>
            </div>
          </div>
        </div>

        {/* Weather pill */}
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
          <CloudSun className="h-4 w-4 text-accent" />
          <span className="text-xs text-muted-foreground">
            {t("weatherToday")}: 22°C, Partly Cloudy — Lightweight layers recommended
          </span>
        </div>

        {/* Today's Picks */}
        <SectionHeader title={t("todaysPicks")} onSeeAll={() => navigate("/discover")} />
        <div className="grid grid-cols-2 gap-3 px-4">
          {mockProducts.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* Recommended Brands */}
        <SectionHeader title={t("recommendedBrands")} />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {mockBrands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>

        {/* Full Looks */}
        <SectionHeader title={t("fullLooks")} />
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
          {mockOutfits.map((outfit) => (
            <OutfitCard key={outfit.id} outfit={outfit} />
          ))}
        </div>

        {/* More Picks */}
        <SectionHeader title={t("bodyFitOptimized")} />
        <div className="grid grid-cols-2 gap-3 px-4">
          {mockProducts.slice(4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
