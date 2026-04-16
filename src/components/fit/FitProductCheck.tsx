import { useState } from "react";
import { motion } from "framer-motion";
import { Link2, Search, Info } from "lucide-react";
import { mockProductFitData } from "@/lib/fitEngine";

interface Props {
  onSelectProduct: (productId: string) => void;
}

// Products with real fit data in the engine
const FIT_CATALOG = Object.entries(mockProductFitData).map(([id, data]) => ({
  id,
  name: id === "3" ? "Oversized Cotton Shirt" : id === "5" ? "Merino Crew Neck" : id === "2" ? "Straight Leg Trousers" : "Wide Leg Linen Pants",
  brand: id === "3" ? "Lemaire" : id === "5" ? "AMI Paris" : id === "2" ? "ARKET" : "Our Legacy",
  category: data.category,
  fitType: data.fitType,
  dataQuality: data.dataQualityScore,
}));

export default function FitProductCheck({ onSelectProduct }: Props) {
  const [url, setUrl] = useState("");

  return (
    <div className="space-y-6">
      {/* URL input */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80">PASTE PRODUCT URL</p>
        <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-4 py-3">
          <Link2 className="h-4 w-4 text-foreground/75 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://cos.com/oversized-shirt..."
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/75"
          />
        </div>
        {url && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background"
          >
            <Search className="h-3.5 w-3.5" />
            Analyze Product
          </motion.button>
        )}
        <div className="flex items-start gap-2 mt-1">
          <Info className="h-3 w-3 text-foreground/80 mt-0.5 shrink-0" />
          <p className="text-[10px] text-foreground/75 leading-relaxed">
            Product URL analysis is coming soon. For now, try the items below with built-in fit data.
          </p>
        </div>
      </div>

      {/* Catalog items with fit data */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/80 mb-3">ITEMS WITH FIT DATA</p>
        <div className="space-y-2">
          {FIT_CATALOG.map(product => (
            <motion.button
              key={product.id}
              onClick={() => onSelectProduct(product.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-foreground/[0.06] bg-card/30 p-4 text-left transition-colors hover:bg-card/60"
              whileTap={{ scale: 0.98 }}
            >
              <div className="h-12 w-12 rounded-xl bg-foreground/[0.04] flex items-center justify-center text-foreground/80 text-lg font-display font-bold">
                {product.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                <p className="text-[10px] text-foreground/80">{product.brand}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                    {product.fitType}
                  </span>
                  <span className="text-[9px] text-foreground/75">
                    Data: {product.dataQuality}/100
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
