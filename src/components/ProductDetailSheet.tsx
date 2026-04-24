import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Heart, ExternalLink, X, Tag, Sparkles, LayoutGrid, Send } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SafeImage from "@/components/SafeImage";
import { AuthGate } from "@/components/AuthGate";
import SendToShowroomSheet from "@/components/showroom/SendToShowroomSheet";
import ShareProductToFriendDialog from "@/components/ShareProductToFriendDialog";
import { useAuth } from "@/lib/auth";

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
          if (!v && (shareInOOTDOpen || postOpen)) return;
          if (!v) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          onInteractOutside={(event) => {
            if (shareInOOTDOpen || postOpen) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (shareInOOTDOpen || postOpen) {
              event.preventDefault();
            }
          }}
          className="h-[92vh] rounded-t-3xl border-t border-border/20 bg-background p-0 overflow-hidden"
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

            <div className="mx-auto w-full max-w-md px-5 pb-12 pt-6 sm:max-w-lg">
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

                  {/* OOTD actions — POST AS OOTD + SHARE IN OOTD */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <AuthGate action="send to your Showroom">
                      <button
                        onClick={() => setPostOpen(true)}
                        disabled={!product.image_url}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/30 bg-background/40 py-3.5 text-[11px] font-bold tracking-[0.14em] text-foreground/80 transition-all hover:bg-foreground/[0.04] disabled:opacity-40"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        SEND TO MY SHOWROOM
                      </button>
                    </AuthGate>

                    <AuthGate action="share to friends">
                      <button
                        onClick={() => setShareInOOTDOpen(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 py-3.5 text-[11px] font-bold tracking-[0.14em] text-accent transition-all hover:bg-accent/15"
                      >
                        <Send className="h-4 w-4" />
                        SHARE IN OOTD
                      </button>
                    </AuthGate>
                  </div>

                  <div className="flex items-center gap-3">
                    {product.source_url && (
                      <a
                        href={product.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[12px] font-bold tracking-[0.15em] text-accent-foreground transition-all hover:opacity-90"
                      >
                        <ExternalLink className="h-4 w-4" />
                        SHOP NOW
                      </a>
                    )}

                    {/* Save */}
                    <AuthGate action="save items">
                      <button
                        onClick={() => onSave(product.id)}
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-all ${
                          isSaved
                            ? "border-accent/30 bg-accent/10 text-accent"
                            : "border-border/30 text-foreground/60 hover:border-accent/20 hover:text-foreground/80"
                        }`}
                        aria-label="Save"
                      >
                        <Heart className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </AuthGate>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <PostProductToOOTDSheet
        open={postOpen}
        product={{
          id: product.id,
          productId: product.id,
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


    </>
  );
};

export default ProductDetailSheet;
