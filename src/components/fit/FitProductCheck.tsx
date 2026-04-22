import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link2, Search, Info, Loader2, ShieldCheck } from "lucide-react";
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
  const [searched, setSearched] = useState(false);

  // Load some products from DB on mount
  useEffect(() => {
    loadDbProducts();
  }, []);

  const loadDbProducts = async (query?: string) => {
    setLoading(true);
    try {
      // Search product_cache for products with category info
      let q = supabase
        .from("product_cache")
        .select("id, name, brand, price, image_url, source_url, category, fit, style_tags")
        .eq("is_active", true)
        .eq("image_valid", true)
        .order("trend_score", { ascending: false })
        .limit(12);

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
        setDbProducts(mapped);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      loadDbProducts(searchQuery.trim());
    }
  };

  // ── FIT READINESS GATE ─────────────────────────────────────────────────
  // Only allow products into the FIT entry list if they meet the production
  // contract: usable image + classifiable category. Items that can't pass
  // FIT are dropped here so the user never sees a try-on button that breaks.
  const allProducts = [...dbProducts, ...MOCK_CATALOG].filter((p) => {
    const hasImage = !!p.image && /^(https?:\/\/|data:image\/)/i.test(p.image);
    const hasCategory = !!p.category && p.category !== "other";
    return hasImage && hasCategory;
  });

  return (
    <div className="space-y-6">
      {/* Currently selected product — premium continuity from Discover */}
      {selectedProduct && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55">CURRENTLY FITTING</p>
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

      {/* Search products */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80">SEARCH PRODUCTS</p>
        <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-4 py-3">
          <Search className="h-4 w-4 text-foreground/75 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search by name, brand, or category..."
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/75"
          />
        </div>
        {searchQuery && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleSearch}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </motion.button>
        )}
      </div>

      {/* URL input (coming soon) */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80">PASTE PRODUCT URL</p>
        <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-4 py-3">
          <Link2 className="h-4 w-4 text-foreground/75 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://store.com/product..."
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/75"
          />
        </div>
        <div className="flex items-start gap-2 mt-1">
          <Info className="h-3 w-3 text-foreground/80 mt-0.5 shrink-0" />
          <p className="text-[10px] text-foreground/75 leading-relaxed">
            URL-based product analysis coming soon. Search or select items below.
          </p>
        </div>
      </div>

      {/* Product catalog */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 mb-3">
          {dbProducts.length > 0 ? "AVAILABLE PRODUCTS" : "DEMO PRODUCTS WITH FIT DATA"}
        </p>
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-foreground/50" />
          </div>
        )}
        <div className="space-y-2">
          {allProducts.map(product => (
            <motion.button
              key={`${product.source}-${product.id}`}
              onClick={() => onSelectProduct(product)}
              className="flex w-full items-center gap-3 rounded-2xl border border-foreground/[0.06] bg-card/30 p-4 text-left transition-colors hover:bg-card/60"
              whileTap={{ scale: 0.98 }}
            >
              {product.image ? (
                <SafeImage
                  src={product.image}
                  alt={product.name}
                  className="h-12 w-12 rounded-xl object-cover"
                  fallbackClassName="h-12 w-12 rounded-xl bg-foreground/[0.04] flex items-center justify-center"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-foreground/[0.04] flex items-center justify-center text-foreground/80 text-lg font-display font-bold">
                  {product.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                <p className="text-[10px] text-foreground/80">{product.brand}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                    {product.fitType}
                  </span>
                  <span className="text-[11px] text-foreground/75 flex items-center gap-1">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {product.dataQuality}/100
                  </span>
                  {Number.isFinite(product.price as number) && (product.price as number) > 0 && (
                    <span className="text-[11px] font-medium text-foreground/60">
                      ${product.price}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
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
