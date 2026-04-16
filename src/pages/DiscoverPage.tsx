import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import { AuthGate } from "@/components/AuthGate";
import { useCategories } from "@/hooks/useCategories";
import { generateSuggestions, TRENDING_SEARCHES } from "@/lib/searchSuggestions";
import { motion, AnimatePresence } from "framer-motion";
import SafeImage from "@/components/SafeImage";
import ShareButton from "@/components/ShareButton";
import { toast } from "sonner";

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
  image_url?: string | null;
  source_url?: string | null;
  store_name?: string | null;
}

const STYLE_FILTERS = ["minimal", "street", "classic", "edgy", "casual", "formal", "chic", "vintage", "bohemian", "sporty"];
const FIT_FILTERS = ["oversized", "regular", "slim"];
const COLOR_FILTERS = ["neutral", "dark", "earth", "bold", "pastel", "mixed"];

const DiscoverPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moodParam = searchParams.get("mood");
  const sourceParam = searchParams.get("source");
  const { tree: categoryTree } = useCategories();

  const [activeTab, setActiveTab] = useState("for-you");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);
  const [textInput, setTextInput] = useState(moodParam || "");
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showAuthHint, setShowAuthHint] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const lastPromptRef = useRef("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedFit, setSelectedFit] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Build dynamic tabs from DB categories
  const browseTabs = useMemo(() => {
    const tabs: { slug: string; label: string; icon?: typeof Sparkles; children?: { slug: string; label: string }[] }[] = [
      { slug: "for-you", label: t("forYou") || "For You", icon: Sparkles },
    ];
    if (categoryTree.length > 0) {
      categoryTree.forEach(cat => {
        tabs.push({
          slug: cat.slug,
          label: cat.name,
          children: cat.children?.map(c => ({ slug: c.slug, label: c.name })) || [],
        });
      });
    } else {
      // Fallback
      tabs.push(
        { slug: "clothing", label: "Clothing" },
        { slug: "bags", label: "Bags" },
        { slug: "shoes", label: "Shoes" },
        { slug: "accessories", label: "Accessories" },
      );
    }
    tabs.push({ slug: "featured", label: t("new") || "New" });
    return tabs;
  }, [categoryTree, t]);

  // Get subcategories for active tab
  const activeTabData = browseTabs.find(t => t.slug === activeTab);
  const subcategories = activeTabData?.children || [];

  // Search suggestions
  const searchSuggestionResults = useMemo(() => {
    if (!textInput.trim() || textInput.trim().length < 2) return [];
    return generateSuggestions(textInput).suggestions;
  }, [textInput]);

  useEffect(() => {
    if (moodParam && !hasGenerated) generateRecommendations(moodParam);
  }, [moodParam]);

  useEffect(() => {
    if (user) loadSavedIds();
  }, [user]);

  useEffect(() => {
    if (activeTab !== "for-you" && activeTab !== "featured") {
      // DB-first: try browse (cached) first, only AI on search
      browseCategory(activeTab, activeSubcategory);
    }
  }, [activeTab, activeSubcategory]);

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
    setRecommendations([]);
    setShowSuggestions(false);
    lastPromptRef.current = prompt;
    try {
      const filterContext = [];
      if (categoryFilter) filterContext.push(`Category: ${categoryFilter}`);
      if (activeSubcategory) filterContext.push(`Subcategory: ${activeSubcategory}`);
      if (selectedStyles.length) filterContext.push(`Style: ${selectedStyles.join(", ")}`);
      if (selectedFit) filterContext.push(`Fit: ${selectedFit}`);
      if (selectedColor) filterContext.push(`Color palette: ${selectedColor}`);

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
          count: 8,
        },
      });
      if (error) throw error;
      const recs = (data?.recommendations || []).map((r: AIRecommendation) => {
        if (!r.image_url || !r.image_url.startsWith("http")) {
          console.warn(`[WARDROBE] Missing/invalid image for "${r.name}" (${r.id})`);
        }
        return r;
      });
      setRecommendations(recs);
    } catch (e: any) {
      console.error("Recommendation error:", e);
      if (e?.message?.includes("Rate limited") || e?.status === 429) {
        toast.error("Too many requests — please wait a moment.");
      } else if (e?.message?.includes("credits") || e?.status === 402) {
        toast.error("AI credits exhausted. Please add funds.");
      }
      setRecommendations([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const existingIds = recommendations.map(r => r.id);
      const prompt = lastPromptRef.current || `Show me more ${activeTab === "for-you" ? "fashion" : activeTab} items`;

      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt: `${prompt}. Show different items from before.`,
          quizAnswers,
          userId: user?.id || null,
          source: sourceParam || "discover",
          count: 6,
          excludeIds: existingIds,
        },
      });
      if (error) throw error;
      const newRecs = (data?.recommendations || []).filter(
        (r: AIRecommendation) => !existingIds.includes(r.id)
      );
      setRecommendations(prev => [...prev, ...newRecs]);
    } catch (e) {
      console.error("Load more error:", e);
      toast.error("Failed to load more items");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTextSubmit = (query?: string) => {
    const q = (query || textInput).trim();
    if (!q) return;
    setTextInput(q);
    setActiveTab("for-you");
    setActiveSubcategory(null);
    setShowSuggestions(false);
    generateRecommendations(q);
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

  const hasActiveFilters = selectedStyles.length > 0 || selectedFit !== null || selectedColor !== null;

  const clearFilters = () => {
    setSelectedStyles([]);
    setSelectedFit(null);
    setSelectedColor(null);
  };

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
            <span className="font-display text-[12px] font-semibold tracking-[0.35em] text-foreground/70 lg:hidden">WARDROBE</span>
            <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/50">{t("discover").toUpperCase()}</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-6 pt-6 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {/* Search with suggestions */}
          <div className="relative">
            <div className="flex items-center gap-3 pb-4">
              <Search className="h-4 w-4 text-foreground/40 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={textInput}
                onChange={e => { setTextInput(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
                placeholder={t("describeStyle")}
                className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-foreground/35"
              />
              {textInput.trim() && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setTextInput(""); setShowSuggestions(false); }} className="text-foreground/25 hover:text-foreground/40">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleTextSubmit()} className="hover-burgundy text-[10px] font-semibold tracking-[0.15em] text-accent/70">GO</button>
                </div>
              )}
            </div>

            {/* Search suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-30 rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-elevated overflow-hidden"
                >
                  {searchSuggestionResults.length > 0 ? (
                    <div className="py-2">
                      <p className="px-4 py-1.5 text-[9px] font-semibold tracking-[0.2em] text-foreground/30">{t("suggestions").toUpperCase()}</p>
                      {searchSuggestionResults.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleTextSubmit(suggestion)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/60 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/80"
                        >
                          <Search className="h-3 w-3 text-foreground/20 shrink-0" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2">
                      <p className="px-4 py-1.5 text-[9px] font-semibold tracking-[0.2em] text-foreground/30">{t("trending").toUpperCase()}</p>
                      {TRENDING_SEARCHES.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => handleTextSubmit(term)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/50 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/70"
                        >
                          <Sparkles className="h-3 w-3 text-accent/30 shrink-0" />
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Click-away for suggestions */}
          {showSuggestions && (
            <div className="fixed inset-0 z-20" onClick={() => setShowSuggestions(false)} />
          )}

          <div className="h-px bg-border/30" />

          {/* Category Tabs — from DB */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {browseTabs.map(tab => (
              <button
                key={tab.slug}
                onClick={() => { setActiveTab(tab.slug); setActiveSubcategory(null); }}
                className={`hover-burgundy shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.05em] transition-all ${
                  activeTab === tab.slug
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground/35"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Subcategory tabs */}
          <AnimatePresence>
            {subcategories.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-2 scrollbar-hide">
                  <button
                    onClick={() => setActiveSubcategory(null)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                      !activeSubcategory ? "bg-foreground/[0.08] text-foreground/70" : "text-foreground/30 hover:text-foreground/50"
                    }`}
                  >
                    All
                  </button>
                  {subcategories.map(sub => (
                    <button
                      key={sub.slug}
                      onClick={() => setActiveSubcategory(sub.slug)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                        activeSubcategory === sub.slug ? "bg-foreground/[0.08] text-foreground/70" : "text-foreground/30 hover:text-foreground/50"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowQuiz(true)}
              className="hover-burgundy flex items-center gap-2 rounded-full border border-border/30 px-4 py-2 text-[11px] font-semibold text-foreground/45"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent/50" />
              {quizAnswers ? t("refine") : t("takeStyleQuiz")}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`hover-burgundy flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition-all ${
                showFilters || hasActiveFilters ? "border-accent/30 text-foreground/60" : "border-border/30 text-foreground/45"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("filters")}
              {hasActiveFilters && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent">
                  {selectedStyles.length + (selectedFit ? 1 : 0) + (selectedColor ? 1 : 0)}
                </span>
              )}
            </button>
            {(quizAnswers || hasActiveFilters) && (
              <button
                onClick={() => { setQuizAnswers(null); clearFilters(); setRecommendations([]); setHasGenerated(false); setTextInput(""); }}
                className="hover-burgundy text-[10px] tracking-[0.15em] text-foreground/25"
              >
                {t("reset").toUpperCase()}
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
                  {/* Style */}
                  <div>
                    <p className="text-[9px] font-semibold tracking-[0.2em] text-foreground/35 mb-2">{t("style").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_FILTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleStyle(s)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedStyles.includes(s)
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/35 hover:text-foreground/50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Fit */}
                  <div>
                    <p className="text-[9px] font-semibold tracking-[0.2em] text-foreground/35 mb-2">{t("preferredFit").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {FIT_FILTERS.map(f => (
                        <button
                          key={f}
                          onClick={() => setSelectedFit(selectedFit === f ? null : f)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedFit === f
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/35 hover:text-foreground/50"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Color */}
                  <div>
                    <p className="text-[9px] font-semibold tracking-[0.2em] text-foreground/35 mb-2">{t("color").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_FILTERS.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedColor === c
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/35 hover:text-foreground/50"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Apply */}
                  <div className="flex items-center justify-between border-t border-border/20 pt-3">
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-[10px] text-foreground/30 hover:text-foreground/50">
                        {t("clearAll")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const prompt = textInput.trim() || `Recommend ${activeTab === "for-you" ? "fashion" : activeTab} items`;
                        generateRecommendations(prompt, undefined, activeTab !== "for-you" ? activeTab : undefined);
                      }}
                      className="hover-burgundy ml-auto py-2.5 text-[10px] font-semibold tracking-[0.15em] text-accent/60"
                    >
                      {t("applyFilters").toUpperCase()}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Area */}
          <div className="mt-8">
            {isGenerating ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-[3/4] rounded-xl bg-foreground/[0.04]" />
                      <div className="mt-2.5 space-y-1.5 px-0.5">
                        <div className="h-2.5 w-16 rounded bg-foreground/[0.04]" />
                        <div className="h-3 w-24 rounded bg-foreground/[0.04]" />
                        <div className="h-3 w-12 rounded bg-foreground/[0.04]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasGenerated && recommendations.length > 0 ? (
              <div className="space-y-12">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.25em] text-accent/60">
                      {activeTab === "for-you" ? t("curatedForYou").toUpperCase() : activeTab.toUpperCase()}
                    </p>
                    {interactionCount > 2 && (
                      <p className="text-[10px] text-foreground/35 mt-1">{t("adaptingTaste")}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground/25">{recommendations.length} {t("items")}</span>
                </div>

                {/* Grouped display */}
                {Object.keys(groupedRecs).length > 1 ? (
                  Object.entries(groupedRecs).map(([category, items]) => (
                    <div key={category} className="space-y-4">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/45 uppercase">
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

                {/* Load More */}
                <div className="flex justify-center pt-4 pb-8">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="hover-burgundy flex items-center gap-2 rounded-lg border border-border/30 px-6 py-3 text-[11px] font-semibold tracking-[0.15em] text-foreground/45 transition-all hover:border-accent/30 hover:bg-accent/[0.04] disabled:opacity-40"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {isLoadingMore ? t("loading").toUpperCase() : t("loadMore").toUpperCase()}
                  </button>
                </div>
              </div>
            ) : hasGenerated && recommendations.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <p className="text-[14px] font-medium text-foreground/45">{t("noRecommendations")}</p>
                <p className="text-[12px] text-foreground/25 max-w-[260px] mx-auto">
                  {t("tryDifferent")}
                </p>
              </div>
            ) : (
              <div className="py-16 text-center space-y-5">
                <p className="font-display text-lg font-semibold text-foreground/55">{t("discoverStyle")}</p>
                <p className="mx-auto max-w-[280px] text-[12px] leading-[1.8] text-foreground/35">
                  {t("discoverDesc")}
                </p>
                <div className="flex flex-col items-center gap-3">
                  <button onClick={() => setShowQuiz(true)} className="hover-burgundy text-[10px] font-semibold tracking-[0.2em] text-accent/50">
                    {t("takeStyleQuiz").toUpperCase()}
                  </button>
                  <span className="text-[10px] text-foreground/18">{t("orBrowse")}</span>
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
            <div className="rounded-2xl bg-card/95 backdrop-blur-xl p-6 shadow-elevated space-y-4">
              <p className="font-display text-[15px] font-semibold text-foreground/75">
                {t("saveStylePrompt")}
              </p>
              <div className="flex gap-3">
                <button onClick={() => navigate("/auth")} className="hover-burgundy flex-1 py-3 text-[10px] font-semibold tracking-[0.15em] text-foreground/60">
                  {t("createAccount").toUpperCase()}
                </button>
                <div className="w-px bg-border/30" />
                <button onClick={() => setShowAuthHint(false)} className="hover-burgundy px-4 py-3 text-[10px] text-foreground/30">
                  {t("later").toUpperCase()}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Image-first Recommendation Card ───

const RecommendationCard = ({
  item, index, feedbackMap, savedIds, onFeedback, onSave
}: {
  item: AIRecommendation;
  index: number;
  feedbackMap: Record<string, "like" | "dislike">;
  savedIds: Set<string>;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
}) => {
  const hasImage = item.image_url && item.image_url.startsWith("http");

  const handleCardClick = () => {
    if (item.source_url) {
      window.open(item.source_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
      className="group"
    >
      <div
        className={`relative overflow-hidden rounded-xl bg-foreground/[0.03] ${item.source_url ? "cursor-pointer" : ""}`}
        onClick={handleCardClick}
      >
        {hasImage ? (
          <SafeImage
            src={item.image_url!}
            alt={item.name}
            className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            fallbackClassName="aspect-[3/4] w-full"
            loading={index < 4 ? "eager" : "lazy"}
          />
        ) : (
          <div className="aspect-[3/4] w-full flex flex-col items-center justify-center bg-foreground/[0.03]">
            <div
              className="h-12 w-12 rounded-full mb-3 opacity-40"
              style={{ backgroundColor: item.color || "hsl(var(--accent))" }}
            />
            <p className="text-[9px] font-semibold tracking-[0.15em] text-foreground/25 uppercase">{item.category}</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ring-1 ring-accent/20" />

        <div className="absolute right-2 top-2 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
          <AuthGate action="save items">
            <button
              onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all hover:bg-background/90"
            >
              <Bookmark className={`h-3.5 w-3.5 transition-colors ${savedIds.has(item.id) ? "fill-accent text-accent" : "text-foreground/50"}`} />
            </button>
          </AuthGate>
          <ShareButton title={`${item.brand} — ${item.name}`} className="" />
        </div>

        <span className="absolute left-2 top-2 rounded-full bg-background/60 backdrop-blur-md px-2 py-0.5 text-[8px] font-semibold tracking-[0.1em] text-foreground/50 uppercase">
          {item.category}
        </span>

        {item.source_url && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/40 to-transparent pb-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-white/80">
              VIEW ON {(item.store_name || item.brand || "STORE").toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5 space-y-0.5 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">{item.brand}</p>
        <p className="text-[13px] font-semibold leading-snug text-foreground/80 line-clamp-2">{item.name}</p>
        <p className="text-[13px] font-bold text-foreground">{item.price}</p>
      </div>

      <div className="mt-2 flex items-center justify-between px-0.5">
        <div className="flex gap-1 flex-wrap">
          {item.style_tags?.slice(0, 2).map(tag => (
            <span key={tag} className="text-[9px] text-foreground/25">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onFeedback(item.id, "like")} className={`p-1.5 rounded-full transition-all ${feedbackMap[item.id] === "like" ? "text-accent/70 bg-accent/10" : "text-foreground/20 hover:text-foreground/35"}`}>
            <Heart className={`h-3 w-3 ${feedbackMap[item.id] === "like" ? "fill-current" : ""}`} />
          </button>
          <button onClick={() => onFeedback(item.id, "dislike")} className={`p-1.5 rounded-full transition-all ${feedbackMap[item.id] === "dislike" ? "text-destructive/50 bg-destructive/10" : "text-foreground/20 hover:text-foreground/35"}`}>
            <HeartOff className="h-3 w-3" />
          </button>
        </div>
      </div>

      {item.reason && (
        <p className="mt-1.5 px-0.5 text-[10px] leading-[1.5] text-foreground/30 line-clamp-2">{item.reason}</p>
      )}
    </motion.div>
  );
};

export default DiscoverPage;
