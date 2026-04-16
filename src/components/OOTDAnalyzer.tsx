import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, X, Sparkles, ChevronRight, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SafeImage from "@/components/SafeImage";
import OutfitLookCard from "@/components/OutfitLookCard";
import { generateOutfits } from "@/lib/outfitGenerator";

interface AnalyzedItem {
  category: string;
  description: string;
  color: string;
  fit: string;
}

interface OutfitAnalysis {
  overall_style: string;
  color_palette: string[];
  fit_type: string;
  items: AnalyzedItem[];
  search_queries: string[];
  style_summary: string;
  confidence: number;
}

interface MatchedProduct {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  reason: string;
  style_tags: string[];
  color: string;
  fit: string;
  image_url?: string | null;
  source_url?: string | null;
  store_name?: string | null;
  platform?: string | null;
}

type FashionCategory = "TOPS" | "BOTTOMS" | "SHOES" | "BAGS" | "ACCESSORIES";

const CATEGORY_KEYWORDS: Record<FashionCategory, RegExp> = {
  TOPS: /\b(shirt|t-shirt|tee|hoodie|hoody|jacket|coat|blazer|sweater|cardigan|vest|polo|pullover|sweatshirt|bomber|parka|windbreaker|blouse|top|jumper|knit|henley|flannel|oxford|trench|overcoat|anorak)\b/i,
  BOTTOMS: /\b(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes|cargo|sweatpants|bermuda)\b/i,
  SHOES: /\b(sneakers?|shoes?|boots?|loafers?|sandals?|trainers?|mules?|oxfords?|derby|brogues?|espadrilles?|slippers?|pumps?|heels?|flats?)\b/i,
  BAGS: /\b(bag|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|wallet|briefcase|handbag)\b/i,
  ACCESSORIES: /\b(hat|cap|beanie|watch|belt|scarf|gloves?|sunglasses|ring|necklace|bracelet|earring|jewelry)\b/i,
};

function classifyProduct(item: MatchedProduct): FashionCategory | null {
  const text = `${item.name} ${item.category}`.toLowerCase();
  for (const [cat, re] of Object.entries(CATEGORY_KEYWORDS)) {
    if (re.test(text)) return cat as FashionCategory;
  }
  return null;
}

const STYLE_COLORS: Record<string, string> = {
  minimal: "bg-zinc-800/60",
  street: "bg-orange-900/40",
  modern: "bg-blue-900/40",
  formal: "bg-stone-800/50",
  casual: "bg-amber-900/30",
  chic: "bg-rose-900/30",
  sporty: "bg-green-900/30",
  bohemian: "bg-yellow-900/30",
  vintage: "bg-purple-900/30",
};

