import { useI18n } from "@/lib/i18n";
import { mockProducts } from "@/lib/mockData";
import { rankProducts, defaultUserProfile, defaultBodyProfile, defaultBehavior, getDefaultContext } from "@/lib/recommendation";
import ProductCard from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/Skeleton";
import { Search } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const DiscoverPage = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const context = useMemo(() => getDefaultContext(), []);
  const rankedProducts = useMemo(
    () => rankProducts(mockProducts, defaultUserProfile, defaultBodyProfile, context, defaultBehavior, ["COS", "Lemaire"]),
    [context]
  );

  const filtered = rankedProducts.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
    }
    return true;
  }).slice(0, 8);

  const heading = categoryFilter
    ? categoryFilter.toUpperCase()
    : "PICKED FOR YOU";

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/40">WARDROBE</span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">DISCOVER</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6">
        <div className="flex items-center gap-2.5 rounded-xl bg-card/60 px-4 py-3 backdrop-blur-sm">
          <Search className="h-4 w-4 text-foreground/20" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search for something specific..."
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/20"
          />
        </div>

        <p className="mt-6 text-[10px] font-semibold tracking-[0.2em] text-foreground/25">{heading}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 pb-4">
          {isLoading
            ? [1, 2, 3, 4].map(i => <ProductCardSkeleton key={i} />)
            : filtered.map(product => (
                <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
              ))
          }
        </div>

        {filtered.length === 0 && !isLoading && (
          <p className="py-16 text-center text-sm font-light text-foreground/30">Nothing matched.</p>
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
