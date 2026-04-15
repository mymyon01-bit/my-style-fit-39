import { type Product } from "@/lib/mockData";
import { Heart, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
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
      className="group cursor-pointer animate-fade-up"
      onClick={() => navigate(`/fit/${product.id}`)}
    >
      <div className="relative overflow-hidden rounded-xl bg-card shadow-card">
        <img
          src={product.image}
          alt={product.name}
          className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          loading="lazy"
        />
        {/* Save button — gated */}
        <AuthGate action="save items">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLiked(!liked);
            }}
            className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all hover:bg-background/90"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${liked ? "fill-accent text-accent" : "text-foreground/80"}`}
            />
          </button>
        </AuthGate>
        {/* Match badge */}
        {matchScore >= 70 && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 backdrop-blur-sm">
            <Sparkles className="h-3 w-3 text-primary-foreground" />
            <span className="text-[10px] font-bold text-primary-foreground">
              {matchScore}%
            </span>
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-2.5 space-y-0.5 px-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{product.brand}</p>
          <p className="text-sm font-medium leading-snug text-foreground">{product.name}</p>
          <p className="text-sm font-semibold text-foreground">${product.price}</p>
          <p className="mt-1 text-[11px] leading-tight text-accent">
            {displayReason}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductCard;