export default function OOTDAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<OutfitAnalysis | null>(null);
  const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Convert to base64 for vision API
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setAnalysis(null);
      setMatchedProducts([]);
      setError(null);
    };
    reader.readAsDataURL(f);
  };

  const analyzeOutfit = async () => {
    if (!preview) return;
    setAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("wardrobe-ai", {
        body: { action: "outfit-analyze", imageUrl: preview },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const result: OutfitAnalysis = data.analysis;
      setAnalysis(result);

      // Now search for matching products using the generated queries
      if (result.search_queries?.length > 0) {
        setLoadingProducts(true);
        const allProducts: MatchedProduct[] = [];

        // Search with multiple queries in parallel
        const searchPromises = result.search_queries.slice(0, 4).map(async (query) => {
          try {
            const { data: searchData } = await supabase.functions.invoke("wardrobe-ai", {
              body: { action: "recommend", prompt: query, count: 6 },
            });
            return searchData?.recommendations || [];
          } catch {
            return [];
          }
        });

        const results = await Promise.all(searchPromises);
        const seen = new Set<string>();
        for (const batch of results) {
          for (const product of batch) {
            if (!seen.has(product.id)) {
              seen.add(product.id);
              allProducts.push(product);
            }
          }
        }

        setMatchedProducts(allProducts);
        setLoadingProducts(false);
      }
    } catch (e: any) {
      setError(e.message || "Analysis failed. Try a clearer photo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setAnalysis(null);
    setMatchedProducts([]);
    setError(null);
  };

  // Generate outfit combinations from matched products
  const outfitSets = (() => {
    if (matchedProducts.length < 3) return [];
    const groups: Record<FashionCategory, MatchedProduct[]> = {
      TOPS: [], BOTTOMS: [], SHOES: [], BAGS: [], ACCESSORIES: [],
    };
    for (const p of matchedProducts) {
      const cat = classifyProduct(p);
      if (cat) groups[cat].push(p);
    }
    return generateOutfits(groups, 3);
  })();

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {!preview ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-foreground/10 bg-foreground/[0.02] py-16 transition-colors hover:border-accent/30 hover:bg-accent/[0.02]"
        >
          <Upload className="h-7 w-7 text-foreground/20" />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/50">
            UPLOAD OUTFIT PHOTO
          </span>
          <span className="text-[10px] text-foreground/30">
            Mirror selfies, full outfit shots, street photos
          </span>
        </button>
      ) : (
        <div className="relative">
          <img
            src={preview}
            alt="Outfit"
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: "50vh" }}
          />
          <button
            onClick={reset}
            className="absolute top-3 right-3 rounded-full bg-black/50 p-1.5 text-white/70 hover:text-white backdrop-blur-sm"
          >
            <X className="h-4 w-4" />
          </button>

          {!analysis && !analyzing && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={analyzeOutfit}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent/90 px-5 py-2.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm hover:bg-accent transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              ANALYZE OUTFIT
            </motion.button>
          )}

          {analyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/40 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-white/80 mb-3" />
              <p className="text-[11px] font-medium text-white/70 tracking-wider">ANALYZING STYLE...</p>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-[12px] text-destructive">
          {error}
        </div>
      )}

      {/* Analysis Results */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Style Breakdown */}
            <div className="space-y-4">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/60 uppercase">
                Your Style Breakdown
              </p>

              <div className="rounded-2xl border border-border/20 bg-card/60 p-5 space-y-4">
                {/* Style badge */}
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold text-white/90 ${STYLE_COLORS[analysis.overall_style] || "bg-zinc-800/50"}`}>
                    {analysis.overall_style.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-foreground/50">
                    {Math.round(analysis.confidence * 100)}% confidence
                  </span>
                </div>

                {/* Summary */}
                <p className="text-[12px] leading-relaxed text-foreground/70">
                  {analysis.style_summary}
                </p>

                {/* Color palette */}
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-foreground/40 uppercase mb-2">Color Palette</p>
                  <div className="flex gap-2">
                    {analysis.color_palette.map((color) => (
                      <span
                        key={color}
                        className="rounded-full border border-border/20 px-2.5 py-1 text-[10px] text-foreground/60"
                      >
                        {color}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Fit */}
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-foreground/40 uppercase mb-1">Fit Type</p>
                  <p className="text-[11px] text-foreground/65">{analysis.fit_type}</p>
                </div>

                {/* Detected items */}
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-foreground/40 uppercase mb-2">Detected Items</p>
                  <div className="space-y-1.5">
                    {analysis.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[9px] font-medium tracking-[0.1em] text-accent/50 w-20 uppercase">{item.category}</span>
                        <span className="text-[11px] text-foreground/65">{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Matching Products */}
            <div className="space-y-4">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/60 uppercase">
                Match This Look
              </p>

              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/40 mr-2" />
                  <span className="text-[11px] text-foreground/40">Finding matching products...</span>
                </div>
              ) : matchedProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {matchedProducts.slice(0, 12).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => product.source_url && window.open(product.source_url, "_blank", "noopener")}
                      className="group text-left"
                    >
                      <div className="relative overflow-hidden rounded-xl">
                        <SafeImage
                          src={product.image_url || ""}
                          alt={product.name}
                          className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 pt-6">
                          <p className="text-[9px] font-semibold tracking-[0.1em] text-white/60 uppercase">{product.brand}</p>
                          <p className="text-[10px] font-medium text-white/90 line-clamp-1">{product.name}</p>
                        </div>
                      </div>
                      <div className="mt-1.5 px-0.5">
                        <p className="text-[10px] text-foreground/50">{product.price}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-[11px] text-foreground/40 py-8">
                  No matching products found yet. Try uploading a clearer photo.
                </p>
              )}
            </div>

            {/* Similar Outfit Sets */}
            {outfitSets.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/60 uppercase">
                  Similar Outfit Sets
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {outfitSets.map((outfit, i) => (
                    <OutfitLookCard key={outfit.id} outfit={outfit} index={i} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
