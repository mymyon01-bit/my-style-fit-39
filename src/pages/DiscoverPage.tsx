import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import PreferenceBanner from "@/components/PreferenceBanner";
import FreshnessPill from "@/components/FreshnessPill";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import { AuthGate } from "@/components/AuthGate";
import { toast } from "sonner";
import { useCategories } from "@/hooks/useCategories";
import { generateSuggestions, TRENDING_SEARCHES } from "@/lib/searchSuggestions";
import { recordEvent } from "@/lib/diagnostics";
import { loadDbSeenKeys } from "@/lib/search/discovery-cache";
import {
  buildDiscoverGridDiagnostics,
  buildDiscoverRenderables,
  composeDiscoverGrid,
  type DiscoverRenderableProduct,
} from "@/lib/search/discover-feed";
import { runSearch } from "@/lib/search/search-runner";
import { createSearchSession, type SearchSession } from "@/lib/search/search-session";

const STYLE_FILTERS = ["minimal", "street", "classic", "casual", "formal", "vintage"];
const FIT_FILTERS = ["oversized", "regular", "slim"];
const PAGE_SIZE = 24;

type CategoryTab = { slug: string; label: string; children?: { slug: string; label: string }[] };

type DetailItem = {
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
  platform?: string | null;
};

function toDetailItem(item: DiscoverRenderableProduct | null): DetailItem | null {
  if (!item) return null;
  return {
    id: item.id,
    name: item.title,
    brand: item.brand || "",
    price: item.price || "",
    category: item.category || "",
    reason: item.reason || "Freshly ranked for your search",
    style_tags: item.styleTags || [],
    color: item.color || "",
    fit: item.fit || "regular",
    image_url: item.imageUrl,
    source_url: item.externalUrl,
    store_name: item.storeName,
    platform: item.platform,
  };
}

function buildQuery(base: string, opts: { subcategory?: string | null; styles?: string[]; fit?: string | null; quiz?: StyleQuizAnswers | null }) {
  const parts = [base.trim()];
  if (opts.subcategory) parts.push(opts.subcategory);
  if (opts.styles?.length) parts.push(opts.styles.slice(0, 2).join(" "));
  if (opts.fit) parts.push(opts.fit);
  if (opts.quiz?.preferredStyles?.length) parts.push(opts.quiz.preferredStyles.slice(0, 2).join(" "));
  return parts.filter(Boolean).join(" ").trim();
}

