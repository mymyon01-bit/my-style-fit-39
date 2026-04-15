import { useI18n } from "@/lib/i18n";
import { mockProducts } from "@/lib/mockData";
import ProductCard from "@/components/ProductCard";
import SectionHeader from "@/components/SectionHeader";
import { Search } from "lucide-react";
import { useState } from "react";

const categories = ["allCategories", "tops", "bottoms", "outerwear", "shoes", "accessories"] as const;
const styles = ["minimal", "streetwear", "classic", "oldMoney", "chic", "cleanFit"] as const;

const DiscoverPage = () => {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState("allCategories");
  const [activeStyle, setActiveStyle] = useState<string | null>(null);

  const filtered = mockProducts.filter((p) => {
    if (activeCategory !== "allCategories" && p.category !== activeCategory) return false;
    return true;
  });

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-3">
          <h1 className="font-display text-xl font-bold text-foreground">{t("discover")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg">
        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
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
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
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
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                activeStyle === style
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t(style as any)}
            </button>
          ))}
        </div>

        <SectionHeader title={t("forYou")} />
        <div className="grid grid-cols-2 gap-3 px-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
