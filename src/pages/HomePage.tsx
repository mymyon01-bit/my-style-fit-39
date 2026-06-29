/**
 * HomePage — MYMYON luxury BROWSE editorial home.
 *
 * Matches the reference: gold "my" wordmark + search/bell, large editorial
 * "Spring Essentials" hero card, category pill row, icon-row (For You,
 * Brands, New In, Luxury, Street, Minimal), Trending Now horizontal cards,
 * Based on Your Body DNA recommendation row.
 *
 * All navigation funnels into /discover with category/mood filters.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  User as UserIcon,
  Tag,
  Sparkles as SparklesIcon,
  Gem,
  Building2,
  Minus,
  Heart,
  ArrowRight,
  Home as HomeIcon,
  Ruler,
  Compass,
  Shirt,
  Info,
  Heart as HeartIcon,
  ShoppingBag,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import Brandmark from "@/components/Brandmark";
import AISearchBar from "@/components/home/AISearchBar";
// Hero image now comes from real product inventory — no static asset import.

const CATEGORIES = [
  { key: "all", label: "All", q: "" },
  { key: "clothing", label: "Clothing", q: "clothing" },
  { key: "dresses", label: "Dresses", q: "dresses" },
  { key: "tops", label: "Tops", q: "tops" },
  { key: "bottoms", label: "Bottoms", q: "bottoms" },
  { key: "shoes", label: "Shoes", q: "shoes" },
  { key: "acc", label: "Acc", q: "accessories" },
];

const QUICK_TILES = [
  { key: "foryou",  label: "For You", icon: UserIcon },
  { key: "brands",  label: "Brands",  icon: Tag },
  { key: "newin",   label: "New In",  icon: SparklesIcon },
  { key: "luxury",  label: "Luxury",  icon: Gem },
  { key: "street",  label: "Street",  icon: Building2 },
  { key: "minimal", label: "Minimal", icon: Minus },
];

type TrendingPost = {
  id: string;
  image_url: string | null;
  star_count: number | null;
};

type DnaPick = {
  id: string;
  title: string;
  brand: string | null;
  image: string | null;
  match: number;
};

function formatLikes(n: number | null | undefined) {
  const v = n ?? 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
}

type HeroProduct = {
  id: string;
  title: string;
  brand: string | null;
  image: string;
};

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [dnaPicks, setDnaPicks] = useState<DnaPick[]>([]);
  const [heroes, setHeroes] = useState<HeroProduct[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const hero = heroes[heroIdx] ?? null;

  const goDiscover = useCallback(
    (q: string) => {
      const search = q ? `?mood=${encodeURIComponent(q)}&source=home` : "?source=home";
      navigate(`/discover${search}`);
    },
    [navigate],
  );

  // Pull Trending Now from OOTD — the most-starred public posts so the home
  // feed reflects what's actually hot in the community right now.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ootd_posts")
        .select("id, image_url, star_count, created_at")
        .not("image_url", "is", null)
        .order("star_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12);
      if (!cancelled && data) setTrending(data as TrendingPost[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Pull a small set of products for the Body DNA grid. Lightweight stand-in
  // for a full recommendation call — uses featured products as the seed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, brand, image_url, hero_image_url")
        .limit(12);
      if (!cancelled && data) {
        const picks = (data as any[])
          .map((p, i) => ({
            id: p.id,
            title: p.name || "Featured piece",
            brand: p.brand ?? null,
            image: p.hero_image_url || p.image_url || null,
            match: 88 + ((i * 3) % 11),
          }))
          .filter((p) => !!p.image);
        setDnaPicks(picks.slice(0, 6));
        // Pick the first product with a usable image as the editorial hero so
        // the home page always reflects real inventory we actually ship.
        // Build a small rotating set of heroes from real inventory so the
        // "Today's Pick" card cycles through items that match our catalog.
        const heroSet = picks
          .filter((p) => !!p.image)
          .slice(0, 5)
          .map((p) => ({
            id: p.id,
            title: p.title,
            brand: p.brand,
            image: p.image as string,
          }));
        if (heroSet.length) setHeroes(heroSet);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate the Today's Pick hero every ~5s with a soft crossfade.
  useEffect(() => {
    if (heroes.length < 2) return;
    const id = window.setInterval(() => {
      setHeroIdx((i) => (i + 1) % heroes.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [heroes.length]);

  const SIDEBAR_LINKS = [
    { key: "home", label: "Home", icon: HomeIcon, to: "/", active: true },
    { key: "fit", label: "Fit DNA", icon: Ruler, to: "/fit" },
    { key: "discover", label: "Discover", icon: Compass, to: "/discover" },
    { key: "ootd", label: "#OOTD", icon: Shirt, to: "/ootd" },
    { key: "profile", label: "Profile", icon: UserIcon, to: "/profile" },
    { key: "about", label: "About", icon: Info, to: "/about" },
  ];

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      {/* ── Mobile top bar (hidden lg+) ───────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/85 px-5 pt-5 pb-3 backdrop-blur-xl lg:hidden">
        <Brandmark variant="inline" size={28} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Search"
            onClick={() => navigate("/discover?source=home-search")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary/60"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => navigate(user ? "/profile?tab=notifications" : "/auth")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary/60"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.6} />
            <span className="absolute right-[9px] top-[8px] h-1.5 w-1.5 rounded-full bg-accent" />
          </button>
        </div>
      </header>

      {/* ── Desktop top bar — brand · search · actions (matches ref) ── */}
      <header className="sticky top-0 z-30 hidden border-b border-border/40 bg-background/85 backdrop-blur-xl lg:block">
        <div className="mx-auto flex max-w-[1440px] items-center gap-10 px-10 py-5 xl:px-16">
          <div className="w-[200px] shrink-0">
            <Brandmark variant="inline" size={32} />
          </div>
          <div className="flex-1 max-w-2xl">
            <AISearchBar placeholder="Search for styles, products, looks…" />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" aria-label="Saved"
              onClick={() => navigate(user ? "/profile?tab=saved" : "/auth")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-secondary/60 hover:text-foreground">
              <HeartIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Account"
              onClick={() => navigate(user ? "/profile" : "/auth")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-secondary/60 hover:text-foreground">
              <UserIcon className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Bag"
              onClick={() => navigate(user ? "/profile?tab=bag" : "/auth")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground/75 transition-colors hover:bg-secondary/60 hover:text-foreground">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>


      {/* ── Desktop: sidebar + wide main. Mobile stays single-column. ── */}
      <div className="mx-auto w-full max-w-[1440px] lg:flex lg:items-start lg:gap-14 lg:px-10 lg:pt-4 xl:px-16">
        {/* Sidebar (lg+ only) */}
        <aside className="hidden w-[200px] shrink-0 lg:block">
          <nav className="sticky top-[96px] flex flex-col gap-1 py-2">
            {SIDEBAR_LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => navigate(l.to)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] tracking-tight transition-colors ${
                    l.active
                      ? "bg-secondary/70 font-medium text-foreground"
                      : "text-foreground/70 hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  <span>{l.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

      <main className="mx-auto w-full max-w-md px-5 lg:mx-0 lg:max-w-none lg:flex-1 lg:px-0">

        {/* AI Search — mobile only; desktop uses the top-bar search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 lg:hidden"
        >
          <AISearchBar />
        </motion.div>


        {/* Category pills */}
        <div className="mt-5 -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 pb-1">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onClick={() => goDiscover(c.q)}
                className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-medium tracking-tight transition-all ${
                  i === 0
                    ? "bg-foreground text-background"
                    : "bg-secondary/60 text-foreground/75 hover:bg-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Hero card ───────────────────────────────────────────── */}
        <motion.button
          type="button"
          onClick={() => (hero ? navigate(`/fit/${hero.id}`) : goDiscover("new in"))}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-6 block w-full overflow-hidden rounded-[28px] text-left shadow-[var(--shadow-2)] aspect-[16/11] lg:aspect-[21/9]"

        >
          {heroes.length === 0 ? (
            <div className="absolute inset-0 animate-pulse bg-foreground/[0.06]" />
          ) : (
            <AnimatePresence mode="sync">
              <motion.img
                key={hero?.id}
                src={hero?.image}
                alt={hero?.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
          )}
          {/* Soft warm wash so text reads on the right of the model */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, hsl(32 28% 92% / 0.92) 0%, hsl(32 28% 92% / 0.55) 38%, transparent 62%)",
            }}
          />
          <div className="relative flex h-full w-1/2 flex-col justify-center p-6 md:p-10">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">
              {hero?.brand?.toUpperCase() ?? "New In"}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={hero?.id ?? "placeholder"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-3 font-display text-[34px] font-medium leading-[0.95] tracking-tight text-foreground md:text-[44px]"
              >
                {hero?.title ?? "Today's\nPick"}
              </motion.span>
            </AnimatePresence>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/80">
              Explore Now <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
            </span>
          </div>
          {/* Rotation dots */}
          {heroes.length > 1 && (
            <div className="absolute bottom-4 right-5 flex items-center gap-1.5 md:bottom-6 md:right-8">
              {heroes.map((h, i) => (
                <span
                  key={h.id}
                  onClick={(e) => { e.stopPropagation(); setHeroIdx(i); }}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === heroIdx ? "w-6 bg-foreground/80" : "w-1.5 bg-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}
        </motion.button>

        {/* ── Quick tile row ──────────────────────────────────────── */}
        <div className="mt-7 grid grid-cols-6 gap-2 md:gap-6">
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => goDiscover(tile.label.toLowerCase())}
                className="group flex flex-col items-center gap-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card transition-all group-hover:border-accent/60 group-hover:bg-accent/10 md:h-16 md:w-16">
                  <Icon className="h-[18px] w-[18px] text-foreground/75 md:h-5 md:w-5" strokeWidth={1.5} />
                </span>
                <span className="text-[10px] font-medium tracking-tight text-foreground/70 md:text-[12px]">
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Trending Now (hot OOTD posts) ───────────────────────── */}
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-tight text-foreground md:text-[22px]">
              Trending Now
            </h2>
            <button
              type="button"
              onClick={() => navigate("/ootd")}
              className="text-[11px] font-medium tracking-tight text-foreground/55 hover:text-accent"
            >
              See All
            </button>
          </div>
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 pb-1 md:gap-5">
              {(trending.length ? trending : Array.from({ length: 6 }).map((_, i) => ({ id: `s${i}`, image_url: null, star_count: 0 }))).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/ootd?post=${item.id}`)}
                  className="relative shrink-0 overflow-hidden rounded-2xl bg-foreground/[0.04] md:w-[200px]"
                  style={{ width: 140, aspectRatio: "3 / 4" }}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-foreground/[0.06]" />
                  )}
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-md">
                    <Heart className="h-3.5 w-3.5 text-foreground/85" strokeWidth={1.6} />
                  </span>
                  <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-semibold tracking-tight text-foreground/85 backdrop-blur-md">
                    <Heart className="h-3 w-3 fill-accent text-accent" strokeWidth={0} />
                    {formatLikes(item.star_count)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Based on Your Body DNA — single horizontal row ───────── */}
        {dnaPicks.length > 0 && (
          <section className="mt-9">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-[18px] font-semibold tracking-tight text-foreground md:text-[22px]">
                Based on Your Body DNA
              </h2>
              <button
                type="button"
                onClick={() => navigate("/fit")}
                className="text-[11px] font-medium tracking-tight text-foreground/55 hover:text-accent"
              >
                See All
              </button>
            </div>
            <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-3 pb-1 md:gap-5">
                {dnaPicks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/p/${p.id}`)}
                    className="group relative shrink-0 overflow-hidden rounded-2xl bg-foreground/[0.04] text-left md:w-[200px]"
                    style={{ width: 140, aspectRatio: "3 / 4" }}
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-foreground/[0.06]" />
                    )}
                    {p.match > 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.18em] uppercase text-accent backdrop-blur-md">
                        {p.match}% match
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent px-2.5 py-2">
                      <div className="truncate font-display text-[12px] font-medium text-foreground">{p.title}</div>
                      {p.brand && (
                        <div className="truncate text-[10px] text-muted-foreground">{p.brand}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* tagline / footer text */}
        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40">
          {t("howAreYouFeeling")}
        </p>
      </main>
      </div>
    </div>

  );
};

export default HomePage;