function toCardMeta(item: DiscoverRenderableProduct) {
  return {
    product_id: item.id,
    title: item.title,
    source: item.sourceKey,
    source_domain: item.sourceDomain,
    created_at: item.createdAt || null,
    freshness_score: Number(item.freshnessScore.toFixed(3)),
    query_family: item.queryFamily,
    origin: item.origin,
  };
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const moodParam = searchParams.get("mood");
  const { tree: categoryTree } = useCategories();

  const [activeTab, setActiveTab] = useState("for-you");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [textInput, setTextInput] = useState(moodParam || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedFit, setSelectedFit] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [showAuthHint, setShowAuthHint] = useState(false);
  const [detailProduct, setDetailProduct] = useState<DiscoverRenderableProduct | null>(null);
  const [allResults, setAllResults] = useState<DiscoverRenderableProduct[]>([]);
  const [visibleResults, setVisibleResults] = useState<DiscoverRenderableProduct[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Loading fresh inventory…");
  const [freshFlash, setFreshFlash] = useState<{ count: number; label: string } | null>(null);
  const [dbSeen, setDbSeen] = useState<Set<string>>(new Set());
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);

  const sessionRef = useRef<SearchSession | null>(null);
  const searchRunRef = useRef(0);
  const gridSignatureRef = useRef("");

  const browseTabs = useMemo<CategoryTab[]>(() => {
    const base: CategoryTab[] = [{ slug: "for-you", label: t("forYou") || "For You" }];
    categoryTree.forEach((cat) => {
      base.push({
        slug: cat.slug,
        label: cat.name,
        children: cat.children?.map((child) => ({ slug: child.slug, label: child.name })) || [],
      });
    });
    if (!base.find((tab) => tab.slug === "featured")) base.push({ slug: "featured", label: t("new") || "New" });
    return base;
  }, [categoryTree, t]);

  const activeTabData = browseTabs.find((tab) => tab.slug === activeTab);
  const suggestionResults = useMemo(() => {
    if (!textInput.trim() || textInput.trim().length < 2) return [];
    return generateSuggestions(textInput).suggestions;
  }, [textInput]);

  const needsPreferences = !quizAnswers;
  const hasActiveFilters = selectedStyles.length > 0 || selectedFit !== null;

  const loadSavedIds = useCallback(async () => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    const { data } = await supabase.from("saved_items").select("product_id").eq("user_id", user.id);
    setSavedIds(new Set((data || []).map((row) => row.product_id)));
  }, [user]);

  useEffect(() => {
    void loadSavedIds();
  }, [loadSavedIds]);

  const applySessionToGrid = useCallback(
    (session: SearchSession, dbSeenSet: Set<string>, requestedDisplayCount: number) => {
      const renderables = buildDiscoverRenderables(session, dbSeenSet);
      const composed = composeDiscoverGrid(renderables, { windowSize: PAGE_SIZE, minFreshRatio: 0.4 });
      const nextVisible = composed.slice(0, requestedDisplayCount);
      setAllResults(composed);
      setVisibleResults(nextVisible);
      const summary = buildDiscoverGridDiagnostics(session, renderables, nextVisible);
      setDiagnostics({
        query: session.query,
        ...summary,
      });
      setLiveStatus(
        session.status === "complete"
          ? `Updated with ${summary.totalRenderedFresh} fresh / unseen products`
          : `Adding fresh items from more stores… ${summary.totalFreshFetched} live candidates so far`,
      );
      setHasGenerated(true);
      setIsSearching(session.status !== "complete");
    },
    [],
  );

  const runDiscover = useCallback(
    async (baseQuery: string) => {
      const query = buildQuery(baseQuery, {
        subcategory: activeSubcategory,
        styles: selectedStyles,
        fit: selectedFit,
        quiz: quizAnswers,
      });
      if (!query) return;

      const runId = Date.now();
      searchRunRef.current = runId;
      setDisplayCount(PAGE_SIZE);
      setHasGenerated(true);
      setIsSearching(true);
      setLiveStatus("Loading fresh inventory…");
      setFreshFlash(null);
      const session = createSearchSession(query);
      sessionRef.current = session;

      void loadDbSeenKeys().then((keys) => {
        if (searchRunRef.current !== runId) return;
        setDbSeen(keys);
        if (sessionRef.current) applySessionToGrid(sessionRef.current, keys, PAGE_SIZE);
      });

      try {
        await runSearch(session, {
          target: 60,
          maxCycles: 4,
          onProgress: (nextSession) => {
            if (searchRunRef.current !== runId) return;
            sessionRef.current = nextSession;
            applySessionToGrid(nextSession, dbSeen, PAGE_SIZE);
          },
        });
        if (searchRunRef.current !== runId) return;
        sessionRef.current = session;
        applySessionToGrid(session, dbSeen, PAGE_SIZE);
      } catch (error) {
        if (searchRunRef.current !== runId) return;
        console.error("[discover] search failed", error);
        setIsSearching(false);
        setLiveStatus("Fresh discovery failed — showing the best cached matches available.");
      }
    },
    [activeSubcategory, applySessionToGrid, dbSeen, quizAnswers, selectedFit, selectedStyles],
  );

  useEffect(() => {
    if (moodParam) {
      void runDiscover(moodParam);
      return;
    }
    void runDiscover(activeTab === "for-you" ? "new arrivals" : activeTabData?.label || "new arrivals");
  }, []);

  useEffect(() => {
    if (!hasGenerated) return;
    if (activeTab === "for-you") return;
    void runDiscover(activeSubcategory || activeTabData?.label || activeTab);
  }, [activeSubcategory, activeTab]);

  useEffect(() => {
    const nextVisible = allResults.slice(0, displayCount);
    setVisibleResults(nextVisible);
  }, [allResults, displayCount]);

  useEffect(() => {
    if (visibleResults.length === 0 || !sessionRef.current) return;
    const signature = `${sessionRef.current.query}:${visibleResults.slice(0, PAGE_SIZE).map((item) => item.id).join(",")}`;
    if (gridSignatureRef.current === signature) return;
    gridSignatureRef.current = signature;

    const previousIds = new Set(allResults.slice(0, displayCount).map((item) => item.id));
    const newlyVisible = visibleResults.filter((item) => item.isUnseen && item.isFresh && !previousIds.has(item.id));
    if (newlyVisible.length > 0) {
      setFreshFlash({ count: newlyVisible.length, label: "New arrivals just added" });
      window.setTimeout(() => setFreshFlash(null), 3000);
    }

    const firstGrid = visibleResults.slice(0, PAGE_SIZE).map(toCardMeta);
    console.table(firstGrid);

    const summary = diagnostics || {};
    recordEvent({
      event_name: "discover_grid_render",
      status: visibleResults.length > 0 ? "success" : "partial",
      metadata: {
        query: sessionRef.current.query,
        total_new_products_fetched_session: summary.totalFreshFetched,
        total_inserted_into_db: summary.totalInsertedToDb,
        total_eligible_for_current_query: summary.totalEligible,
        total_rejected_by_dedupe: summary.totalRejectedByDedupe,
        total_rejected_by_seen_filter: summary.totalRejectedBySeen,
        total_rejected_by_db_seen_filter: summary.totalRejectedByDbSeen,
        total_rejected_by_category_filter: summary.totalRejectedByCategory,
        first_row_changed_count: summary.firstRowChangedCount,
        final_rendered_product_ids: visibleResults.slice(0, PAGE_SIZE).map((item) => item.id),
        fresh_rendered_count: visibleResults.filter((item) => item.isUnseen && item.isFresh).length,
      },
    });
  }, [allResults, diagnostics, displayCount, visibleResults]);

  const handleSubmit = useCallback((query?: string) => {
    const next = (query || textInput).trim();
    if (!next) return;
    setShowSuggestions(false);
    setTextInput(next);
    setActiveTab("for-you");
    setActiveSubcategory(null);
    void runDiscover(next);
  }, [runDiscover, textInput]);

  const handleLoadMore = useCallback(() => {
    setDisplayCount((count) => Math.min(count + PAGE_SIZE, allResults.length));
  }, [allResults.length]);

  const handleSave = useCallback(async (itemId: string) => {
    if (!user) {
      setShowAuthHint(true);
      return;
    }
    if (savedIds.has(itemId)) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      await supabase.from("saved_items").delete().eq("user_id", user.id).eq("product_id", itemId);
      return;
    }
    setSavedIds((prev) => new Set(prev).add(itemId));
    await supabase.from("saved_items").insert({ user_id: user.id, product_id: itemId });
  }, [savedIds, user]);

  const handleFeedback = useCallback(async (itemId: string, type: "like" | "dislike") => {
    setFeedbackMap((prev) => {
      const current = prev[itemId];
      if (current === type) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: type };
    });
    if (!user) return;
    await supabase.from("interactions").insert({
      user_id: user.id,
      target_id: itemId,
      target_type: "product",
      event_type: type,
      metadata: { source: "discover" },
    });
  }, [user]);

  const clearFilters = useCallback(() => {
    setSelectedStyles([]);
    setSelectedFit(null);
  }, []);

  const handleQuizComplete = useCallback((answers: StyleQuizAnswers) => {
    setQuizAnswers(answers);
    setShowQuiz(false);
    void runDiscover(textInput.trim() || "new arrivals");
  }, [runDiscover, textInput]);

  return (
    <>
      <AnimatePresence>
        {showQuiz && <StyleQuiz onComplete={handleQuizComplete} onClose={() => setShowQuiz(false)} />}
      </AnimatePresence>

      <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
        <div className="mx-auto max-w-lg px-6 pt-10 pb-2 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[12px] font-semibold tracking-[0.35em] text-foreground/70 lg:hidden">WARDROBE</span>
            <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70">{t("discover").toUpperCase()}</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-6 pt-6 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {needsPreferences && (
            <div className="mb-6">
              <PreferenceBanner onOpenQuiz={() => setShowQuiz(true)} />
            </div>
          )}

          <div className="relative">
            <div className="flex items-center gap-3 pb-4">
              <Search className="h-4 w-4 shrink-0 text-foreground/75" />
              <input
                type="text"
                value={textInput}
                onChange={(event) => {
                  setTextInput(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(event) => event.key === "Enter" && handleSubmit()}
                placeholder={t("describeStyle")}
                className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-foreground/75"
              />
              {textInput.trim() && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setTextInput("")} className="text-foreground/70 hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleSubmit()} className="hover-burgundy text-[10px] font-semibold tracking-[0.15em] text-accent/70">GO</button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-30 overflow-hidden rounded-xl border border-border/20 bg-card/95 shadow-elevated backdrop-blur-xl"
                >
                  <div className="py-2">
                    <p className="px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-foreground/70">
                      {(suggestionResults.length > 0 ? t("suggestions") : t("trending")).toUpperCase()}
                    </p>
                    {(suggestionResults.length > 0 ? suggestionResults : TRENDING_SEARCHES).map((term, index) => (
                      <button
                        key={`${term}-${index}`}
                        onClick={() => handleSubmit(term)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/75 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                      >
                        <Sparkles className="h-3 w-3 shrink-0 text-accent/60" />
                        {term}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {showSuggestions && <div className="fixed inset-0 z-20" onClick={() => setShowSuggestions(false)} />}
          <div className="h-px bg-border/30" />

          <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {browseTabs.map((tab) => (
              <button
                key={tab.slug}
                onClick={() => {
                  setActiveTab(tab.slug);
                  setActiveSubcategory(null);
                }}
                className={`hover-burgundy shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.05em] transition-all ${
                  activeTab === tab.slug ? "bg-accent/15 text-foreground" : "text-foreground/75"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {activeTabData?.children && activeTabData.children.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-2 scrollbar-hide">
                  <button
                    onClick={() => setActiveSubcategory(null)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                      !activeSubcategory ? "bg-foreground/[0.08] text-foreground" : "text-foreground/70"
                    }`}
                  >
                    All
                  </button>
                  {activeTabData.children.map((sub) => (
                    <button
                      key={sub.slug}
                      onClick={() => setActiveSubcategory(sub.label)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                        activeSubcategory === sub.label ? "bg-foreground/[0.08] text-foreground" : "text-foreground/70"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => setShowQuiz(true)} className="hover-burgundy flex items-center gap-2 rounded-full border border-border/30 px-4 py-2 text-[11px] font-semibold text-foreground/65">
              <Sparkles className="h-3.5 w-3.5 text-accent/70" />
              {quizAnswers ? t("refine") : t("takeStyleQuiz")}
            </button>
            <button
              onClick={() => setShowFilters((value) => !value)}
              className={`hover-burgundy flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition-all ${
                showFilters || hasActiveFilters ? "border-accent/30 text-foreground/75" : "border-border/30 text-foreground/65"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("filters")}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[10px] tracking-[0.15em] text-foreground/70">{t("reset").toUpperCase()}</button>
            )}
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 space-y-4 rounded-xl border border-border/20 bg-card/30 p-4">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-foreground/75">{t("style").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_FILTERS.map((style) => (
                        <button
                          key={style}
                          onClick={() => setSelectedStyles((prev) => prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style])}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedStyles.includes(style) ? "bg-accent/15 text-foreground" : "bg-foreground/[0.03] text-foreground/75"
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-foreground/75">{t("preferredFit").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {FIT_FILTERS.map((fit) => (
                        <button
                          key={fit}
                          onClick={() => setSelectedFit((prev) => prev === fit ? null : fit)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedFit === fit ? "bg-accent/15 text-foreground" : "bg-foreground/[0.03] text-foreground/75"
                          }`}
                        >
                          {fit}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-border/20 pt-3">
                    <button onClick={() => handleSubmit()} className="text-[10px] font-semibold tracking-[0.15em] text-accent/70">
                      {t("applyFilters").toUpperCase()}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">
                  {textInput.trim() ? `RESULTS FOR "${textInput.toUpperCase()}"` : (activeSubcategory || activeTabData?.label || "DISCOVER").toUpperCase()}
                </p>
                <p className="mt-1 text-[10px] text-foreground/55">Freshness-first ranking, live discovery injection, and seen suppression.</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-foreground/60">
                <span>{visibleResults.length} {t("items")}</span>
                {isSearching && <Loader2 className="h-3 w-3 animate-spin text-accent/60" />}
              </div>
            </div>

            <FreshnessPill active={isSearching} />

            <div className="flex items-center gap-2 rounded-lg border border-accent/10 bg-accent/[0.03] px-3 py-2 text-[10px] tracking-[0.12em] text-accent/70" aria-live="polite">
              {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-accent/50" />}
              <span>{liveStatus.toUpperCase()}</span>
            </div>

            <AnimatePresence>
              {freshFlash && (
                <motion.div
                  key={`${freshFlash.label}-${freshFlash.count}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.08] px-3 py-2 text-[10px] font-semibold tracking-[0.18em] text-accent"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>+{freshFlash.count} {freshFlash.label.toUpperCase()}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {hasGenerated && visibleResults.length === 0 && !isSearching ? (
              <div className="rounded-xl border border-border/20 bg-card/30 px-5 py-10 text-center">
                <p className="text-[12px] text-foreground/70">No fresh matches surfaced for that search yet.</p>
                <p className="mt-1 text-[10px] text-foreground/50">Try a broader query or another category while inventory expands.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                {visibleResults.map((item, index) => (
                  <RecommendationCard
                    key={item.id}
                    item={item}
                    index={index}
                    isSaved={savedIds.has(item.id)}
                    feedback={feedbackMap[item.id]}
                    onFeedback={handleFeedback}
                    onOpenDetail={setDetailProduct}
                    onSave={handleSave}
                  />
                ))}
              </div>
            )}

            {displayCount < allResults.length && (
              <div className="flex justify-center pt-2">
                <button onClick={handleLoadMore} className="rounded-full border border-border/30 px-4 py-2 text-[10px] font-semibold tracking-[0.15em] text-foreground/70">
                  LOAD MORE
                </button>
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

      <ProductDetailSheet
        product={toDetailItem(detailProduct)}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        isSaved={detailProduct ? savedIds.has(detailProduct.id) : false}
        onSave={handleSave}
      />
    </>
  );
}

type RecommendationCardProps = {
  item: DiscoverRenderableProduct;
  index: number;
  isSaved: boolean;
  feedback: "like" | "dislike" | undefined;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
  onOpenDetail: (item: DiscoverRenderableProduct) => void;
};

function RecommendationCard({ item, index, isSaved, feedback, onFeedback, onSave, onOpenDetail }: RecommendationCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  if (!item.imageUrl || !item.imageUrl.startsWith("http") || imgFailed) return null;

  const isAboveFold = index < 4;

  return (
    <div className="group cursor-pointer" onClick={() => onOpenDetail(item)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
        {!imgLoaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-foreground/[0.05] to-foreground/[0.02]" aria-hidden />}
        <img
          src={item.imageUrl}
          alt={item.title}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          loading={isAboveFold ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={isAboveFold ? "high" : "low"}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-foreground/75 backdrop-blur-sm">
          {item.sourceKey.toUpperCase()}
        </div>
        {item.isUnseen && item.isFresh && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-accent/90 px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] text-accent-foreground shadow-lg shadow-accent/30">
            <Sparkles className="h-2.5 w-2.5" />
            NEW
          </div>
        )}
        <div className="absolute right-2 top-10 flex flex-col gap-1.5 opacity-0 transition-all group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onFeedback(item.id, "like");
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "like" ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Heart className="h-3 w-3" fill={feedback === "like" ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onFeedback(item.id, "dislike");
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "dislike" ? "bg-destructive/30 text-destructive" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <HeartOff className="h-3 w-3" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onSave(item.id);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isSaved ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Bookmark className="h-3 w-3" fill={isSaved ? "currentColor" : "none"} />
          </button>
        </div>
        {item.externalUrl && (
          <div
            onClick={(event) => {
              event.stopPropagation();
              window.open(item.externalUrl!, "_blank", "noopener,noreferrer");
            }}
            className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/80 opacity-0 transition-opacity group-hover:opacity-100"
          >
            SHOP →
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <p className="text-[11px] font-medium tracking-[0.1em] text-foreground">{item.brand}</p>
        <p className="line-clamp-2 text-[12px] font-medium leading-tight text-foreground/90">{item.title}</p>
        <p className="text-[11px] font-semibold text-foreground">{item.price}</p>
        <p className="text-[10px] text-foreground/60">{item.storeName || item.sourceDomain}</p>
      </div>
    </div>
  );
}
