import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, HeartOff, Bookmark, ArrowRight } from "lucide-react";
import { mockProducts, type Product } from "@/lib/mockData";
import {
  rankProducts,
  defaultBodyProfile,
  getDefaultContext,
  type UserProfile,
  type BehaviorData,
} from "@/lib/recommendation";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import type { StyleQuizAnswers } from "./StyleQuiz";

interface RecommendationFeedProps {
  quizAnswers: StyleQuizAnswers;
  onReset: () => void;
}

// Map quiz answers → recommendation engine profile
function quizToProfile(a: StyleQuizAnswers): UserProfile {
  const styleMap: Record<string, string> = {
    Minimal: "minimal", Street: "streetwear", Classic: "classic",
    Edgy: "streetwear", "Clean Fit": "cleanFit", "Old Money": "oldMoney", Chic: "chic",
  };
  const budgetMap: Record<string, string> = {
    "Under $80": "low", "$80–200": "mid", "$200–400": "high", "$400+": "luxury",
  };
  const dislikedMap: Record<string, string> = {
    Sporty: "sporty", "Loud Prints": "streetwear", "Ultra Slim": "cleanFit",
    "Heavy Logos": "streetwear", Oversized: "sporty", Formal: "classic",
  };
  return {
    preferredStyles: a.preferredStyles.map(s => styleMap[s] || s.toLowerCase()),
    dislikedStyles: a.dislikedStyles.map(s => dislikedMap[s] || s.toLowerCase()),
    preferredFit: a.fitPreference.toLowerCase(),
    budgetRange: budgetMap[a.budgetRange] || "mid",
    favoriteBrands: a.brandFamiliarity.filter(b => b !== "None"),
  };
}

