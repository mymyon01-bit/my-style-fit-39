import { type Product } from "@/lib/recommendation";
import { Heart, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import SafeImage from "@/components/SafeImage";
import ShareButton from "@/components/ShareButton";
import type { ProductScoreBreakdown } from "@/lib/recommendation";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  scoreBreakdown?: ProductScoreBreakdown;
}

const ProductCard = ({ product, compact, scoreBreakdown }: ProductCardProps) => {
  const [liked, setLiked] = useState(false);
  const navigate = useNavigate();

  const displayReason = scoreBreakdown?.explanation || product.reason;
  const matchScore = scoreBreakdown?.final || product.fitScore;

  return (
    <div
      className="group cursor-pointer animate-fade-in transition-transform duration-200 ease-out active:scale-[0.99]"
      onClick={() => {
        // If product has a real external URL, open in new tab
        if (product.source_url && product.source_url.startsWith("http")) {
          window.open(product.source_url, "_blank", "noopener,noreferrer");
        } else {
          navigate(`/fit/${product.id}`);
        }
      }}
    >
      <div className="relative overflow-hidden rounded-xl bg-card shadow-soft transition-shadow duration-200 ease-out group-hover:shadow-md">
        <SafeImage
          src={product.image}
          alt={product.name}
          className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          fallbackClassName="aspect-[3/4] w-full"
          loading="lazy"
        />
        <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
          <AuthGate action="save items">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLiked(!liked);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all duration-200 ease-out hover:bg-background/90 active:scale-95"
              aria-label={liked ? "Unlike" : "Like"}
            >
              <Heart
                key={`heart-${liked}`}
                className={`h-4 w-4 transition-colors ${liked ? "fill-accent text-accent animate-like-pop" : "text-foreground/75"}`}
              />
            </button>
          </AuthGate>
          <ShareButton
            title={`${product.brand} — ${product.name}`}
            url={`${window.location.origin}/fit/${product.id}`}
          />
        </div>
        {matchScore >= 70 && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-primary-foreground" />
            <span className="text-[10px] font-bold text-primary-foreground">{matchScore}%</span>
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-2.5 space-y-0.5 px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{product.brand}</p>
          <p className="text-sm font-semibold leading-snug text-foreground">{product.name}</p>
          <p className="text-sm font-bold text-foreground">${product.price}</p>
          {displayReason && <p className="mt-1 text-[11px] leading-tight text-accent/80">{displayReason}</p>}
        </div>
      )}
    </div>
  );
};

export default ProductCard;
