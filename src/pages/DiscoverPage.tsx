import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark, SlidersHorizontal } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import { AuthGate } from "@/components/AuthGate";
import { useCategories } from "@/hooks/useCategories";
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

const BROWSE_TABS = [
  { slug: "for-you", label: "For You", icon: Sparkles },
  { slug: "clothes", label: "Clothes" },
  { slug: "accessories", label: "Accessories" },
  { slug: "bags", label: "Bags" },
  { slug: "wallets", label: "Wallets" },
  { slug: "shoes", label: "Shoes" },
  { slug: "featured", label: "New" },
];

const STYLE_FILTERS = ["minimal", "street", "classic", "edgy", "casual", "formal"];
const FIT_FILTERS = ["oversized", "regular", "slim"];
const COLOR_FILTERS = ["neutral", "dark", "mixed", "bold"];

const DiscoverPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moodParam = searchParams.get("mood");
  const sourceParam = searchParams.get("source");
  const { tree: categoryTree } = useCategories();

  const [activeTab, setActiveTab] = useState("for-you");
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);
  const [textInput, setTextInput] = useState(moodParam || "");
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showAuthHint, setShowAuthHint] = useState(false);

  // Filters
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedFit, setSelectedFit] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  useEffect(() => {
    if (moodParam && !hasGenerated) generateRecommendations(moodParam);
  }, [moodParam]);

  useEffect(() => {
    if (user) loadSavedIds();
  }, [user]);

  // When tab changes to a category, generate filtered recommendations
  useEffect(() => {
    if (activeTab !== "for-you" && activeTab !== "featured") {
      generateRecommendations(`Show me ${activeTab} items`, undefined, activeTab);
    }
  }, [activeTab]);

  const loadSavedIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_items").select("product_id").eq("user_id", user.id);
    setSavedIds(new Set((data || []).map(d => d.product_id)));
  };

  const handleQuizComplete = (answers: StyleQuizAnswers) => {
    setQuizAnswers(answers);
    setShowQuiz(false);
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

  const generateRecommendations = async (prompt: string, quiz?: StyleQuizAnswers, categoryFilter?: string) => {
    setIsGenerating(true);
    setHasGenerated(true);
    try {
      const filterContext = [];
      if (categoryFilter) filterContext.push(`Category: ${categoryFilter}`);
      if (selectedStyles.length) filterContext.push(`Style: ${selectedStyles.join(", ")}`);
      if (selectedFit) filterContext.push(`Fit: ${selectedFit}`);
      if (selectedColor) filterContext.push(`Color: ${selectedColor}`);
      
      const fullPrompt = filterContext.length > 0
        ? `${prompt}. Filters: ${filterContext.join(". ")}`
        : prompt;

      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt: fullPrompt,
          quizAnswers: quiz || quizAnswers,
          userId: user?.id || null,
          source: sourceParam || "discover",
          count: 10,
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
    setActiveTab("for-you");
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
        metadata: { source: "discover_feed", tab: activeTab },
      });
    }
  }, [user, activeTab]);

  const handleSave = useCallback(async (itemId: string) => {
    if (!user) { setShowAuthHint(true); return; }
    if (savedIds.has(itemId)) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      await supabase.from("saved_items").delete().eq("user_id", user.id).eq("product_id", itemId);
    } else {
      setSavedIds(prev => new Set(prev).add(itemId));
      await supabase.from("saved_items").insert({ user_id: user.id, product_id: itemId });
    }
  }, [user, savedIds]);

  const toggleStyle = (s: string) => setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // Group recommendations by category
  const groupedRecs = recommendations.reduce<Record<string, AIRecommendation[]>>((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const interactionCount = Object.keys(feedbackMap).length;

  return (
    <>
      <AnimatePresence>
        {showQuiz && <StyleQuiz onComplete={handleQuizComplete} onClose={() => setShowQuiz(false)} />}
      </AnimatePresence>

      <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
        {/* Header */}
        <div className="mx-auto max-w-lg px-6 pt-10 pb-2 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 lg:hidden">WARDROBE</span>
            <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/60">DISCOVER</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-6 pt-6 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {/* Search */}
          <div className="flex items-center gap-3 pb-4">
            <Search className="h-4 w-4 text-foreground/50 shrink-0" />
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
              placeholder="Describe your style…"
              className="flex-1 bg-transparent text-[14px] font-light text-foreground outline-none placeholder:text-foreground/40"
            />
            {textInput.trim() && (
              <button onClick={handleTextSubmit} className="text-[10px] font-medium tracking-[0.15em] text-accent/80 hover:text-accent transition-colors">GO</button>
            )}
          </div>
          <div className="h-px bg-accent/[0.12]" />

          {/* Category Tabs */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {BROWSE_TABS.map(tab => (
              <button
                key={tab.slug}
                onClick={() => setActiveTab(tab.slug)}
                className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-medium tracking-[0.05em] transition-all ${
                  activeTab === tab.slug
                    ? "bg-accent/15 text-foreground/90"
                    : "text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.03]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowQuiz(true)}
              className="flex items-center gap-2 rounded-full border border-border/30 px-4 py-2 text-[11px] font-medium text-foreground/50 hover:text-foreground/70 hover:border-accent/30 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent/60" />
              {quizAnswers ? "Refine" : "Style Quiz"}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-medium transition-all ${
                showFilters ? "border-accent/30 text-foreground/70" : "border-border/30 text-foreground/50 hover:text-foreground/70"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>
            {quizAnswers && (
              <button
                onClick={() => { setQuizAnswers(null); setRecommendations([]); setHasGenerated(false); setTextInput(""); }}
                className="text-[10px] tracking-[0.15em] text-foreground/30 hover:text-foreground/50 transition-colors"
              >
                RESET
              </button>
            )}
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4 rounded-xl border border-border/20 bg-card/30 p-4">
                  <div>
                    <p className="text-[9px] font-medium tracking-[0.2em] text-foreground/40 mb-2">STYLE</p>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_FILTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleStyle(s)}
                          className={`rounded-full px-3 py-1.5 text-[10px] transition-all ${
                            selectedStyles.includes(s)
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/40 hover:text-foreground/60"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium tracking-[0.2em] text-foreground/40 mb-2">FIT</p>
                    <div className="flex flex-wrap gap-2">
                      {FIT_FILTERS.map(f => (
                        <button
                          key={f}
                          onClick={() => setSelectedFit(selectedFit === f ? null : f)}
                          className={`rounded-full px-3 py-1.5 text-[10px] transition-all ${
                            selectedFit === f
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/40 hover:text-foreground/60"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium tracking-[0.2em] text-foreground/40 mb-2">COLOR</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_FILTERS.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                          className={`rounded-full px-3 py-1.5 text-[10px] transition-all ${
                            selectedColor === c
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/40 hover:text-foreground/60"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const prompt = textInput.trim() || `Recommend ${activeTab === "for-you" ? "fashion" : activeTab} items`;
                      generateRecommendations(prompt, undefined, activeTab !== "for-you" ? activeTab : undefined);
                    }}
                    className="w-full py-2.5 text-[10px] font-medium tracking-[0.15em] text-accent/70 hover:text-accent transition-colors border-t border-border/20 pt-3"
                  >
                    APPLY FILTERS
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Area */}
          <div className="mt-8">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-accent/60" />
                <p className="text-[11px] text-foreground/40">Curating recommendations…</p>
              </div>
            ) : hasGenerated && recommendations.length > 0 ? (
              <div className="space-y-12">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.25em] text-accent/70">
                      {activeTab === "for-you" ? "CURATED FOR YOU" : activeTab.toUpperCase()}
                    </p>
                    {interactionCount > 2 && (
                      <p className="text-[10px] text-foreground/40 mt-1">Adapting to your taste…</p>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground/30">{recommendations.length} items</span>
                </div>

                {/* Grouped display */}
                {Object.keys(groupedRecs).length > 1 ? (
                  Object.entries(groupedRecs).map(([category, items]) => (
                    <div key={category} className="space-y-4">
                      <p className="text-[10px] font-medium tracking-[0.2em] text-foreground/50 uppercase">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                        {items.map((item, i) => (
                          <RecommendationCard
                            key={item.id}
                            item={item}
                            index={i}
                            feedbackMap={feedbackMap}
                            savedIds={savedIds}
                            onFeedback={handleFeedback}
                            onSave={handleSave}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                    {recommendations.map((item, i) => (
                      <RecommendationCard
                        key={item.id}
                        item={item}
                        index={i}
                        feedbackMap={feedbackMap}
                        savedIds={savedIds}
                        onFeedback={handleFeedback}
                        onSave={handleSave}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : hasGenerated && recommendations.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <p className="text-[14px] text-foreground/50">No recommendations found</p>
                <p className="text-[12px] text-foreground/30 max-w-[260px] mx-auto">
                  Try describing your style differently or take the quiz for better results.
                </p>
              </div>
            ) : (
              <div className="py-16 text-center space-y-5">
                <p className="font-display text-lg text-foreground/60">Discover your style</p>
                <p className="mx-auto max-w-[280px] text-[12px] leading-[1.8] text-foreground/40">
                  Tell us your preferences or browse by category to see curated recommendations.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <button onClick={() => setShowQuiz(true)} className="text-[10px] font-medium tracking-[0.2em] text-accent/60 hover:text-accent transition-colors">
                    TAKE STYLE QUIZ
                  </button>
                  <span className="text-[10px] text-foreground/20">or browse categories above</span>
                </div>
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
            className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-sm px-8"
          >
            <div className="rounded-2xl bg-card/95 backdrop-blur-xl p-6 shadow-[0_8px_40px_-8px_hsl(0_0%_0%/0.3)] space-y-4">
              <p className="font-display text-[15px] text-foreground/80">
                Save your style and unlock personalized recommendations.
              </p>
              <div className="flex gap-3">
                <button onClick={() => navigate("/auth")} className="flex-1 py-3 text-[10px] font-semibold tracking-[0.15em] text-foreground/70 hover:text-foreground transition-colors">
                  CREATE ACCOUNT
                </button>
                <div className="w-px bg-accent/[0.12]" />
                <button onClick={() => setShowAuthHint(false)} className="px-4 py-3 text-[10px] text-foreground/40 hover:text-foreground/50 transition-colors">
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

// Extracted card component
const RecommendationCard = ({
  item, index, feedbackMap, savedIds, onFeedback, onSave
}: {
  item: AIRecommendation;
  index: number;
  feedbackMap: Record<string, "like" | "dislike">;
  savedIds: Set<string>;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
    className="group"
  >
    <div className="relative overflow-hidden rounded-xl bg-foreground/[0.04] aspect-[3/4] flex flex-col items-center justify-center p-4">
      <div className="h-8 w-8 rounded-full mb-3 opacity-60" style={{ backgroundColor: item.color || "hsl(var(--accent))" }} />
      <p className="text-[10px] font-medium tracking-[0.12em] text-foreground/40 text-center">{item.brand}</p>
      <p className="text-[12px] font-medium text-foreground/70 mt-1 text-center leading-tight">{item.name}</p>
      <p className="text-[11px] font-medium text-foreground/50 mt-2">{item.price}</p>
      <span className="absolute left-3 top-3 text-[9px] font-medium tracking-[0.1em] text-foreground/25 uppercase">{item.category}</span>
      <AuthGate action="save items">
        <button
          onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
          className="absolute right-3 top-3 p-2 rounded-full bg-foreground/[0.04] transition-colors hover:bg-foreground/[0.08]"
        >
          <Bookmark className={`h-3.5 w-3.5 transition-colors ${savedIds.has(item.id) ? "fill-accent text-accent" : "text-foreground/25"}`} />
        </button>
      </AuthGate>
    </div>
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {item.style_tags?.slice(0, 2).map(tag => (
            <span key={tag} className="text-[9px] text-foreground/35">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onFeedback(item.id, "like")} className={`p-1.5 rounded-full transition-all ${feedbackMap[item.id] === "like" ? "text-accent/80 bg-accent/10" : "text-foreground/25 hover:text-foreground/40"}`}>
            <Heart className={`h-3 w-3 ${feedbackMap[item.id] === "like" ? "fill-current" : ""}`} />
          </button>
          <button onClick={() => onFeedback(item.id, "dislike")} className={`p-1.5 rounded-full transition-all ${feedbackMap[item.id] === "dislike" ? "text-destructive/60 bg-destructive/10" : "text-foreground/25 hover:text-foreground/40"}`}>
            <HeartOff className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className="text-[10px] leading-[1.6] text-foreground/40">{item.reason}</p>
    </div>
  </motion.div>
);

export default DiscoverPage;
