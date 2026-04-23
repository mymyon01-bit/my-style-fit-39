/**
 * StyleMeButton — single CTA that fetches a personalised outfit recommendation
 * and opens it inside StyleLookModal (with AI lookbook image + variations).
 *
 * Open to everyone (guests, trial, premium) — uses the daily-stylist edge
 * function which already removed the premium gate for non-authenticated users.
 */
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWeather } from "@/hooks/useWeather";
import StyleLookModal, { type StyleLookOutfit } from "./StyleLookModal";
import { toast } from "sonner";

interface Props {
  /** "pill" — rounded outline (matches About button); "solid" — filled CTA. */
  variant?: "pill" | "solid";
  label?: string;
  className?: string;
}

export default function StyleMeButton({
  variant = "pill",
  label = "STYLE ME",
  className = "",
}: Props) {
  const weather = useWeather();
  const [loading, setLoading] = useState(false);
  const [outfit, setOutfit] = useState<StyleLookOutfit | null>(null);
  const [open, setOpen] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-stylist", {
        body: {
          type: "daily",
          weather: { temp: weather.temp, condition: weather.condition },
          location: weather.location,
        },
      });
      if (error) throw error;
      if (data?.error === "rate_limited") {
        toast.error("Too many requests — try again shortly.");
        return;
      }
      const arr = Array.isArray(data?.outfits) ? data.outfits : [];
      const first = arr[0];
      if (!first) {
        toast.error("Couldn't generate a look. Try again.");
        return;
      }
      setOutfit(first);
      setOpen(true);
    } catch (e) {
      console.warn("StyleMeButton failed", e);
      toast.error("Style failed — please retry.");
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
        {/* Pulsing aura */}
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
        <span className="relative">{loading ? "STYLING…" : label}</span>
      </motion.button>

      <StyleLookModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setOutfit(null);
        }}
        baseOutfit={outfit}
      />
    </>
  );
}
