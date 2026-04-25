/**
 * StyleMeButton — fetches THREE personalized product recommendations from
 * product_cache. It scores trend + body profile + style prefs + saved/liked
 * shopping history, then adds controlled randomness for variety.
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
    // Read the user's full recommendation context when signed in.
    let prefStyles: string[] = [];
    let prefGender: string | null = null;
    let prefFit: string | null = null;
    let silhouette: string | null = null;
    let savedIds: string[] = [];
    let likedIds: string[] = [];
    let viewedIds: string[] = [];
    let dislikedIds: string[] = [];
    if (user) {
      const [styleRes, profRes, bodyRes, savedRes, interactionRes] = await Promise.all([
        supabase.from("style_profiles").select("preferred_styles,preferred_fit").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("gender_preference").eq("user_id", user.id).maybeSingle(),
        supabase.from("body_profiles").select("silhouette_type,height_cm,waist_cm,shoulder_width_cm").eq("user_id", user.id).maybeSingle(),
        supabase.from("saved_items").select("product_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(80),
        supabase.from("interactions").select("target_id,event_type,created_at").eq("user_id", user.id).eq("target_type", "product").order("created_at", { ascending: false }).limit(160),
      ]);
      prefStyles = (styleRes.data as any)?.preferred_styles || [];
      prefFit = (styleRes.data as any)?.preferred_fit || null;
      prefGender = (profRes.data as any)?.gender_preference || null;
      silhouette = (bodyRes.data as any)?.silhouette_type || null;
      savedIds = ((savedRes.data as any[]) || []).map((x) => String(x.product_id));
      likedIds = ((interactionRes.data as any[]) || []).filter((x) => x.event_type === "like").map((x) => String(x.target_id));
      viewedIds = ((interactionRes.data as any[]) || []).filter((x) => x.event_type === "view").map((x) => String(x.target_id));
      dislikedIds = ((interactionRes.data as any[]) || []).filter((x) => x.event_type === "dislike" || x.event_type === "skip").map((x) => String(x.target_id));
    }

    const historyIds = [...new Set([...savedIds, ...likedIds, ...viewedIds])].slice(0, 80);
    const [poolRes, historyRes] = await Promise.all([
      supabase
      .from("product_cache")
        .select("id,name,brand,image_url,source_url,price,category,subcategory,reason,style_tags,color_tags,fit,trend_score,like_count,view_count,store_name")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("trend_score", { ascending: false })
        .limit(180),
      historyIds.length
        ? supabase
            .from("product_cache")
            .select("id,brand,category,style_tags,color_tags,fit")
            .in("id", historyIds)
        : Promise.resolve({ data: [] } as any),
    ]);

    let pool = (poolRes.data || []) as any[];

    // Only keep products with a valid http(s) image URL — the fit router
    // rejects anything else with `missing_image` and the modal shows an error.
    pool = pool.filter(p => typeof p.image_url === "string" && /^https?:\/\//i.test(p.image_url));

    const savedSet = new Set(savedIds);
    const likedSet = new Set(likedIds);
    const viewedSet = new Set(viewedIds);
    const dislikedSet = new Set(dislikedIds);
    const preferredStyleSet = new Set(prefStyles.map((s) => String(s).toLowerCase()));
    const historyRows = ((historyRes as any).data || []) as any[];
    const historyStyles = new Set(historyRows.flatMap((p) => p.style_tags || []).map((s: string) => s.toLowerCase()));
    const historyBrands = new Set(historyRows.map((p) => String(p.brand || "").toLowerCase()).filter(Boolean));
    const historyCategories = new Set(historyRows.map((p) => String(p.category || "").toLowerCase()).filter(Boolean));
    const genderNeedle = String(prefGender || "").toLowerCase();

    const scoreProduct = (p: any) => {
      const text = `${p.name || ""} ${p.brand || ""} ${p.category || ""} ${p.subcategory || ""}`.toLowerCase();
      const tags = ((p.style_tags || []) as string[]).map((t) => t.toLowerCase());
      let score = 42;

      const trend = Number(p.trend_score || 0);
      score += Math.min(18, trend / 6);
      score += Math.min(8, Number(p.like_count || 0) / 6);
      score += Math.min(5, Number(p.view_count || 0) / 25);

      const styleHits = tags.filter((t) => preferredStyleSet.has(t)).length;
      score += styleHits * 16;
      if (tags.some((t) => historyStyles.has(t))) score += 12;
      if (historyBrands.has(String(p.brand || "").toLowerCase())) score += 10;
      if (historyCategories.has(String(p.category || "").toLowerCase())) score += 8;
      if (savedSet.has(p.id)) score += 18;
      if (likedSet.has(p.id)) score += 16;
      if (viewedSet.has(p.id)) score += 5;
      if (dislikedSet.has(p.id)) score -= 35;

      if (prefFit && String(p.fit || "").toLowerCase().includes(prefFit.toLowerCase())) score += 7;
      if (silhouette === "pear" && /outerwear|jacket|blazer|top|shirt|knit/.test(text)) score += 7;
      if (silhouette === "inverted-triangle" && /pants|trouser|skirt|bottom|wide/.test(text)) score += 7;
      if (silhouette === "athletic" && /tailored|structured|shirt|blazer|top/.test(text)) score += 6;
      if (silhouette === "balanced" && /set|classic|minimal|straight/.test(text)) score += 5;

      if (genderNeedle.startsWith("men") || genderNeedle === "male") {
        if (/women|female|dress|skirt/.test(text)) score -= 20;
        if (/men|male|unisex/.test(text)) score += 5;
      }
      if (genderNeedle.startsWith("women") || genderNeedle === "female") {
        if (/men|male/.test(text) && !/women|unisex/.test(text)) score -= 16;
        if (/women|female|unisex/.test(text)) score += 5;
      }

      score += Math.random() * 14;
      return Math.max(1, Math.min(99, Math.round(score)));
    };

    const scored = pool
      .map((p) => ({ ...p, match_score: scoreProduct(p) }))
      .sort((a, b) => b.match_score - a.match_score);

    const picked: any[] = [];
    for (const item of scored) {
      const category = String(item.category || item.subcategory || "").toLowerCase();
      if (picked.length < 2 || !picked.some((p) => String(p.category || p.subcategory || "").toLowerCase() === category)) {
        picked.push(item);
      }
      if (picked.length === 3) break;
    }

    return (picked.length ? picked : scored.slice(0, 3)).slice(0, 3).map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      image_url: p.image_url,
      source_url: p.source_url,
      price: p.price,
      category: p.category,
      reason: buildReason(p, prefStyles, savedSet, likedSet, historyStyles, silhouette),
      match_score: p.match_score,
    }));
  }

  function buildReason(
    p: any,
    styles: string[],
    savedSet: Set<string>,
    likedSet: Set<string>,
    historyStyles: Set<string>,
    silhouette: string | null
  ) {
    const tags = ((p.style_tags || []) as string[]).map((t) => t.toLowerCase());
    const reasons: string[] = [];
    const styleHit = styles.find((s) => tags.includes(String(s).toLowerCase()));
    if (styleHit) reasons.push(`${styleHit} 취향 반영`);
    if (savedSet.has(p.id) || likedSet.has(p.id)) reasons.push("저장/좋아요 이력 반영");
    else if (tags.some((t) => historyStyles.has(t))) reasons.push("쇼핑 이력과 비슷한 무드");
    if (silhouette) reasons.push("체형 밸런스 고려");
    if (Number(p.trend_score || 0) > 60) reasons.push("트렌드 점수 높음");
    return reasons.slice(0, 3).join(" · ") || p.reason || "전체 취향과 활동을 바탕으로 추천";
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
      setAlts(picks.slice(1, 3));
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
