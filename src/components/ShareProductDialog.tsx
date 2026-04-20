import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import SafeImage from "@/components/SafeImage";
import { useReferralCode } from "@/hooks/useReferralCode";

interface Product {
  id: string;
  name: string;
  brand: string;
  image_url?: string | null;
  source_url?: string | null;
}

interface Props {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}

/**
 * Share a product via copyable link (includes user's referral code if logged in).
 */
export default function ShareProductDialog({ open, product, onClose }: Props) {
  const { code: referralCode } = useReferralCode();
  const [copied, setCopied] = useState(false);

  const buildLink = () => {
    if (!product) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = new URL(`${origin}/discover`);
    url.searchParams.set("p", product.id);
    if (referralCode) url.searchParams.set("ref", referralCode);
    return url.toString();
  };

  const link = buildLink();

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleNativeShare = async () => {
    if (!product) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `${product.brand} — ${product.name}`,
          text: `Check out this look on WARDROBE`,
          url: link,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-6 pb-9 sm:rounded-3xl sm:border"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">Share this find</h3>
              <button onClick={onClose} className="text-foreground/55 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Product preview */}
            <div className="mb-5 flex gap-3 rounded-2xl border border-border/30 bg-background/50 p-3">
              <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                <SafeImage
                  src={product.image_url || ""}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  fallbackClassName="h-full w-full"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                  {product.brand}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] font-medium text-foreground/85">
                  {product.name}
                </p>
              </div>
            </div>

            {/* Link */}
            <div className="mb-3 flex items-stretch gap-2 rounded-xl border border-border/30 bg-background/40 p-1.5">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[11px] text-foreground/70 outline-none"
              />
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                  copied
                    ? "bg-accent/15 text-accent"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {referralCode && (
              <p className="mb-4 text-[10px] text-foreground/45">
                Includes your referral code — earn ★5 when a friend joins.
              </p>
            )}

            {typeof navigator !== "undefined" && (navigator as any).share && (
              <button
                onClick={handleNativeShare}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/30 py-3 text-[12px] font-medium text-foreground/75 hover:bg-foreground/[0.04]"
              >
                <Share2 className="h-4 w-4" />
                Share via…
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
