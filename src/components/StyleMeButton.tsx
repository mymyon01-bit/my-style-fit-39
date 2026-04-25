/**
 * StyleMeButton — fetches ONE recommended product (from product_cache, ranked
 * by trend + user prefs) and opens StyleLookModal which fits it on a clean
 * mannequin via the same fit-tryon-router pipeline used on FitPage.
 *
 * Open to everyone (guests, trial, premium).
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import StyleLookModal, { type StyleLookProduct } from "./StyleLookModal";
import { toast } from "sonner";

interface Props {
  variant?: "pill" | "solid";
  label?: string;
  className?: string;
}

export default function StyleMeButton({
  variant = "pill",
  label = "STYLE ME",
  className = "",
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<StyleLookProduct | null>(null);
  const [alts, setAlts] = useState<StyleLookProduct[]>([]);
  const [open, setOpen] = useState(false);

  async function pickProducts(): Promise<StyleLookProduct[]> {
    // Read user style prefs (when signed in) to bias the pick.
    let prefStyles: string[] = [];
    let prefGender: string | null = null;
    if (user) {
      const [styleRes, profRes] = await Promise.all([
        supabase.from("style_profiles").select("preferred_styles").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("gender_preference").eq("user_id", user.id).maybeSingle(),
      ]);
      prefStyles = (styleRes.data as any)?.preferred_styles || [];
      prefGender = (profRes.data as any)?.gender_preference || null;
    }

    // Pull a small pool of fashion items with images, prefer "top" category.
    let q = supabase
      .from("product_cache")
      .select("id,name,brand,image_url,source_url,price,category,reason,style_tags")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("trend_score", { ascending: false })
      .limit(40);

    if (prefStyles.length) {
      // Style overlap (best-effort)
      q = q.overlaps("style_tags", prefStyles);
    }
    const { data } = await q;
    let pool = (data || []) as any[];

    // Only keep products with a valid http(s) image URL — the fit router
    // rejects anything else with `missing_image` and the modal shows an error.
    pool = pool.filter(p => typeof p.image_url === "string" && /^https?:\/\//i.test(p.image_url));

    // Prefer tops
    const tops = pool.filter(p => /top|shirt|tee|sweater|hoodie|blouse|knit/i.test(p.category || p.name || ""));
    if (tops.length) pool = tops.concat(pool.filter(p => !tops.includes(p)));

    // Shuffle for variety, take top 4
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, 4).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      image_url: p.image_url,
      source_url: p.source_url,
      price: p.price,
      category: p.category,
      reason: p.reason,
    }));
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const picks = await pickProducts();
      if (!picks.length) {
        toast.error("No products available right now. Try discover first.");
        return;
      }
      setProduct(picks[0]);
      setAlts(picks.slice(1));
      setOpen(true);
    } catch (e) {
      console.warn("StyleMeButton failed", e);
      toast.error("Couldn't fetch a look — please retry.");
    } finally {
      setLoading(false);
    }
  }

  const baseCls =
    variant === "solid"
      ? "bg-foreground text-background hover:bg-primary hover:text-primary-foreground"
      : "border border-foreground/20 text-foreground/85 hover:border-foreground hover:text-foreground bg-background/40 backdrop-blur-sm";

  return (
    <>
      <motion.button
        onClick={handleClick}
        disabled={loading}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={`relative inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-wide transition-colors duration-200 whitespace-nowrap disabled:opacity-70 ${baseCls} ${className}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-40"
          style={{ animationDuration: "2.4s" }}
        />
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin relative" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 relative" />
        )}
        <span className="relative">{loading ? "FINDING…" : label}</span>
      </motion.button>

      <StyleLookModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) { setProduct(null); setAlts([]); }
        }}
        product={product}
        alternatives={alts}
      />
    </>
  );
}
