import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Search, Sparkles, SlidersHorizontal, X, Plus } from "lucide-react";
import SubmitProductDialog from "@/components/discover/SubmitProductDialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import PreferenceBanner from "@/components/PreferenceBanner";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import { AuthGate } from "@/components/AuthGate";
import { useCategories } from "@/hooks/useCategories";
import { useDbTopGrid } from "@/hooks/useDbTopGrid";
import { useDiscoverSearch } from "@/hooks/useDiscoverSearch";
import { generateSuggestions, TRENDING_SEARCHES } from "@/lib/searchSuggestions";
import { recordEvent } from "@/lib/diagnostics";
import type { DiscoverRenderableProduct } from "@/lib/search/discover-feed";
import type { Product } from "@/lib/search/types";
import DbTopGrid from "@/components/discover/DbTopGrid";
import StyledLooksRow from "@/components/discover/StyledLooksRow";
import LiveResultsSection from "@/components/discover/LiveResultsSection";
import DiscoverAdRow from "@/components/discover/DiscoverAdRow";
import InterpretationBanner from "@/components/discover/InterpretationBanner";
import { genderPreferenceToFilter, type GenderFilter } from "@/lib/discover/genderFilter";
import Brandmark from "@/components/Brandmark";


const STYLE_FILTERS = ["minimal", "street", "classic", "casual", "formal", "vintage"];
const FIT_FILTERS = ["oversized", "regular", "slim"];
const GENDER_FILTERS: { id: GenderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "women", label: "Women" },
  { id: "men", label: "Men" },
];
const PAGE_SIZE = 36;

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

