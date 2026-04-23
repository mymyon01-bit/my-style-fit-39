import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Link2, Search, Info, Loader2, ShieldCheck, RefreshCw, Sparkles, Sliders, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { mockProductFitData } from "@/lib/fitEngine";
import SafeImage from "@/components/SafeImage";
import SelectedProductCard from "@/components/fit/SelectedProductCard";
import { resolveBestProductImage } from "@/lib/fit/resolveBestProductImage";
import {
  passesGenderFilter,
  genderPreferenceToFilter,
  type GenderFilter,
} from "@/lib/discover/genderFilter";
import { wasRecentlyShown, markProductsAsSeen } from "@/lib/search/search-session";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const PAGE_SIZE = 6;
const POOL_SIZE = 120;

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
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Pool of all eligible products (loaded once + on search). We page through
  // it 6 at a time on REFRESH so users never see the same item twice in a
  // session, and keep a shared "seen" register with Discover (search-session)
  // so cross-tab repetition is also avoided.
  const [pool, setPool] = useState<FitProduct[]>([]);
  const [visible, setVisible] = useState<FitProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [gender, setGender] = useState<GenderFilter>("all");
  const [genderInitialized, setGenderInitialized] = useState(false);
  const seenLocalIds = useRef<Set<string>>(new Set());

  // Default gender filter from the user's profile (mirrors Discover behavior).
  useEffect(() => {
    if (!user) { setGenderInitialized(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("gender_preference")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setGender(genderPreferenceToFilter(data?.gender_preference));
      setGenderInitialized(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Load the eligible product pool from the SAME table Discover uses
  // (`product_cache`), so FIT and Discover share inventory.
  const loadPool = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      let q = supabase
        .from("product_cache")
        .select("id, name, brand, price, image_url, source_url, category, fit, style_tags")
        .eq("is_active", true)
        .eq("image_valid", true)
        .order("trend_score", { ascending: false })
        .limit(query ? 60 : POOL_SIZE);

      if (query) {
        q = q.or(`name.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (!error && data) {
        const mapped: FitProduct[] = data
          .filter((p) => p.category && ["tops", "bottoms", "outerwear", "shoes"].some((c) =>
            (p.category || "").toLowerCase().includes(c)
          ))
          .map((p) => {
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
        // FIT should share the same real inventory pool as Discover.
        // Only fall back to demo items when the DB returns nothing usable.
        const full = (mapped.length > 0 ? mapped : MOCK_CATALOG)
          .filter((p) => {
            const hasImage = !!p.image && /^(https?:\/\/|data:image\/|blob:|\/)/i.test(p.image);
            const hasCategory = !!p.category && p.category !== "other";
            return hasImage && hasCategory;
          });
        setPool(full);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { loadPool(); }, [loadPool]);

  // Compute the next 6-item page from the pool whenever the pool, gender,
  // or refresh counter changes. Skips items already shown in this FIT session
  // and items recently shown in Discover (shared session memory).
  useEffect(() => {
    if (pool.length === 0) { setVisible([]); return; }
    const eligible = pool.filter((p) => passesGenderFilter(p as any, gender));
    const productKey = (p: FitProduct) =>
      (p.url && p.url !== "#" ? p.url : p.id || p.image).toLowerCase();

    let candidates = eligible.filter(
      (p) => !seenLocalIds.current.has(p.id) && !wasRecentlyShown(productKey(p))
    );

    // Pool exhausted — reset local memory so user can keep refreshing.
    if (candidates.length === 0) {
      seenLocalIds.current.clear();
      candidates = eligible;
    }

    // Light shuffle for variety, then take 6
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const next = shuffled.slice(0, PAGE_SIZE);

    next.forEach((p) => seenLocalIds.current.add(p.id));
    // Share with Discover's session memory so cross-tab repeats are avoided
    markProductsAsSeen(next.map((p) => ({
      id: p.id,
      externalUrl: p.url && p.url !== "#" ? p.url : null,
      imageUrl: p.image,
    })) as any);

    setVisible(next);
    setRefreshing(false);
  }, [pool, gender, refreshNonce]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      seenLocalIds.current.clear();
      loadPool(searchQuery.trim());
    }
  };

  const handleRefresh = useCallback(() => {
    setSearchQuery("");
    setRefreshing(true);
    setRefreshNonce((n) => n + 1);
  }, []);

  const allProducts = visible;

  const [preciseOpen, setPreciseOpen] = useState(false);

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
          <button
            onClick={() => setPreciseOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] py-3 text-[11px] font-bold tracking-[0.22em] text-accent transition-all hover:bg-accent/[0.14]"
          >
            <Sliders className="h-3.5 w-3.5" />
            ADD PRECISE INFO
            <span className="text-foreground/40 font-normal tracking-normal text-[10px] ml-1">
              (more accurate result)
            </span>
          </button>
        </div>
      )}

      <PreciseInfoDialog
        open={preciseOpen}
        onOpenChange={setPreciseOpen}
        product={selectedProduct ?? null}
        onSave={(updated) => {
          setPreciseOpen(false);
          onSelectProduct(updated);
          toast.success("Precise sizing applied — fit recalculated");
        }}
      />

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label-mono text-foreground/70 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            {searchQuery ? "SEARCH RESULTS" : "RECOMMENDED FOR FIT"}
          </p>
          <div className="flex items-center gap-2">
            {/* Gender toggle — defaults from profile, mirrors Discover behavior */}
            <div
              className="flex items-center overflow-hidden border-[1.5px] border-foreground/20"
              style={{ borderRadius: "var(--radius)" }}
              role="group"
              aria-label="Filter products by gender"
            >
              {([
                { v: "all" as const, label: "ALL" },
                { v: "women" as const, label: "W" },
                { v: "men" as const, label: "M" },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setGender(opt.v)}
                  className={`px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.18em] transition-colors ${
                    gender === opt.v
                      ? "bg-foreground text-background"
                      : "text-foreground/60 hover:text-foreground"
                  }`}
                  aria-pressed={gender === opt.v}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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

// ─── Precise Info Dialog ──────────────────────────────────────────────────
// Lets the user input the brand's actual size chart so the fit engine can
// use exact numbers instead of inferred category defaults. Persists to
// sessionStorage keyed by product so the calibration sticks for the session.

const PRECISE_FIELDS_TOPS = [
  { key: "chest", label: "Chest (cm)" },
  { key: "shoulder", label: "Shoulder (cm)" },
  { key: "length", label: "Length (cm)" },
  { key: "sleeve", label: "Sleeve (cm)" },
];
const PRECISE_FIELDS_BOTTOMS = [
  { key: "waist", label: "Waist (cm)" },
  { key: "hip", label: "Hip (cm)" },
  { key: "inseam", label: "Inseam (cm)" },
  { key: "thigh", label: "Thigh (cm)" },
];
const PRECISE_SIZES = ["S", "M", "L", "XL"];

function PreciseInfoDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: FitProduct | null;
  onSave: (updated: FitProduct) => void;
}) {
  const isBottom = product?.category === "bottoms";
  const fields = isBottom ? PRECISE_FIELDS_BOTTOMS : PRECISE_FIELDS_TOPS;
  const storageKey = product ? `fit:precise:${product.id}` : "";

  const [values, setValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!open || !storageKey) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      setValues(raw ? JSON.parse(raw) : {});
    } catch { setValues({}); }
  }, [open, storageKey]);

  if (!product) return null;

  const setVal = (size: string, key: string, v: string) => {
    setValues((prev) => ({ ...prev, [size]: { ...(prev[size] || {}), [key]: v } }));
  };

  const handleSave = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(values)); } catch { /* ignore */ }
    onSave({ ...product, dataQuality: Math.max(product.dataQuality, 95) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-background border border-border/40">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px] tracking-tight">
            Precise product info
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed text-foreground/60">
            Enter the brand's exact size chart from the product page. Leave blank for sizes you don't need.
            More numbers = more accurate fit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-foreground/[0.06] bg-card/30 p-3">
            <p className="text-[10px] tracking-[0.2em] font-bold text-foreground/55 mb-1">
              {product.brand.toUpperCase()}
            </p>
            <p className="text-[13px] text-foreground/85 leading-tight">{product.name}</p>
          </div>

          {PRECISE_SIZES.map((size) => (
            <div key={size} className="space-y-2 border-t border-foreground/[0.06] pt-4">
              <p className="text-[11px] font-bold tracking-[0.18em] text-foreground/70">SIZE {size}</p>
              <div className="grid grid-cols-2 gap-2">
                {fields.map((f) => (
                  <label key={f.key} className="space-y-1 block">
                    <span className="text-[10px] tracking-wide text-foreground/55">{f.label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={values[size]?.[f.key] ?? ""}
                      onChange={(e) => setVal(size, f.key, e.target.value)}
                      placeholder="—"
                      className="w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[13px] text-foreground tabular-nums focus:outline-none focus:border-accent/50"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-3 border-t border-foreground/[0.06]">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl border border-foreground/15 py-3 text-[11px] font-bold tracking-[0.2em] text-foreground/70 hover:bg-foreground/[0.04]"
            >
              <X className="inline h-3 w-3 mr-1.5" /> CANCEL
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-xl bg-foreground py-3 text-[11px] font-bold tracking-[0.2em] text-background hover:opacity-90"
            >
              <Check className="inline h-3 w-3 mr-1.5" /> SAVE & RECALCULATE
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
