import { useState } from "react";
import { motion } from "framer-motion";
import { Link2, Search, ChevronRight } from "lucide-react";
import { mockProducts, Product } from "@/lib/mockData";
import { mockProductFitData } from "@/lib/fitEngine";

interface Props {
  onSelectProduct: (productId: string) => void;
}

export default function FitProductCheck({ onSelectProduct }: Props) {
  const [url, setUrl] = useState("");

  const availableProducts = mockProducts.filter(p => mockProductFitData[p.id]);

  return (
    <div className="space-y-6">
      {/* URL input */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">PASTE PRODUCT URL</p>
        <div className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-4 py-3">
          <Link2 className="h-4 w-4 text-foreground/20 shrink-0" />
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://cos.com/oversized-shirt..."
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/20"
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
      </div>

      {/* Catalog items with fit data */}
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30 mb-3">ITEMS WITH FIT DATA</p>
        <div className="space-y-2">
          {availableProducts.map(product => {
            const fitData = mockProductFitData[product.id];
            return (
              <motion.button
                key={product.id}
                onClick={() => onSelectProduct(product.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-foreground/[0.04] bg-card/30 p-3 text-left transition-colors hover:bg-card/60"
                whileTap={{ scale: 0.98 }}
              >
                <img src={product.image} alt={product.name} className="h-16 w-12 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                  <p className="text-[10px] text-foreground/30">{product.brand} · ${product.price}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                      {fitData.fitType}
                    </span>
                    <span className="text-[9px] text-foreground/25">
                      Data: {fitData.dataQualityScore}/100
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-foreground/15 shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