function toDetailFromProduct(item: Product | DiscoverRenderableProduct | null): DetailItem | null {
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

function buildQuery(base: string, opts: { subcategory?: string | null; styles?: string[]; fit?: string | null; quiz?: StyleQuizAnswers | null; brandsInclude?: string[] }) {
  const parts = [base.trim()];
  if (opts.subcategory) parts.push(opts.subcategory);
  if (opts.styles?.length) parts.push(opts.styles.slice(0, 2).join(" "));
  if (opts.fit) parts.push(opts.fit);
  if (opts.quiz?.preferredStyles?.length) parts.push(opts.quiz.preferredStyles.slice(0, 2).join(" "));
  if (opts.brandsInclude?.length) parts.push(opts.brandsInclude.slice(0, 3).join(" "));
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

/**
 * NEW Discover architecture:
 *   Layer 1 — Top DB grid (instant, hardcoded shell, useDbTopGrid)
 *   Layer 2 — Styled Looks (hardcoded shell, composes existing inventory)
 *   Layer 3 — Live results (append-only, runSearch streams onProgress)
 *
 * Sourcing logic (search-runner / discover-feed) is fully decoupled from
 * rendering logic (the three layer components below).
 */
export default function DiscoverPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const moodParam = searchParams.get("mood");
  const productParam = searchParams.get("p");
  const { tree: categoryTree } = useCategories();

  // ── UI state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("for-you");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [textInput, setTextInput] = useState(moodParam || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedFit, setSelectedFit] = useState<string | null>(null);
  // V4.2 — brand multi-select (include / exclude). Persisted to localStorage so
  // user's saved preferred brands survive across sessions.
  const [brandsInclude, setBrandsInclude] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("mymyon:brands:include") || "[]"); } catch { return []; }
  });
  const [brandsExclude, setBrandsExclude] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("mymyon:brands:exclude") || "[]"); } catch { return []; }
  });
  const [brandInput, setBrandInput] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [showAuthHint, setShowAuthHint] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | DiscoverRenderableProduct | null>(null);
  const [deepLinkedProduct, setDeepLinkedProduct] = useState<DetailItem | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [submitOpen, setSubmitOpen] = useState(false);

  // ── Live (Layer 3) state — UI only; search lives in useDiscoverSearch ──
  const [committedQuery, setCommittedQuery] = useState(moodParam || "new arrivals");
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [freshFlash, setFreshFlash] = useState<{ count: number; label: string } | null>(null);
  const gridSignatureRef = useRef("");

  // ── Hook owns: parse → ladder seed → runSearch → compose → diagnostics ─
  const {
    results: allLiveResults,
    diagnostics,
    status: searchStatus,
    intentChips,
    intentFallback,
    ladderStage,
    search: runDiscoverSearch,
    markVisibleSeen,
    appendedCount,
    isRefreshing,
  } = useDiscoverSearch({ windowSize: PAGE_SIZE, minFreshRatio: 0.4, gender: genderFilter });

  const isSearching = searchStatus === "searching" || searchStatus === "partial";
  const liveStatus = useMemo(() => {
    if (isRefreshing) return "Adding fresh products…";
    if (appendedCount > 0 && searchStatus === "complete") {
      return `Loaded more items (+${appendedCount})`;
    }
    if (searchStatus === "complete") {
      const fresh = diagnostics?.totalRenderedFresh ?? 0;
      return fresh > 0 ? `Updated with new products (+${fresh})` : "Updated with new products";
    }
    if (allLiveResults.length === 0) return "Loading more products…";
    const fetched = diagnostics?.totalFreshFetched ?? 0;
    return fetched > 0 ? `Adding fresh items… (+${fetched} so far)` : "Searching across more stores…";
  }, [allLiveResults.length, appendedCount, diagnostics, isRefreshing, searchStatus]);

  const visibleLiveResults = useMemo(
    () => allLiveResults.slice(0, displayCount),
    [allLiveResults, displayCount],
  );

  // ── Layer 1 — instant DB grid (independent fetch) ─────────────────────
  const { products: dbTopProducts, loading: dbTopLoading } = useDbTopGrid(committedQuery, 8, genderFilter);

  // ── Layer 2 — styled looks pool ───────────────────────────────────────
  const styledLooksPool = useMemo<Product[]>(() => {
    if (allLiveResults.length >= 12) return allLiveResults.slice(0, 12);
    if (dbTopProducts.length >= 4) return dbTopProducts;
    return [];
  }, [allLiveResults, dbTopProducts]);

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
  const hasActiveFilters = selectedStyles.length > 0 || selectedFit !== null || brandsInclude.length > 0 || brandsExclude.length > 0;

  // ── Saved items ───────────────────────────────────────────────────────
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

  useEffect(() => {
    let cancelled = false;

    if (!productParam) {
      setDeepLinkedProduct(null);
      return;
    }

    const alreadyVisible = [
      ...dbTopProducts,
      ...allLiveResults,
    ].find((item) => item.id === productParam);

    if (alreadyVisible) {
      setDeepLinkedProduct(null);
      setDetailProduct(alreadyVisible);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("product_cache")
        .select("id, name, brand, price, image_url, source_url, category, reason, style_tags, fit, store_name, platform")
        .eq("id", productParam)
        .maybeSingle();

      if (cancelled) return;
      if (!data) {
        setDeepLinkedProduct(null);
        return;
      }

      setDeepLinkedProduct({
        id: data.id,
        name: data.name,
        brand: data.brand || "",
        price: data.price || "",
        category: data.category || "",
        reason: data.reason || "Shared from chat",
        style_tags: Array.isArray(data.style_tags) ? data.style_tags : [],
        color: "",
        fit: data.fit || "regular",
        image_url: data.image_url,
        source_url: data.source_url,
        store_name: data.store_name,
        platform: data.platform,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [productParam, dbTopProducts, allLiveResults]);


  const runDiscover = useCallback(
    (baseQuery: string) => {
      const query = buildQuery(baseQuery, {
        subcategory: activeSubcategory,
        styles: selectedStyles,
        fit: selectedFit,
        quiz: quizAnswers,
      });
      if (!query) return;
      setCommittedQuery(query);
      setDisplayCount(PAGE_SIZE);
      setFreshFlash(null);
      void runDiscoverSearch(query);
    },
    [activeSubcategory, quizAnswers, runDiscoverSearch, selectedFit, selectedStyles],
  );

  // initial load + mood param change (re-runs when ?mood= updates from HomePage)
  useEffect(() => {
    if (moodParam) {
      setTextInput(moodParam);
      runDiscover(moodParam);
      return;
    }
    runDiscover(activeTab === "for-you" ? "new arrivals" : activeTabData?.label || "new arrivals");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moodParam]);

  useEffect(() => {
    if (activeTab === "for-you") return;
    runDiscover(activeSubcategory || activeTabData?.label || activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubcategory, activeTab]);

  // diagnostics + freshness flash + mark-seen on render
  useEffect(() => {
    if (visibleLiveResults.length === 0) return;
    const signature = `${committedQuery}:${visibleLiveResults.slice(0, PAGE_SIZE).map((item) => item.id).join(",")}`;
    if (gridSignatureRef.current === signature) return;
    const previousSig = gridSignatureRef.current;
    gridSignatureRef.current = signature;

    const previousIds = new Set(previousSig.split(":")[1]?.split(",") ?? []);
    const newlyVisible = visibleLiveResults.filter(
      (item) => item.isUnseen && item.isFresh && !previousIds.has(item.id),
    );
    if (newlyVisible.length > 0 && previousSig) {
      setFreshFlash({ count: newlyVisible.length, label: "New arrivals just added" });
      window.setTimeout(() => setFreshFlash(null), 3000);
    }

    // Mark visible as seen so suppression works on the next search.
    void markVisibleSeen(visibleLiveResults.slice(0, PAGE_SIZE));

    const summary = diagnostics;
    recordEvent({
      event_name: "discover_grid_render",
      status: visibleLiveResults.length > 0 ? "success" : "partial",
      metadata: {
        query: committedQuery,
        layer: "live",
        ladder_stage: ladderStage,
        total_new_products_fetched_session: summary?.totalFreshFetched ?? 0,
        total_inserted_into_db: summary?.totalInsertedToDb ?? 0,
        total_eligible_for_current_query: summary?.totalEligible ?? 0,
        total_rejected_by_dedupe: summary?.totalRejectedByDedupe ?? 0,
        total_rejected_by_seen_filter: summary?.totalRejectedBySeen ?? 0,
        total_rejected_by_db_seen_filter: summary?.totalRejectedByDbSeen ?? 0,
        total_rejected_by_category_filter: summary?.totalRejectedByCategory ?? 0,
        first_row_changed_count: summary?.firstRowChangedCount ?? 0,
        final_rendered_product_ids: visibleLiveResults.slice(0, PAGE_SIZE).map((item) => item.id),
        fresh_rendered_count: visibleLiveResults.filter((item) => item.isUnseen && item.isFresh).length,
      },
    });
  }, [committedQuery, diagnostics, ladderStage, markVisibleSeen, visibleLiveResults]);


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
    setDisplayCount((count) => Math.min(count + PAGE_SIZE, allLiveResults.length));
  }, [allLiveResults.length]);

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
    setBrandsInclude([]);
    setBrandsExclude([]);
    localStorage.removeItem("mymyon:brands:include");
    localStorage.removeItem("mymyon:brands:exclude");
  }, []);

  // Persist brand prefs whenever they change.
  useEffect(() => {
    localStorage.setItem("mymyon:brands:include", JSON.stringify(brandsInclude));
  }, [brandsInclude]);
  useEffect(() => {
    localStorage.setItem("mymyon:brands:exclude", JSON.stringify(brandsExclude));
  }, [brandsExclude]);

  const addBrand = useCallback((mode: "include" | "exclude") => {
    const value = brandInput.trim();
    if (!value) return;
    const setter = mode === "include" ? setBrandsInclude : setBrandsExclude;
    setter((prev) => prev.some((b) => b.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value]);
    setBrandInput("");
  }, [brandInput]);

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
            <div className="lg:hidden"><Brandmark variant="inline" /></div>
            <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70">{t("discover").toUpperCase()}</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-6 pt-6 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {needsPreferences && (
            <div className="mb-6">
              <PreferenceBanner onOpenQuiz={() => setShowQuiz(true)} />
            </div>
          )}

          {/* search input — luxury AI command bar */}
          <div className="relative">
            <div className="luxe-command flex items-center gap-3 px-5 py-3.5 md:px-6 md:py-4">
              <Search className="h-4 w-4 shrink-0 text-foreground/55 transition-colors group-focus-within:text-accent" />
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
                className="flex-1 bg-transparent text-[14px] tracking-tight text-foreground outline-none placeholder:text-foreground/45 placeholder:font-normal md:text-[15px]"
              />
              {textInput.trim() && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setTextInput("")}
                    aria-label="Clear"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleSubmit()}
                    className="rounded-full bg-foreground px-4 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-background transition-all hover:bg-foreground/85"
                  >
                    GO
                  </button>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-elevated backdrop-blur-xl"
                >
                  <div className="py-2">
                    <p className="px-5 py-2 text-[10px] font-semibold tracking-[0.22em] text-foreground/50">
                      {(suggestionResults.length > 0 ? t("suggestions") : t("trending")).toUpperCase()}
                    </p>
                    {(suggestionResults.length > 0 ? suggestionResults : TRENDING_SEARCHES).map((term, index) => (
                      <button
                        key={`${term}-${index}`}
                        onClick={() => handleSubmit(term)}
                        className="flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] text-foreground/80 transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                      >
                        <Sparkles className="h-3 w-3 shrink-0 text-accent/70" />
                        {term}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {showSuggestions && <div className="fixed inset-0 z-20" onClick={() => setShowSuggestions(false)} />}

          {/* User-submitted product CTA — earn ⭐ by adding any shopping URL */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                if (!user) { setShowAuthHint(true); return; }
                setSubmitOpen(true);
              }}
              className="group flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3.5 py-1.5 text-[10.5px] font-bold tracking-[0.12em] text-foreground/80 transition hover:border-accent/60 hover:bg-accent/10 hover:text-foreground"
            >
              <Plus className="h-3 w-3 text-accent" />
              {t("submitProductCta")}
              <span className="ml-1 flex items-center gap-0.5 rounded-full bg-[hsl(var(--star))]/15 px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--star))]">
                +1⭐
              </span>
            </button>
          </div>

          <div className="mt-3 h-px bg-border/50" />

          {/* tabs */}
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

          {/* filters bar */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Gender segmented toggle — distinct W / M / All */}
            <div className="inline-flex items-center rounded-full border border-border/30 p-0.5">
              {GENDER_FILTERS.map((g) => {
                const active = genderFilter === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setGenderFilter(g.id);
                      // re-run search so live results refilter immediately
                      void runDiscoverSearch(committedQuery);
                    }}
                    aria-pressed={active}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em] transition-all ${
                      active ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
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
            <button
              type="button"
              onClick={() => { /* placeholder action */ }}
              className="hover-burgundy flex items-center gap-2 rounded-full border border-border/30 px-4 py-2 text-[11px] font-semibold text-foreground/65"
            >
              <Sparkles className="h-3.5 w-3.5" />
              More
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

          {/* ─── HARDCODED LAYERS ─────────────────────────────────────── */}
          <div className="mt-8 space-y-12">
            {/* Layer 1 — Top DB recommendation grid (instant) */}
            <DbTopGrid products={dbTopProducts} loading={dbTopLoading} onSelect={setDetailProduct} />

            {/* Interpretation banner — sits between DB grid and Styled Looks */}
            <InterpretationBanner query={committedQuery} chips={intentChips} fallbackUsed={intentFallback} />

            {/* Layer 2 — Styled Looks shell */}
            <StyledLooksRow products={styledLooksPool} onSelect={setDetailProduct} />

            {/* AI AD strip — sits right above the live grid */}
            <DiscoverAdRow pool={allLiveResults.length > 0 ? allLiveResults : dbTopProducts} />

            {/* Layer 3 — Live search result section (append-only) */}
            <LiveResultsSection
              query={committedQuery}
              visible={visibleLiveResults}
              totalAvailable={allLiveResults.length}
              isSearching={isSearching}
              liveStatus={liveStatus}
              freshFlash={freshFlash}
              savedIds={savedIds}
              feedbackMap={feedbackMap}
              onLoadMore={handleLoadMore}
              onSelect={setDetailProduct}
              onSave={handleSave}
              onFeedback={handleFeedback}
              hasMore={displayCount < allLiveResults.length}
            />
          </div>
        </div>
      </div>

      {showAuthHint && (
        <AuthGate action="save items">
          <div />
        </AuthGate>
      )}

      <ProductDetailSheet
        product={deepLinkedProduct ?? toDetailFromProduct(detailProduct)}
        open={!!(deepLinkedProduct || detailProduct)}
        onClose={() => {
          setDetailProduct(null);
          setDeepLinkedProduct(null);
          if (productParam) {
            const next = new URLSearchParams(searchParams);
            next.delete("p");
            setSearchParams(next, { replace: true });
          }
        }}
        isSaved={detailProduct ? savedIds.has(detailProduct.id) : deepLinkedProduct ? savedIds.has(deepLinkedProduct.id) : false}
        onSave={handleSave}
      />
      <SubmitProductDialog open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </>
  );
}
