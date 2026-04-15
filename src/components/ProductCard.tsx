import { type Product } from "@/lib/mockData";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

const ProductCard = ({ product, compact }: ProductCardProps) => {
  const [liked, setLiked] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      className="group cursor-pointer animate-fade-up"
      onClick={() => navigate(`/fit/${product.id}`)}
    >
      <div className="relative overflow-hidden rounded-lg bg-card">
        <img
          src={product.image}
          alt={product.name}
          className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLiked(!liked);
          }}
          className="absolute right-2.5 top-2.5 rounded-full bg-background/80 p-1.5 backdrop-blur-sm transition-colors"
        >
          <Heart
            className={`h-4 w-4 ${liked ? "fill-accent text-accent" : "text-foreground/60"}`}
          />
        </button>
        {product.fitScore >= 85 && (
          <div className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
            {product.fitScore}% match
          </div>
        )}
      </div>
      {!compact && (
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-muted-foreground">{product.brand}</p>
          <p className="text-sm font-medium leading-tight text-foreground">{product.name}</p>
          <p className="text-sm font-semibold text-foreground">${product.price}</p>
          <p className="text-[11px] italic text-muted-foreground leading-tight">"{product.reason}"</p>
        </div>
      )}
    </div>
  );
};

export default ProductCard;
