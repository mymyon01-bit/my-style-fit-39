import { useI18n } from "@/lib/i18n";
import { mockProducts } from "@/lib/mockData";
import { rankProducts, defaultUserProfile, defaultBodyProfile, defaultBehavior, getDefaultContext } from "@/lib/recommendation";
import ProductCard from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/Skeleton";
import SectionHeader from "@/components/SectionHeader";
import { Search, SlidersHorizontal } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

const categories = ["allCategories", "tops", "bottoms", "outerwear", "shoes", "accessories"] as const;
const styles = ["minimal", "streetwear", "classic", "oldMoney", "chic", "cleanFit"] as const;

const DiscoverPage = () => {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState("allCategories");
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const context = useMemo(() => getDefaultContext(), []);
  const rankedProducts = useMemo(
    () => rankProducts(mockProducts, defaultUserProfile, defaultBodyProfile, context, defaultBehavior, ["COS", "Lemaire"]),
    [context]
  );

  const filtered = rankedProducts.filter((p) => {
    if (activeCategory !== "allCategories" && p.category !== activeCategory) return false;
    return true;
  });

  const trendingForYou = rankedProducts.filter(p => p.scoreBreakdown.social > 55).slice(0, 4);
  const bodyFitPicks = rankedProducts.filter(p => p.scoreBreakdown.bodyCompat > 80).slice(0, 4);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold text-foreground">{t("discover")}</h1>
          <button className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-secondary text-muted-foreground">
            <SlidersHorizontal className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-card transition-all focus-within:border-accent/50 focus-within:shadow-elevated">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchProducts")}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              {t(cat as any)}
            </button>
          ))}
        </div>

        {/* Style pills */}
        <div className="flex gap-2 overflow-x-auto px-4 pt-2 pb-1 scrollbar-hide">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setActiveStyle(activeStyle === style ? null : style)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition-all ${
                activeStyle === style
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:border-muted-foreground/30"
              }`}
            >
              {t(style as any)}
            </button>
          ))}
        </div>

        {/* Trending for You */}
        {trendingForYou.length > 0 && (
          <>
            <SectionHeader title={t("trending")} subtitle="Popular with your taste profile" />
            <div className="grid grid-cols-2 gap-3 px-4">
              {isLoading
                ? [1,2].map(i => <ProductCardSkeleton key={i} />)
                : trendingForYou.slice(0, 2).map(p => (
                    <ProductCard key={p.id} product={p} scoreBreakdown={p.scoreBreakdown} />
                  ))
              }
            </div>
          </>
        )}

        {/* Body-fit optimized */}
        <SectionHeader title={t("bodyFitOptimized")} subtitle="Matches your proportions" />
        <div className="grid grid-cols-2 gap-3 px-4">
          {isLoading
            ? [1,2].map(i => <ProductCardSkeleton key={i} />)
            : bodyFitPicks.slice(0, 2).map(p => (
                <ProductCard key={p.id} product={p} scoreBreakdown={p.scoreBreakdown} />
              ))
          }
        </div>

        {/* All Products */}
        <SectionHeader title={t("forYou")} subtitle="AI-ranked recommendations" />
        <div className="grid grid-cols-2 gap-3 px-4">
          {isLoading
            ? [1,2,3,4].map(i => <ProductCardSkeleton key={i} />)
            : filtered.map((product) => (
                <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
              ))
          }
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
