import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface SavedProduct {
  id: string;
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
}

interface Props {
  open: boolean;
  product: SavedProduct | null;
  onClose: () => void;
  onPosted?: () => void;
}

const MAX_CAPTION = 100;

/**
 * Lightweight sheet to publish a saved product as an OOTD post.
 * Uses the product image as the post image and links the product id.
 */
export default function PostProductToOOTDSheet({ open, product, onClose, onPosted }: Props) {
  const { user } = useAuth();
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!user || !product) return;
    if (!product.imageUrl) {
      toast.error("This product has no image to post");
      return;
    }
    setPosting(true);
    try {
      const { error } = await supabase.from("ootd_posts").insert({
        user_id: user.id,
        image_url: product.imageUrl,
        caption: caption.slice(0, MAX_CAPTION) || `Wearing ${product.brand ?? "this"} — ${product.name}`,
        linked_products: [product.productId],
        style_tags: [],
        occasion_tags: [],
        topics: [],
      });
      if (error) throw error;
      toast.success("Posted to OOTD");
      setCaption("");
      onPosted?.();
      onClose();
    } catch (e) {
      console.error("[post-saved-ootd]", e);
      toast.error("Couldn't post — try again");
    } finally {
      setPosting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-sm sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 pb-10 sm:my-6 sm:max-h-[90vh] sm:overflow-y-auto"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">Post to OOTD</h3>
              <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 flex gap-3">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-24 w-20 flex-shrink-0 rounded-lg bg-muted object-cover"
                />
              ) : (
                <div className="flex h-24 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Camera className="h-5 w-5 text-foreground/30" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {product.brand && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">
                    {product.brand}
                  </p>
                )}
                <p className="mt-0.5 text-sm font-medium text-foreground line-clamp-2">{product.name}</p>
              </div>
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="Say something about this look…"
                maxLength={MAX_CAPTION}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-foreground/30">
                {caption.length}/{MAX_CAPTION}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-foreground/70 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                disabled={posting || !product.imageUrl}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post to OOTD"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
