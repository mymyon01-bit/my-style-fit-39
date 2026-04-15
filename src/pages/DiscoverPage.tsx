import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DailyPicks from "@/components/DailyPicks";
import WeeklyPlan from "@/components/WeeklyPlan";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";

interface AIRecommendation {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  reason: string;
  style_tags: string[];
  color: string;
  fit: string;
}

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moodParam = searchParams.get("mood");

  // Quiz + Recommendation state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);
  const [textInput, setTextInput] = useState(moodParam || "");
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showAuthHint, setShowAuthHint] = useState(false);

  // Auto-generate if mood param exists
  useEffect(() => {
    if (moodParam && !hasGenerated) {
      generateRecommendations(moodParam);
    }
  }, [moodParam]);

  // Load saved items
  useEffect(() => {
    if (user) loadSavedIds();
  }, [user]);

  const loadSavedIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_items").select("product_id").eq("user_id", user.id);
    setSavedIds(new Set((data || []).map(d => d.product_id)));
  };

  const handleQuizComplete = (answers: StyleQuizAnswers) => {
    setQuizAnswers(answers);
    setShowQuiz(false);
    // Build a prompt from quiz answers
    const prompt = buildPromptFromQuiz(answers);
    generateRecommendations(prompt, answers);
  };

  const buildPromptFromQuiz = (a: StyleQuizAnswers): string => {
    const parts: string[] = [];
    if (a.preferredStyles.length) parts.push(`Style: ${a.preferredStyles.join(", ")}`);
    if (a.fitPreference) parts.push(`Fit: ${a.fitPreference}`);
    if (a.colorPreference) parts.push(`Colors: ${a.colorPreference}`);
    if (a.dailyVibe) parts.push(`Vibe: ${a.dailyVibe}`);
    if (a.occasionPreference) parts.push(`Occasion: ${a.occasionPreference}`);
    if (a.budgetRange) parts.push(`Budget: ${a.budgetRange}`);
    if (a.dislikedStyles.length) parts.push(`Avoid: ${a.dislikedStyles.join(", ")}`);
    return parts.join(". ");
  };

  const generateRecommendations = async (prompt: string, quiz?: StyleQuizAnswers) => {
    setIsGenerating(true);
    setHasGenerated(true);
    try {
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt,
          quizAnswers: quiz || quizAnswers,
          userId: user?.id || null,
        },
      });
      if (error) throw error;
      setRecommendations(data?.recommendations || []);
    } catch (e) {
      console.error("Recommendation error:", e);
      setRecommendations([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    generateRecommendations(textInput.trim());
  };

  const handleFeedback = useCallback(async (itemId: string, type: "like" | "dislike") => {
    setFeedbackMap(prev => {
      const current = prev[itemId];
      if (current === type) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: type };
    });
    if (user) {
      await supabase.from("interactions").insert({
        user_id: user.id,
        target_id: itemId,
        target_type: "product",
        event_type: type,
        metadata: { source: "discover_feed", quiz: !!quizAnswers },
      });
    }
  }, [user, quizAnswers]);

  const handleSave = useCallback(async (itemId: string) => {
    if (!user) {
      setShowAuthHint(true);
      return;
    }
    if (savedIds.has(itemId)) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      await supabase.from("saved_items").delete().eq("user_id", user.id).eq("product_id", itemId);
    } else {
      setSavedIds(prev => new Set(prev).add(itemId));
      await supabase.from("saved_items").insert({ user_id: user.id, product_id: itemId });
    }
  }, [user, savedIds]);

  const interactionCount = Object.keys(feedbackMap).length;

  return (
    <>
      <AnimatePresence>
        {showQuiz && (
          <StyleQuiz onComplete={handleQuizComplete} onClose={() => setShowQuiz(false)} />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
        {/* Header */}
        <div className="mx-auto max-w-lg px-8 pt-10 pb-2 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 md:text-[13px] lg:hidden">WARDROBE</span>
            <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/62 md:text-[11px]">DISCOVER</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-8 pt-8 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12 lg:pt-10">
          {/* Text Input */}
          <div className="flex items-center gap-3 pb-4">
            <Search className="h-4 w-4 text-foreground/60 shrink-0 md:h-5 md:w-5" />
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
              placeholder="Describe your style…"
              className="flex-1 bg-transparent text-[14px] font-light text-foreground outline-none placeholder:text-foreground/50 md:text-base"
            />
            {textInput.trim() && (
              <button
                onClick={handleTextSubmit}
                className="text-[10px] font-medium tracking-[0.15em] text-accent/80 hover:text-accent transition-colors"
              >
                GO
              </button>
            )}
          </div>
          <div className="h-px bg-accent/[0.16]" />

          {/* Quick Actions */}
          <div className="mt-5 flex items-center gap-4">
            <button
              onClick={() => setShowQuiz(true)}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[11px] font-medium text-foreground/60 hover:text-foreground/80 hover:border-accent/30 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent/70" />
              {quizAnswers ? "Refine Style" : "Style Quiz"}
            </button>
            {quizAnswers && (
              <button
                onClick={() => { setQuizAnswers(null); setRecommendations([]); setHasGenerated(false); setTextInput(""); }}
                className="text-[10px] tracking-[0.15em] text-foreground/40 hover:text-foreground/60 transition-colors"
              >
                RESET
              </button>
            )}
          </div>

          {/* Results Area */}
          <div className="mt-10 md:mt-12 lg:mt-14">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-accent/70" />
                <p className="text-[11px] text-foreground/50">Curating your recommendations…</p>
              </div>
            ) : hasGenerated && recommendations.length > 0 ? (
              <div className="space-y-14 md:space-y-16">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.25em] text-accent/80 md:text-[11px]">
                      CURATED FOR YOU
                    </p>
                    {interactionCount > 2 && (
                      <p className="text-[10px] text-foreground/50 mt-1">Adapting to your taste…</p>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground/40">{recommendations.length} items</span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
                  {recommendations.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="group"
                    >
                      {/* Visual placeholder — no fake images */}
                      <div className="relative overflow-hidden rounded-xl bg-foreground/[0.04] aspect-[3/4] flex flex-col items-center justify-center p-4">
                        {/* Color swatch */}
                        <div
                          className="h-8 w-8 rounded-full mb-3 opacity-60"
                          style={{ backgroundColor: item.color || "hsl(var(--accent))" }}
                        />
                        <p className="text-[10px] font-medium tracking-[0.12em] text-foreground/40 text-center">{item.brand}</p>
                        <p className="text-[12px] font-medium text-foreground/70 mt-1 text-center leading-tight md:text-[13px]">{item.name}</p>
                        <p className="text-[11px] font-medium text-foreground/50 mt-2">{item.price}</p>

                        {/* Category badge */}
                        <span className="absolute left-3 top-3 text-[9px] font-medium tracking-[0.1em] text-foreground/30 uppercase">
                          {item.category}
                        </span>

                        {/* Save button */}
                        <AuthGate action="save items">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSave(item.id); }}
                            className="absolute right-3 top-3 p-2 rounded-full bg-foreground/[0.04] transition-colors hover:bg-foreground/[0.08]"
                          >
                            <Bookmark
                              className={`h-3.5 w-3.5 transition-colors ${
                                savedIds.has(item.id) ? "fill-accent text-accent" : "text-foreground/30"
                              }`}
                            />
                          </button>
                        </AuthGate>
                      </div>

                      {/* Feedback + Details */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5 flex-wrap">
                            {item.style_tags?.slice(0, 2).map(tag => (
                              <span key={tag} className="text-[9px] text-foreground/40">{tag}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleFeedback(item.id, "like")}
                              className={`p-1.5 rounded-full transition-all ${
                                feedbackMap[item.id] === "like"
                                  ? "text-accent/80 bg-accent/10"
                                  : "text-foreground/30 hover:text-foreground/50"
                              }`}
                            >
                              <Heart className={`h-3 w-3 ${feedbackMap[item.id] === "like" ? "fill-current" : ""}`} />
                            </button>
                            <button
                              onClick={() => handleFeedback(item.id, "dislike")}
                              className={`p-1.5 rounded-full transition-all ${
                                feedbackMap[item.id] === "dislike"
                                  ? "text-destructive/60 bg-destructive/10"
                                  : "text-foreground/30 hover:text-foreground/50"
                              }`}
                            >
                              <HeartOff className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] leading-[1.6] text-foreground/50">{item.reason}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : hasGenerated && recommendations.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <p className="text-[14px] text-foreground/60">No recommendations found</p>
                <p className="text-[12px] text-foreground/40 max-w-[260px] mx-auto">
                  Try describing your style differently or take the quiz for better results.
                </p>
              </div>
            ) : (
              /* Empty state — no mock data */
              <div className="space-y-16 md:space-y-20">
                <div className="py-16 text-center space-y-5 md:py-20 lg:py-24">
                  <p className="font-display text-lg text-foreground/60 md:text-xl">Discover your style</p>
                  <p className="mx-auto max-w-[280px] text-[12px] leading-[1.8] text-foreground/50 md:max-w-xs md:text-[13px]">
                    Tell us your preferences to get curated recommendations that match your taste.
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={() => setShowQuiz(true)}
                      className="text-[10px] font-medium tracking-[0.2em] text-accent/70 transition-colors hover:text-accent"
                    >
                      TAKE STYLE QUIZ
                    </button>
                    <span className="text-[10px] text-foreground/30">or type above</span>
                  </div>
                </div>

                {/* Premium content — Daily + Weekly */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                  <DailyPicks />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
                  <WeeklyPlan />
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>

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
              <p className="font-display text-[15px] text-foreground/85">
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
                  className="px-4 py-3 text-[10px] text-foreground/50 hover:text-foreground/60 transition-colors"
                >
                  LATER
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DiscoverPage;
