import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark, SlidersHorizontal, ChevronDown, X, Wand2 } from "lucide-react";
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

// Client-side result cache
const resultCache = new Map<string, { data: AIRecommendation[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(action: string, params: Record<string, any>): string {
  return `${action}:${JSON.stringify(params)}`;
}

function getCachedResult(key: string): AIRecommendation[] | null {
  const entry = resultCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) resultCache.delete(key);
  return null;
}

// Fast DB-first load: fetch cached products directly from product_cache table
async function loadCachedProductsFromDB(opts: {
  category?: string;
  subcategory?: string;
  styles?: string[];
  fit?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}): Promise<AIRecommendation[]> {
  let query = supabase
    .from("product_cache")
    .select("*")
    .eq("image_valid", true)
    .eq("is_active", true)
    .order("trend_score", { ascending: false })
    .range(opts.offset || 0, (opts.offset || 0) + (opts.limit || 12) - 1);

  if (opts.category) query = query.eq("category", opts.category);
  if (opts.subcategory) query = query.eq("subcategory", opts.subcategory);
  if (opts.fit) query = query.eq("fit", opts.fit);
  if (opts.styles?.length) query = query.overlaps("style_tags", opts.styles);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((p: any) => p.image_url && p.image_url.startsWith("http"))
    .map((p: any) => ({
      id: p.external_id || p.id,
      name: p.name,
      brand: p.brand || "",
      price: p.price || "",
      category: p.category || "",
      reason: p.reason || "From your curated collection",
      style_tags: p.style_tags || [],
      color: (p.color_tags || [])[0] || "",
      fit: p.fit || "regular",
      image_url: p.image_url,
      source_url: p.source_url,
      store_name: p.store_name,
    }));
}

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
  const [preferenceMode, setPreferenceMode] = useState(false);
  const [newStyleRecs, setNewStyleRecs] = useState<AIRecommendation[]>([]);
  const [loadingNewStyle, setLoadingNewStyle] = useState(false);
  const [userStyleProfile, setUserStyleProfile] = useState<any>(null);
  const [dbOffset, setDbOffset] = useState(0);
  const [hasMoreInDB, setHasMoreInDB] = useState(true);
  const lastPromptRef = useRef("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

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

  const activeTabData = browseTabs.find(t => t.slug === activeTab);
  const subcategories = activeTabData?.children || [];

  const searchSuggestionResults = useMemo(() => {
    if (!textInput.trim() || textInput.trim().length < 2) return [];
    return generateSuggestions(textInput).suggestions;
  }, [textInput]);

  // ── INSTANT INITIAL LOAD: Show cached products from DB immediately ──
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadInitial = async () => {
      setIsGenerating(true);
      setHasGenerated(true);
      const cached = await loadCachedProductsFromDB({ limit: 12 });
      if (cached.length > 0) {
        setRecommendations(cached);
        setDbOffset(cached.length);
        setHasMoreInDB(cached.length >= 12);
        setIsGenerating(false);
      } else {
        // No cached products — fall back to AI
        setIsGenerating(false);
        generateRecommendations("Recommend trending fashion items");
      }
    };
    if (!moodParam) loadInitial();
  }, []);

  useEffect(() => {
    if (moodParam && !hasGenerated) generateRecommendations(moodParam);
  }, [moodParam]);

  useEffect(() => {
    if (user) {
      loadSavedIds();
      loadStyleProfile();
    }
  }, [user]);

  const loadStyleProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle();
    setUserStyleProfile(data);
  };

  useEffect(() => {
    if (activeTab !== "for-you" && activeTab !== "featured") {
      browseCategory(activeTab, activeSubcategory);
    }
  }, [activeTab, activeSubcategory]);

  const loadSavedIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_items").select("product_id").eq("user_id", user.id);
    setSavedIds(new Set((data || []).map(d => d.product_id)));
  };

  // DB-first browse with client cache
  const browseCategory = async (category: string, subcategory: string | null) => {
    const cacheKey = getCacheKey("browse", { category, subcategory, styles: selectedStyles, fit: selectedFit });
    const cached = getCachedResult(cacheKey);
    if (cached) {
      setRecommendations(cached);
      setHasGenerated(true);
      return;
    }

    if (inflightRef.current === cacheKey) return;
    inflightRef.current = cacheKey;

    setIsGenerating(true);
    setHasGenerated(true);
    setRecommendations([]);
    setDbOffset(0);
    lastPromptRef.current = `Browse ${category}`;

    try {
      // Try DB first
      const dbResults = await loadCachedProductsFromDB({
        category,
        subcategory: subcategory || undefined,
        styles: selectedStyles.length > 0 ? selectedStyles : undefined,
        fit: selectedFit || undefined,
        limit: 12,
      });

      if (dbResults.length >= 4) {
        setRecommendations(dbResults);
        setDbOffset(dbResults.length);
        setHasMoreInDB(dbResults.length >= 12);
        resultCache.set(cacheKey, { data: dbResults, ts: Date.now() });
        setIsGenerating(false);
        inflightRef.current = null;
        return;
      }

      // Fall back to AI
      const sub = subcategory ? ` — ${subcategory}` : "";
      await generateRecommendations(`Show me ${category}${sub} items`, undefined, category);
    } catch {
      setIsGenerating(false);
    }
    inflightRef.current = null;
  };

  const handleQuizComplete = async (answers: StyleQuizAnswers) => {
    setQuizAnswers(answers);
    setShowQuiz(false);
    const prompt = buildPromptFromQuiz(answers);
    generateRecommendations(prompt, answers);

    // Persist quiz answers to style_profiles if logged in
    if (user) {
      try {
        await supabase.from("style_profiles").upsert({
          user_id: user.id,
          preferred_styles: answers.preferredStyles,
          disliked_styles: answers.dislikedStyles,
          preferred_fit: answers.fitPreference || null,
          budget: answers.budgetRange || null,
          occasions: answers.occasionPreference,
          favorite_brands: answers.brandFamiliarity.filter(b => b !== "None"),
        } as any, { onConflict: "user_id" });
      } catch (err) {
        console.error("Failed to save quiz answers:", err);
      }
    }
  };

  const buildPromptFromQuiz = (a: StyleQuizAnswers): string => {
    const parts: string[] = [];
    if (a.preferredStyles.length) parts.push(`Style: ${a.preferredStyles.join(", ")}`);
    if (a.fitPreference) parts.push(`Fit: ${a.fitPreference}`);
    if (a.colorPreference) parts.push(`Colors: ${a.colorPreference}`);
    if (a.dailyVibe) parts.push(`Vibe: ${a.dailyVibe}`);
    if (a.occasionPreference?.length) parts.push(`Occasion: ${a.occasionPreference.join(", ")}`);
    if (a.budgetRange) parts.push(`Budget: ${a.budgetRange}`);
    if (a.dislikedStyles.length) parts.push(`Avoid: ${a.dislikedStyles.join(", ")}`);
    return parts.join(". ");
  };

  const generateRecommendations = async (prompt: string, quiz?: StyleQuizAnswers, categoryFilter?: string) => {
    const cacheKey = getCacheKey("recommend", { prompt, category: categoryFilter, styles: selectedStyles, fit: selectedFit, color: selectedColor });
    const cached = getCachedResult(cacheKey);
    if (cached) {
      setRecommendations(cached);
      setHasGenerated(true);
      setIsGenerating(false);
      return;
    }

    if (inflightRef.current === cacheKey) return;
    inflightRef.current = cacheKey;

    setIsGenerating(true);
    setHasGenerated(true);
    setDbOffset(0);
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
          isSearch: true,
          category: categoryFilter || undefined,
          subcategory: activeSubcategory || undefined,
          styles: selectedStyles.length > 0 ? selectedStyles : undefined,
          fit: selectedFit || undefined,
        },
      });
      if (error) throw error;
      const recs = (data?.recommendations || []).filter((r: AIRecommendation) => {
        if (!r.image_url || !r.image_url.startsWith("http")) return false;
        return true;
      });
      setRecommendations(recs);
      setDbOffset(recs.length);
      resultCache.set(cacheKey, { data: recs, ts: Date.now() });
    } catch (e: any) {
      console.error("Recommendation error:", e);
      if (e?.message?.includes("Rate limited") || e?.status === 429) {
        toast.error("Too many requests — please wait a moment.");
      } else if (e?.message?.includes("credits") || e?.status === 402) {
        toast.error("AI credits exhausted. Please add funds.");
      }
    } finally {
      setIsGenerating(false);
      inflightRef.current = null;
    }
  };

  // ── LOAD MORE: First try DB pagination, then AI ──
  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const existingIds = new Set(recommendations.map(r => r.id));

      // Try loading more from DB cache first
      if (hasMoreInDB) {
        const category = activeTab !== "for-you" && activeTab !== "featured" ? activeTab : undefined;
        const dbMore = await loadCachedProductsFromDB({
          category,
          subcategory: activeSubcategory || undefined,
          styles: selectedStyles.length > 0 ? selectedStyles : undefined,
          fit: selectedFit || undefined,
          limit: 8,
          offset: dbOffset,
        });

        const newFromDB = dbMore.filter(r => !existingIds.has(r.id));
        if (newFromDB.length > 0) {
          setRecommendations(prev => [...prev, ...newFromDB]);
          setDbOffset(prev => prev + newFromDB.length);
          setHasMoreInDB(dbMore.length >= 8);
          setIsLoadingMore(false);
          return;
        }
        setHasMoreInDB(false);
      }

      // Fall back to AI for more
      const prompt = lastPromptRef.current || `Show me more ${activeTab === "for-you" ? "fashion" : activeTab} items`;
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt: `${prompt}. Show completely different items, different brands, different styles.`,
          quizAnswers,
          userId: user?.id || null,
          source: sourceParam || "discover",
          count: 6,
          excludeIds: Array.from(existingIds),
        },
      });
      if (error) throw error;
      const newRecs = (data?.recommendations || []).filter(
        (r: AIRecommendation) => !existingIds.has(r.id) && r.image_url && r.image_url.startsWith("http")
      );
      if (newRecs.length > 0) {
        setRecommendations(prev => [...prev, ...newRecs]);
      } else {
        toast("No more items to show right now");
      }
    } catch (e) {
      console.error("Load more error:", e);
      toast.error("Failed to load more items");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Debounced search submit
  const handleTextSubmit = (query?: string) => {
    const q = (query || textInput).trim();
    if (!q) return;
    setTextInput(q);
    setActiveTab("for-you");
    setActiveSubcategory(null);
    setShowSuggestions(false);
    setRecommendations([]);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      generateRecommendations(q);
    }, 150);
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

  const generateNewStyleRecs = async () => {
    if (loadingNewStyle) return;
    setLoadingNewStyle(true);
    try {
      const styleContext = userStyleProfile
        ? `User prefers: ${userStyleProfile.preferred_styles?.join(", ") || "various"}. Fit: ${userStyleProfile.preferred_fit || "regular"}. Budget: ${userStyleProfile.budget || "mid-range"}. Suggest something NEW and outside their comfort zone but still tasteful. Use brands they have NOT seen before.`
        : "Suggest trendy, fresh fashion items the user hasn't explored yet. Use diverse, unexpected brands.";

      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt: `${styleContext} Show unique, unexpected styles that expand their wardrobe. CRITICAL: use completely different brands from mainstream defaults.`,
          userId: user?.id || null,
          source: "discover-new-style",
          count: 4,
          isSearch: true,
        },
      });
      if (error) throw error;
      const recs = (data?.recommendations || []).filter(
        (r: AIRecommendation) => r.image_url && r.image_url.startsWith("http")
      );
      setNewStyleRecs(recs);
    } catch (e) {
      console.error("New style recs error:", e);
    } finally {
      setLoadingNewStyle(false);
    }
  };

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
            <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70">{t("discover").toUpperCase()}</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-6 pt-6 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {/* Search with suggestions */}
          <div className="relative">
            <div className="flex items-center gap-3 pb-4">
              <Search className="h-4 w-4 text-foreground/75 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={textInput}
                onChange={e => { setTextInput(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
                placeholder={t("describeStyle")}
                className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-foreground/75"
              />
              {textInput.trim() && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setTextInput(""); setShowSuggestions(false); }} className="text-foreground/70 hover:text-foreground/75">
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
                      <p className="px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-foreground/70">{t("suggestions").toUpperCase()}</p>
                      {searchSuggestionResults.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleTextSubmit(suggestion)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/75 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/80"
                        >
                          <Search className="h-3 w-3 text-foreground/70 shrink-0" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2">
                      <p className="px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-foreground/70">{t("trending").toUpperCase()}</p>
                      {TRENDING_SEARCHES.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => handleTextSubmit(term)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/70"
                        >
                          <Sparkles className="h-3 w-3 text-accent/60 shrink-0" />
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

          {/* Category Tabs */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {browseTabs.map(tab => (
              <button
                key={tab.slug}
                onClick={() => { setActiveTab(tab.slug); setActiveSubcategory(null); }}
                className={`hover-burgundy shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.05em] transition-all ${
                  activeTab === tab.slug
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground/75"
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
                      !activeSubcategory ? "bg-foreground/[0.08] text-foreground/70" : "text-foreground/70 hover:text-foreground/70"
                    }`}
                  >
                    All
                  </button>
                  {subcategories.map(sub => (
                    <button
                      key={sub.slug}
                      onClick={() => setActiveSubcategory(sub.slug)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                        activeSubcategory === sub.slug ? "bg-foreground/[0.08] text-foreground/70" : "text-foreground/70 hover:text-foreground/70"
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
              className="hover-burgundy flex items-center gap-2 rounded-full border border-border/30 px-4 py-2 text-[11px] font-semibold text-foreground/65"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent/70" />
              {quizAnswers ? t("refine") : t("takeStyleQuiz")}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`hover-burgundy flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition-all ${
                showFilters || hasActiveFilters ? "border-accent/30 text-foreground/75" : "border-border/30 text-foreground/65"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("filters")}
              {hasActiveFilters && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                  {selectedStyles.length + (selectedFit ? 1 : 0) + (selectedColor ? 1 : 0)}
                </span>
              )}
            </button>
            {(quizAnswers || hasActiveFilters) && (
              <button
                onClick={() => { setQuizAnswers(null); clearFilters(); setRecommendations([]); setHasGenerated(false); setTextInput(""); }}
                className="hover-burgundy text-[10px] tracking-[0.15em] text-foreground/70"
              >
                {t("reset").toUpperCase()}
              </button>
            )}
            {user && userStyleProfile && (
              <button
                onClick={() => {
                  setPreferenceMode(!preferenceMode);
                  if (!preferenceMode && userStyleProfile) {
                    const styles = userStyleProfile.preferred_styles || [];
                    setSelectedStyles(styles.filter((s: string) => STYLE_FILTERS.includes(s)));
                    if (userStyleProfile.preferred_fit) setSelectedFit(userStyleProfile.preferred_fit);
                    const prompt = `Items matching my style: ${styles.join(", ")}. Fit: ${userStyleProfile.preferred_fit || "regular"}`;
                    generateRecommendations(prompt);
                  } else {
                    clearFilters();
                  }
                }}
                className={`hover-burgundy flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-semibold transition-all ${
                  preferenceMode ? "border-accent/30 bg-accent/[0.06] text-accent/70" : "border-border/30 text-foreground/75"
                }`}
              >
                <Heart className="h-3 w-3" />
                {t("myPreferences")}
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
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-foreground/75 mb-2">{t("style").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_FILTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleStyle(s)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedStyles.includes(s)
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/75 hover:text-foreground/70"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-foreground/75 mb-2">{t("preferredFit").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {FIT_FILTERS.map(f => (
                        <button
                          key={f}
                          onClick={() => setSelectedFit(selectedFit === f ? null : f)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedFit === f
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/75 hover:text-foreground/70"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-foreground/75 mb-2">{t("color").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_FILTERS.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedColor === c
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/75 hover:text-foreground/70"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/20 pt-3">
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-[10px] text-foreground/70 hover:text-foreground/70">
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
                      <p className="text-[10px] text-foreground/75 mt-1">{t("adaptingTaste")}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground/70">{recommendations.length} {t("items")}</span>
                </div>

                {Object.keys(groupedRecs).length > 1 ? (
                  Object.entries(groupedRecs).map(([category, items]) => (
                    <div key={category} className="space-y-4">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/65 uppercase">
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
                    className="hover-burgundy flex items-center gap-2 rounded-lg border border-border/30 px-6 py-3 text-[11px] font-semibold tracking-[0.15em] text-foreground/65 transition-all hover:border-accent/30 hover:bg-accent/[0.04] disabled:opacity-40"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {isLoadingMore ? t("loading").toUpperCase() : t("loadMore").toUpperCase()}
                  </button>
                </div>

                {/* AI Recommendation: New Style */}
                {user && (
                  <div className="space-y-5 border-t border-border/15 pt-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-3.5 w-3.5 text-accent/70" />
                        <p className="text-[10px] font-semibold tracking-[0.25em] text-accent/60">
                          {t("newStyleYouMightLike").toUpperCase()}
                        </p>
                      </div>
                      <button
                        onClick={generateNewStyleRecs}
                        disabled={loadingNewStyle}
                        className="hover-burgundy flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.04] px-4 py-2 text-[11px] font-semibold tracking-[0.15em] text-accent/60 transition-all hover:bg-accent/[0.08] disabled:opacity-40"
                      >
                        {loadingNewStyle ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {t("tryNewStyle").toUpperCase()}
                      </button>
                    </div>

                    {newStyleRecs.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                        {newStyleRecs.map((item, i) => (
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
                )}
              </div>
            ) : hasGenerated ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="h-6 w-6 text-accent/25 mb-4" />
                <p className="text-[12px] text-foreground/75">No results found</p>
                <p className="text-[10px] text-foreground/70 mt-1">Try a different search or style</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="h-8 w-8 text-accent/15 mb-4" />
                <p className="text-[12px] text-foreground/70">{t("describeStyle")}</p>
                <p className="text-[10px] text-foreground/70 mt-1">Search or browse to discover items</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAuthHint && (
        <AuthGate action="save items">
          <div />
        </AuthGate>
      )}
    </>
  );
};

// ─── Product Card Component ───

interface RecommendationCardProps {
  item: AIRecommendation;
  index: number;
  feedbackMap: Record<string, "like" | "dislike">;
  savedIds: Set<string>;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
}

const RecommendationCard = ({ item, index, feedbackMap, savedIds, onFeedback, onSave }: RecommendationCardProps) => {
  const feedback = feedbackMap[item.id];
  const isSaved = savedIds.has(item.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
      className="group"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.03]">
        <SafeImage
          src={item.image_url || ""}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading={index < 4 ? "eager" : "lazy"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 transition-all group-hover:opacity-100">
          <button
            onClick={() => onFeedback(item.id, "like")}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "like" ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Heart className="h-3 w-3" fill={feedback === "like" ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => onFeedback(item.id, "dislike")}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "dislike" ? "bg-red-500/30 text-red-400" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <HeartOff className="h-3 w-3" />
          </button>
          <button
            onClick={() => onSave(item.id)}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isSaved ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Bookmark className="h-3 w-3" fill={isSaved ? "currentColor" : "none"} />
          </button>
          <ShareButton
            title={`${item.name} by ${item.brand}`}
            url={item.source_url || window.location.href}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-md hover:text-white"
          />
        </div>
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60"
          >
            SHOP →
          </a>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <p className="text-[11px] font-medium tracking-[0.1em] text-foreground/75">{item.brand}</p>
        <p className="text-[12px] font-medium text-foreground/70 leading-tight line-clamp-2">{item.name}</p>
        <p className="text-[11px] font-semibold text-foreground/70">{item.price}</p>
        {item.store_name && (
          <p className="text-[10px] text-foreground/70">{item.store_name}</p>
        )}
      </div>
    </motion.div>
  );
};

export default DiscoverPage;
