import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Heart, ExternalLink, X, Tag, Sparkles, LayoutGrid, Send, ChevronDown, MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SafeImage from "@/components/SafeImage";
import { AuthGate } from "@/components/AuthGate";
import SendToShowroomSheet from "@/components/showroom/SendToShowroomSheet";
import ShareProductToFriendDialog from "@/components/ShareProductToFriendDialog";
import PostProductToOOTDSheet from "@/components/profile/PostProductToOOTDSheet";
import { useAuth } from "@/lib/auth";
import { useFitPrewarm } from "@/hooks/useFitPrewarm";
import type { PrewarmInput } from "@/lib/fit/fitPrewarm";
import ProductIntelligencePanel from "@/components/ProductIntelligencePanel";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface ProductDetailItem {
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

interface ProductDetailSheetProps {
  product: ProductDetailItem | null;
  open: boolean;
  onClose: () => void;
  isSaved: boolean;
  onSave: (id: string) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  naver: "bg-green-600/80",
  ssense: "bg-zinc-800/80",
  farfetch: "bg-stone-700/80",
  asos: "bg-blue-600/80",
  ssg: "bg-rose-600/80",
  ai_search: "bg-purple-600/80",
};

const ProductDetailSheet = ({ product, open, onClose, isSaved, onSave }: ProductDetailSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [postOpen, setPostOpen] = useState(false);
  const [shareInOOTDOpen, setShareInOOTDOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [bodyHeightCm, setBodyHeightCm] = useState<number | null>(null);
  const [bodyGender, setBodyGender] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setBodyHeightCm(null); setBodyGender(null); return; }
    let cancelled = false;
    (async () => {
      const [{ data: bp }, pr] = await Promise.all([
        supabase.from("body_profiles").select("height_cm").eq("user_id", user.id).maybeSingle(),
        (await import("@/lib/profile")).getMyProfile(),
      ]);
      if (cancelled) return;
      if (bp?.height_cm) setBodyHeightCm(Number(bp.height_cm));
      if (pr?.gender_preference) setBodyGender(pr.gender_preference);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // V4.0 — predictive preparation. Prewarm garment DNA + image preload under
  // an anonymous body signature; the body-aware prewarm reruns inside FitResults.
  const prewarmInput: PrewarmInput | null = useMemo(() => {
    if (!product) return null;
    const productKey = `${product.source_url || product.name}::${product.brand || ""}`.toLowerCase().slice(0, 240);
    return {
      bodySignature: "_anon_",
      productKey,
      productName: product.name,
      productCategory: product.category ?? null,
      brand: product.brand ?? null,
      productImageUrl: product.image_url ?? null,
      selectedSize: null,
      garmentInput: {
        name: product.name,
        category: product.category,
        brand: product.brand,
      } as PrewarmInput["garmentInput"],
      genderDetection: {
        name: product.name,
        brand: product.brand,
        category: product.category,
      },
    };
  }, [product]);

  useFitPrewarm({ enabled: open && !!product, prewarmInput });

  if (!product) return null;

  const handleTryOn = () => {
    const parsed = product.price ? parseFloat(String(product.price).replace(/[^0-9.]/g, "")) : NaN;
    const payload = {
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: Number.isFinite(parsed) ? parsed : null,
      image: product.image_url || "",
      url: product.source_url || "#",
      category: (product.category || "tops").toLowerCase().includes("bottom") ? "bottoms" : "tops",
      fitType: product.fit || "regular",
      dataQuality: 60,
      source: "db" as const,
    };
    try {
      sessionStorage.setItem(`fit:product:${product.id}`, JSON.stringify(payload));
    } catch { /* ignore */ }
    onClose();
    navigate(`/fit/${encodeURIComponent(product.id)}`);
  };

  const tags = [
    ...(product.style_tags || []),
    product.fit && product.fit !== "regular" ? product.fit : null,
    product.color || null,
    product.category || null,
  ].filter(Boolean) as string[];

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          if (!v && (shareInOOTDOpen || postOpen || reviewOpen)) return;
          if (!v) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          onInteractOutside={(event) => {
            if (shareInOOTDOpen || postOpen || reviewOpen) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (shareInOOTDOpen || postOpen || reviewOpen) {
              event.preventDefault();
            }
          }}
          className="h-[92vh] rounded-t-3xl border-t border-border/20 bg-background p-0 overflow-hidden z-[140]"
          overlayClassName="z-[135]"
        >
          <div className="relative flex h-full flex-col overflow-y-auto">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-md shadow-soft hover:bg-background"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-foreground/70" />
            </button>

            <div className="mx-auto w-full max-w-md px-5 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:max-w-lg">
              {/* Product Image */}
              <div className="relative w-full overflow-hidden rounded-2xl bg-muted/30 flex items-center justify-center">
                <SafeImage
                  src={product.image_url || ""}
                  alt={product.name}
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                  fallbackClassName="aspect-[3/4] w-full"
                />
                {product.platform && PLATFORM_COLORS[product.platform] && (
                  <div className={`absolute top-3 left-3 rounded-full ${PLATFORM_COLORS[product.platform]} px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm tracking-wide`}>
                    {product.platform.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="mt-5 space-y-5">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {product.brand}
                  </p>
                  <h2 className="font-display text-lg font-semibold leading-tight text-foreground">
                    {product.name}
                  </h2>
                  {product.price && (
                    <p className="text-base font-bold text-foreground">{product.price}</p>
                  )}
                </div>

                {product.store_name && (
                  <p className="text-[11px] text-muted-foreground">
                    Available at <span className="font-medium text-foreground/80">{product.store_name}</span>
                  </p>
                )}

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 rounded-full bg-foreground/[0.05] px-3 py-1.5 text-[10px] font-medium text-foreground/70"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {product.reason && (
                  <p className="text-[12px] leading-relaxed text-foreground/60 italic">
                    "{product.reason}"
                  </p>
                )}

                {/* Smart Analysis — collapsible so the product view stays clean */}
                <div className="rounded-xl border border-border/30 bg-foreground/[0.02] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAnalysisOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04]"
                    aria-expanded={analysisOpen}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      <span className="text-[11px] font-bold tracking-[0.18em] text-foreground/80">
                        SMART ANALYSIS
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-foreground/50 transition-transform ${analysisOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {analysisOpen && (
                    <div className="border-t border-border/20 px-4 py-4">
                      <ProductIntelligencePanel
                        productName={product.name}
                        category={product.category}
                        fit={product.fit}
                        brand={product.brand}
                        bodyHeightCm={bodyHeightCm}
                        bodyGender={bodyGender}
                        styleTags={product.style_tags || []}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-1">
                  {/* Try this on */}
                  <button
                    onClick={handleTryOn}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 py-3.5 text-[12px] font-bold tracking-[0.15em] text-accent transition-all hover:bg-accent/20"
                  >
                    <Sparkles className="h-4 w-4" />
                    TRY THIS ON
                  </button>

                  {product.source_url && (
                    <a
                      href={product.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[12px] font-bold tracking-[0.15em] text-accent-foreground transition-all hover:opacity-90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      SHOP NOW
                    </a>
                  )}

                  {/* Share · Save · Review — single aligned row */}
                  <div className="grid grid-cols-3 gap-2">
                    <AuthGate action="share to friends">
                      <button
                        onClick={() => setShareInOOTDOpen(true)}
                        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border/30 bg-background/40 text-[10px] font-bold tracking-[0.16em] text-foreground/80 transition-all hover:bg-foreground/[0.04]"
                      >
                        <Send className="h-3.5 w-3.5" />
                        SHARE
                      </button>
                    </AuthGate>

                    <AuthGate action="save items">
                      <button
                        onClick={() => onSave(product.id)}
                        className={`flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold tracking-[0.16em] transition-all ${
                          isSaved
                            ? "border-accent/30 bg-accent/10 text-accent"
                            : "border-border/30 text-foreground/80 hover:border-accent/30 hover:text-foreground"
                        }`}
                      >
                        <Heart className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
                        {isSaved ? "SAVED" : "SAVE"}
                      </button>
                    </AuthGate>

                    <AuthGate action="post a review">
                      <button
                        onClick={() => setReviewOpen(true)}
                        disabled={!product.image_url}
                        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent/10 text-[10px] font-bold tracking-[0.16em] text-accent transition-all hover:bg-accent/15 disabled:opacity-40"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        REVIEW
                      </button>
                    </AuthGate>
                  </div>

                  {/* Send to Showroom — secondary, moved below primary trio */}
                  <AuthGate action="send to your Showroom">
                    <button
                      onClick={() => setPostOpen(true)}
                      disabled={!product.image_url}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/30 bg-background/40 py-3 text-[10px] font-bold tracking-[0.16em] text-foreground/70 transition-all hover:bg-foreground/[0.04] disabled:opacity-40"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      TO SHOWROOM
                    </button>
                  </AuthGate>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <SendToShowroomSheet
        open={postOpen}
        product={{
          id: product.id,
          name: product.name,
          brand: product.brand,
          imageUrl: product.image_url ?? null,
        }}
        onClose={() => setPostOpen(false)}
      />

      <ShareProductToFriendDialog
        open={shareInOOTDOpen}
        product={{
          id: product.id,
          name: product.name,
          brand: product.brand,
          image_url: product.image_url ?? null,
          source_url: product.source_url ?? null,
        }}
        onClose={() => setShareInOOTDOpen(false)}
      />

      <PostProductToOOTDSheet
        open={reviewOpen}
        product={{
          id: product.id,
          productId: product.id,
          name: product.name,
          brand: product.brand,
          imageUrl: product.image_url ?? null,
        }}
        onClose={() => setReviewOpen(false)}
      />
    </>
  );
};

export default ProductDetailSheet;