const RecommendationFeed = ({ quizAnswers, onReset }: RecommendationFeedProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showAuthHint, setShowAuthHint] = useState(false);

  const profile = quizToProfile(quizAnswers);
  const context = getDefaultContext(quizAnswers.dailyVibe.toLowerCase());
  const behavior: BehaviorData = {
    likedProductIds: Object.entries(feedbackMap).filter(([, v]) => v === "like").map(([k]) => k),
    savedProductIds: Array.from(savedIds),
    viewedProductIds: mockProducts.map(p => p.id),
    skippedProductIds: Object.entries(feedbackMap).filter(([, v]) => v === "dislike").map(([k]) => k),
    starredOOTDIds: [],
  };

  const ranked = rankProducts(mockProducts, profile, defaultBodyProfile, context, behavior);

  // Build outfit groups: 1 main look + remaining items
  const mainLook = ranked.slice(0, 4);
  const restItems = ranked.slice(4);

  const handleFeedback = useCallback(async (productId: string, type: "like" | "dislike") => {
    setFeedbackMap(prev => {
      const current = prev[productId];
      if (current === type) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: type };
    });

    // Save interaction to DB if logged in
    if (user) {
      await supabase.from("interactions").insert({
        user_id: user.id,
        target_id: productId,
        target_type: "product",
        event_type: type,
        metadata: { source: "recommendation_feed", quiz: true },
      });
    }
  }, [user]);

  const handleSave = useCallback(async (productId: string) => {
    if (!user) {
      setShowAuthHint(true);
      return;
    }
    if (savedIds.has(productId)) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
      await supabase.from("saved_items").delete().eq("user_id", user.id).eq("product_id", productId);
    } else {
      setSavedIds(prev => new Set(prev).add(productId));
      await supabase.from("saved_items").insert({ user_id: user.id, product_id: productId });
    }
  }, [user, savedIds]);

  const interactionCount = Object.keys(feedbackMap).length;

  return (
    <div className="space-y-14 md:space-y-16 lg:space-y-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium tracking-[0.25em] text-accent/80 md:text-[11px]">
            CURATED FOR YOU
          </p>
          {interactionCount > 2 && (
            <p className="text-[10px] text-foreground/60 mt-1">
              Adapting to your taste…
            </p>
          )}
        </div>
        <button
          onClick={onReset}
          className="text-[10px] tracking-[0.15em] text-foreground/60 hover:text-foreground/60 transition-colors"
        >
          RETAKE QUIZ
        </button>
      </div>

      {/* Main Look — Outfit Composition */}
      <div className="space-y-6 md:space-y-8">
        <p className="text-[10px] font-medium tracking-[0.2em] text-foreground/48 md:text-[11px]">
          YOUR LOOK
        </p>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-5">
          {mainLook.map((product, i) => (
            <ProductRecommendationCard
              key={product.id}
              product={product}
              index={i}
              feedback={feedbackMap[product.id]}
              isSaved={savedIds.has(product.id)}
              onFeedback={handleFeedback}
              onSave={handleSave}
              explanation={product.scoreBreakdown.explanation}
              featured={i === 0}
            />
          ))}
        </div>
      </div>

      {/* More Picks */}
      {restItems.length > 0 && (
        <div className="space-y-6 md:space-y-8">
          <p className="text-[10px] font-medium tracking-[0.2em] text-foreground/48 md:text-[11px]">
            MORE FOR YOU
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
            {restItems.map((product, i) => (
              <ProductRecommendationCard
                key={product.id}
                product={product}
                index={i + 4}
                feedback={feedbackMap[product.id]}
                isSaved={savedIds.has(product.id)}
                onFeedback={handleFeedback}
                onSave={handleSave}
                explanation={product.scoreBreakdown.explanation}
              />
            ))}
          </div>
        </div>
      )}

      {/* Guest Auth Hint */}
      <AnimatePresence>
        {showAuthHint && !user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-sm px-8 md:bottom-28"
          >
            <div className="rounded-2xl bg-card/95 backdrop-blur-xl p-6 shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.3)] space-y-4">
              <p className="font-display text-[15px] text-foreground/85 md:text-base">
                Save your style and unlock more personalized recommendations.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/auth")}
                  className="flex-1 py-3 text-[10px] font-semibold tracking-[0.15em] text-foreground/80 hover:text-foreground transition-colors"
                >
                  CREATE ACCOUNT
                </button>
                <div className="w-px bg-accent/[0.14]" />
                <button
                  onClick={() => setShowAuthHint(false)}
                  className="px-4 py-3 text-[10px] text-foreground/62 hover:text-foreground/60 transition-colors"
                >
                  LATER
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Product Card with Feedback ---

interface CardProps {
  product: Product & { scoreBreakdown: { final: number; explanation: string } };
  index: number;
  feedback?: "like" | "dislike";
  isSaved: boolean;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
  explanation: string;
  featured?: boolean;
}

const ProductRecommendationCard = ({
  product, index, feedback, isSaved, onFeedback, onSave, explanation, featured,
}: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`group ${featured ? "col-span-2 md:col-span-1" : ""}`}
    >
      {/* Image */}
      <div className="relative overflow-hidden rounded-xl">
        <img
          src={product.image}
          alt={product.name}
          className={`w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] ${
            featured ? "aspect-[4/5]" : "aspect-[3/4]"
          }`}
          loading="lazy"
        />

        {/* Subtle gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Score badge */}
        <div className="absolute left-3 top-3">
          <span className="text-[10px] font-medium text-white/60 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {product.scoreBreakdown.final}%
          </span>
        </div>

        {/* Save */}
        <button
          onClick={(e) => { e.stopPropagation(); onSave(product.id); }}
          className="absolute right-3 top-3 p-2 rounded-full bg-black/20 backdrop-blur-sm transition-colors hover:bg-black/40"
        >
          <Bookmark
            className={`h-3.5 w-3.5 transition-colors ${
              isSaved ? "fill-white text-white" : "text-white/60"
            }`}
          />
        </button>

        {/* Bottom info */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="text-[10px] font-medium tracking-[0.12em] text-white/55">{product.brand}</p>
          <p className="text-[13px] font-medium text-white/90 mt-0.5 md:text-[14px]">{product.name}</p>
        </div>
      </div>

      {/* Details + Feedback */}
      <div className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground/68 md:text-[14px]">${product.price}</span>

          {/* Feedback buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFeedback(product.id, "like")}
              className={`p-2 rounded-full transition-all ${
                feedback === "like"
                  ? "text-accent/80 bg-accent/10"
                  : "text-foreground/68 hover:text-foreground/68"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${feedback === "like" ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={() => onFeedback(product.id, "dislike")}
              className={`p-2 rounded-full transition-all ${
                feedback === "dislike"
                  ? "text-destructive/60 bg-destructive/10"
                  : "text-foreground/68 hover:text-foreground/68"
              }`}
            >
              <HeartOff className={`h-3.5 w-3.5`} />
            </button>
          </div>
        </div>

        {/* Reason */}
        <p className="text-[11px] leading-[1.6] text-foreground/80 md:text-[12px]">
          {explanation}
        </p>
      </div>
    </motion.div>
  );
};

export default RecommendationFeed;
