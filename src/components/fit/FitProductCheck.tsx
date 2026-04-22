import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link2, Search, Info, Loader2, ShieldCheck, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mockProductFitData } from "@/lib/fitEngine";
import SafeImage from "@/components/SafeImage";
import SelectedProductCard from "@/components/fit/SelectedProductCard";
import { resolveBestProductImage } from "@/lib/fit/resolveBestProductImage";

interface FitProduct {
  id: string;
  name: string;
  brand: string;
  price: number | null;
  image: string;
  url: string;
  category: string;
  fitType: string;
  dataQuality: number;
  source: "mock" | "db";
}

interface Props {
  onSelectProduct: (product: FitProduct) => void;
  selectedProduct?: FitProduct | null;
  onClearSelected?: () => void;
}

// Built-in demo products. Image is resolved through the canonical resolver so
// every demo gets a renderable synthesized placeholder — the FIT visual
// pipeline never receives an empty string.
const MOCK_CATALOG: FitProduct[] = Object.entries(mockProductFitData).map(([id, data]) => {
  const name = id === "3" ? "Oversized Cotton Shirt" : id === "5" ? "Merino Crew Neck" : id === "2" ? "Straight Leg Trousers" : "Wide Leg Linen Pants";
  const brand = id === "3" ? "Lemaire" : id === "5" ? "AMI Paris" : id === "2" ? "ARKET" : "Our Legacy";
  return {
    id,
    name,
    brand,
    price: id === "3" ? 195 : id === "5" ? 220 : id === "2" ? 89 : 175,
    image: resolveBestProductImage({ id, name, brand, source: "mock" }).src ?? "",
    url: "#",
    category: data.category,
    fitType: data.fitType,
    dataQuality: data.dataQualityScore,
    source: "mock" as const,
  };
});

