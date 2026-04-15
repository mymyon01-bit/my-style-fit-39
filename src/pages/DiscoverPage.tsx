import { useI18n } from "@/lib/i18n";
import { mockProducts } from "@/lib/mockData";
import { rankProducts, defaultUserProfile, defaultBodyProfile, defaultBehavior, getDefaultContext } from "@/lib/recommendation";
import ProductCard from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/Skeleton";
import NavDropdown from "@/components/NavDropdown";
import { Search } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

const DiscoverPage = () => {
  const { t } = useI18n();
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

  // Only show what matters — top AI picks, nothing else
  const topPicks = rankedProducts.slice(0, 6);

  const filtered = searchQuery.trim()
    ? topPicks.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : topPicks;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <NavDropdown />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">DISCOVER</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6">
        {/* Search */}
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

        {/* Curated picks — no categories, no pills, no noise */}
        <p className="mt-6 text-[10px] font-semibold tracking-[0.2em] text-foreground/25">
          PICKED FOR YOU
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 pb-12">
          {isLoading
            ? [1, 2, 3, 4].map(i => <ProductCardSkeleton key={i} />)
            : filtered.map(product => (
                <ProductCard key={product.id} product={product} scoreBreakdown={product.scoreBreakdown} />
              ))
          }
        </div>

        {filtered.length === 0 && !isLoading && (
          <p className="py-16 text-center text-sm font-light text-foreground/30">
            Nothing matched. Try something else.
          </p>
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
