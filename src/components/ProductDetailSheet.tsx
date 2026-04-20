import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Heart, Share2, ExternalLink, X, Tag, Sparkles, Camera } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SafeImage from "@/components/SafeImage";
import { AuthGate } from "@/components/AuthGate";
import ShareProductDialog from "@/components/ShareProductDialog";
import PostProductToOOTDSheet from "@/components/profile/PostProductToOOTDSheet";

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
  const [shareOpen, setShareOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
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
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl border-t border-border/20 bg-background p-0 overflow-hidden">
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md"
          >
            <X className="h-4 w-4 text-foreground/70" />
          </button>

          {/* Product Image */}
          <div className="relative w-full bg-muted/30 flex items-center justify-center" style={{ maxHeight: "70vh" }}>
            <SafeImage
              src={product.image_url || ""}
              alt={product.name}
              className="max-h-[70vh] w-auto max-w-full object-contain"
              fallbackClassName="aspect-[3/4] w-full"
            />
            {product.platform && PLATFORM_COLORS[product.platform] && (
              <div className={`absolute top-4 left-4 rounded-full ${PLATFORM_COLORS[product.platform]} px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm tracking-wide`}>
                {product.platform.toUpperCase()}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 space-y-5 px-6 py-6">
            {/* Brand & Name */}
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

            {/* Store */}
            {product.store_name && (
              <p className="text-[11px] text-muted-foreground">
                Available at <span className="font-medium text-foreground/80">{product.store_name}</span>
              </p>
            )}

            {/* Tags */}
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

            {/* Reason */}
            {product.reason && (
              <p className="text-[12px] leading-relaxed text-foreground/60 italic">
                "{product.reason}"
              </p>
            )}

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              {/* Try this on — primary AI CTA */}
              <button
                onClick={handleTryOn}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 py-3.5 text-[12px] font-bold tracking-[0.15em] text-accent transition-all hover:bg-accent/20"
              >
                <Sparkles className="h-4 w-4" />
                TRY THIS ON
              </button>

              <div className="flex items-center gap-3">
                {/* Shop Now */}
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
                >
                  <Heart className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} />
                </button>
              </AuthGate>

                {/* Share */}
                <ShareButton
                  title={`${product.brand} — ${product.name}`}
                  url={product.source_url || window.location.href}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/30 text-foreground/60 hover:border-accent/20 hover:text-foreground/80 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductDetailSheet;