export default function FitProductCheck({ onSelectProduct, selectedProduct, onClearSelected }: Props) {
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dbProducts, setDbProducts] = useState<FitProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searched, setSearched] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Load products from DB on mount + on refresh
  useEffect(() => {
    loadDbProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshNonce]);

  const loadDbProducts = async (query?: string) => {
    const isRefresh = !query && refreshNonce > 0;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // Pull a wider pool, then sample for variety on refresh
      let q = supabase
        .from("product_cache")
        .select("id, name, brand, price, image_url, source_url, category, fit, style_tags")
        .eq("is_active", true)
        .eq("image_valid", true)
        .order("trend_score", { ascending: false })
        .limit(query ? 24 : 60);

      if (query) {
        q = q.or(`name.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (!error && data) {
        const mapped: FitProduct[] = data
          .filter(p => p.category && ["tops", "bottoms", "outerwear", "shoes"].some(c =>
            (p.category || "").toLowerCase().includes(c)
          ))
          .map(p => {
            const parsed = p.price ? parseFloat(String(p.price).replace(/[^0-9.]/g, "")) : NaN;
            const resolvedImage = resolveBestProductImage({
              id: p.id,
              name: p.name,
              brand: p.brand,
              image_url: p.image_url,
              source: "db",
            }).src ?? "";
            return ({
              id: p.id,
              name: p.name,
              brand: p.brand || "Unknown",
              price: Number.isFinite(parsed) ? parsed : null,
              image: resolvedImage,
              url: p.source_url || "#",
              category: inferCategory(p.category || ""),
              fitType: p.fit || "regular",
              dataQuality: estimateDataQuality(p),
              source: "db" as const,
            });
        });
        const final = query
          ? mapped
          : [...mapped].sort(() => Math.random() - 0.5).slice(0, 12);
        setDbProducts(final);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSearched(true);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      loadDbProducts(searchQuery.trim());
    }
  };

  const handleRefresh = useCallback(() => {
    setSearchQuery("");
    setRefreshNonce(n => n + 1);
  }, []);

  // ── FIT READINESS GATE ─────────────────────────────────────────────────
  const allProducts = [...dbProducts, ...MOCK_CATALOG].filter((p) => {
    const hasImage = !!p.image && /^(https?:\/\/|data:image\/)/i.test(p.image);
    const hasCategory = !!p.category && p.category !== "other";
    return hasImage && hasCategory;
  });

  return (
    <div className="space-y-6">
      {selectedProduct && (
        <div className="space-y-2">
          <p className="label-mono text-foreground/55">CURRENTLY FITTING</p>
          <SelectedProductCard
            brand={selectedProduct.brand}
            name={selectedProduct.name}
            price={selectedProduct.price}
            image={selectedProduct.image}
            url={selectedProduct.url}
            category={selectedProduct.category}
            dataQuality={selectedProduct.dataQuality}
            onChange={onClearSelected}
            changeLabel="Change product"
          />
        </div>
      )}

      {/* Search */}
      <div className="space-y-2">
        <p className="label-mono text-foreground/70 flex items-center gap-2">
          <Search className="h-3 w-3" /> SEARCH PRODUCTS
        </p>
        <div className="luxe-command flex items-center gap-3 px-4 py-3">
          <Search className="h-4 w-4 text-foreground/50 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search by name, brand, category…"
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground/40 placeholder:font-light"
          />
          {searchQuery && (
            <button
              onClick={handleSearch}
              disabled={loading}
              className="shrink-0 border-[1.5px] border-foreground bg-foreground px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-background transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              style={{ borderRadius: "var(--radius)" }}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "GO"}
            </button>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="space-y-2">
        <p className="label-mono text-foreground/70 flex items-center gap-2">
          <Link2 className="h-3 w-3" /> PASTE PRODUCT URL
        </p>
        <div className="luxe-command flex items-center gap-3 px-4 py-3">
          <Link2 className="h-4 w-4 text-foreground/50 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://store.com/product…"
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground/40 placeholder:font-light"
          />
        </div>
        <div className="flex items-start gap-2 pl-1">
          <Info className="h-3 w-3 text-foreground/50 mt-0.5 shrink-0" />
          <p className="text-[11px] text-foreground/55 leading-relaxed">
            URL-based product analysis coming soon. Search or pick from below.
          </p>
        </div>
      </div>

      {/* Catalog with refresh */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-mono text-foreground/70 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            {searchQuery ? "SEARCH RESULTS" : "RECOMMENDED FOR FIT"}
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="group flex items-center gap-1.5 border-[1.5px] border-foreground/20 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-foreground/70 transition-all duration-200 hover:border-foreground hover:bg-foreground hover:text-background disabled:opacity-50"
            style={{ borderRadius: "var(--radius)" }}
            aria-label="Refresh recommendations"
          >
            <RefreshCw
              className={`h-3 w-3 transition-transform duration-500 ${
                refreshing ? "animate-spin" : "group-hover:rotate-180"
              }`}
            />
            REFRESH
          </button>
        </div>

        {loading && !refreshing && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!loading && allProducts.length === 0 && (
          <div className="border-[1.5px] border-dashed border-foreground/20 p-8 text-center" style={{ borderRadius: "var(--radius)" }}>
            <p className="text-sm font-medium text-foreground/70">No products found</p>
            <p className="mt-1 text-[11px] text-foreground/50">Try a different search or hit refresh.</p>
          </div>
        )}

        <motion.div
          key={refreshNonce + (searchQuery || "")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {allProducts.map((product, i) => {
            const isSelected = selectedProduct?.id === product.id;
            return (
              <motion.button
                key={`${product.source}-${product.id}`}
                onClick={() => onSelectProduct(product)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                whileTap={{ scale: 0.97 }}
                className={`group relative flex flex-col overflow-hidden border-[1.5px] bg-card text-left transition-all duration-200 ${
                  isSelected
                    ? "border-primary shadow-[4px_4px_0_hsl(var(--primary))]"
                    : "border-foreground/15 hover:border-foreground hover:shadow-[4px_4px_0_hsl(var(--foreground))] hover:-translate-x-[2px] hover:-translate-y-[2px]"
                }`}
                style={{ borderRadius: "var(--radius)" }}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-muted">
                  {product.image ? (
                    <SafeImage
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      fallbackClassName="h-full w-full bg-muted flex items-center justify-center text-foreground/40 text-2xl font-display"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted text-foreground/40 text-2xl font-display">
                      {product.name.charAt(0)}
                    </div>
                  )}
                  <span
                    className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border border-foreground/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-foreground"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    {product.fitType}
                  </span>
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center">
                      <span
                        className="bg-primary text-primary-foreground px-2.5 py-1 font-mono text-[9px] font-bold tracking-[0.18em]"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        SELECTED
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/55 truncate">
                    {product.brand}
                  </p>
                  <p className="text-[12px] font-medium leading-tight text-foreground line-clamp-2 min-h-[2.4em]">
                    {product.name}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                    {Number.isFinite(product.price as number) && (product.price as number) > 0 ? (
                      <span className="text-[11px] font-semibold text-foreground">${product.price}</span>
                    ) : (
                      <span className="text-[10px] text-foreground/40">—</span>
                    )}
                    <span className="flex items-center gap-0.5 font-mono text-[9px] text-foreground/55">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      {product.dataQuality}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

function inferCategory(raw: string): string {
  const l = raw.toLowerCase();
  if (["shirt", "top", "tee", "blouse", "sweater", "hoodie", "jacket", "coat", "blazer"].some(k => l.includes(k))) return "tops";
  if (["pant", "trouser", "jean", "short", "skirt"].some(k => l.includes(k))) return "bottoms";
  if (["shoe", "sneaker", "boot", "sandal", "loafer"].some(k => l.includes(k))) return "shoes";
  if (["jacket", "coat", "parka", "bomber"].some(k => l.includes(k))) return "outerwear";
  return "tops";
}

function estimateDataQuality(product: any): number {
  let score = 40; // base
  if (product.brand) score += 10;
  if (product.price) score += 10;
  if (product.fit) score += 15;
  if (product.style_tags?.length > 0) score += 10;
  if (product.image_url) score += 10;
  if (product.source_url) score += 5;
  return Math.min(100, score);
}
