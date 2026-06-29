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
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import Brandmark from "@/components/Brandmark";
import AISearchBar from "@/components/home/AISearchBar";
import heroSpring from "@/assets/home-hero-spring.jpg";

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

// Trending placeholders — wire to real data later
const TRENDING = [
  { id: 1, img: heroSpring, likes: "23.4K", tone: "linen" },
  { id: 2, img: heroSpring, likes: "18.7K", tone: "noir" },
  { id: 3, img: heroSpring, likes: "15.2K", tone: "blazer" },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  const goDiscover = useCallback(
    (q: string) => {
      const search = q ? `?mood=${encodeURIComponent(q)}&source=home` : "?source=home";
      navigate(`/discover${search}`);
    },
    [navigate],
  );

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-background/85 px-5 pt-5 pb-3 backdrop-blur-xl md:px-10 md:pt-8">
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

      <main className="mx-auto max-w-md px-5 md:max-w-3xl md:px-10">
        {/* Section title */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2 font-display text-[40px] font-medium leading-none tracking-tight text-foreground md:text-[56px]"
        >
          BROWSE
        </motion.h1>

        {/* Category pills */}
        <div className="mt-5 -mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          onClick={() => goDiscover("spring essentials")}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-5 block w-full overflow-hidden rounded-[28px] text-left shadow-[var(--shadow-2)]"
          style={{ aspectRatio: "16 / 11" }}
        >
          <img
            src={heroSpring}
            alt="Spring Essentials"
            className="absolute inset-0 h-full w-full object-cover"
            width={1024}
            height={768}
          />
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
              New In
            </span>
            <span className="mt-3 font-display text-[34px] font-medium leading-[0.95] tracking-tight text-foreground md:text-[44px]">
              Spring
              <br />
              Essentials
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/80">
              Explore Now <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
            </span>
          </div>
        </motion.button>

        {/* ── Quick tile row ──────────────────────────────────────── */}
        <div className="mt-7 grid grid-cols-6 gap-2">
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => goDiscover(tile.label.toLowerCase())}
                className="group flex flex-col items-center gap-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card transition-all group-hover:border-accent/60 group-hover:bg-accent/10">
                  <Icon className="h-[18px] w-[18px] text-foreground/75" strokeWidth={1.5} />
                </span>
                <span className="text-[10px] font-medium tracking-tight text-foreground/70">
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Trending Now ────────────────────────────────────────── */}
        <section className="mt-9">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-tight text-foreground">
              Trending Now
            </h2>
            <button
              type="button"
              onClick={() => goDiscover("trending")}
              className="text-[11px] font-medium tracking-tight text-foreground/55 hover:text-accent"
            >
              See All
            </button>
          </div>
          <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 pb-1">
              {TRENDING.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goDiscover("trending")}
                  className="relative shrink-0 overflow-hidden rounded-2xl"
                  style={{ width: 140, aspectRatio: "3 / 4" }}
                >
                  <img
                    src={item.img}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    width={420}
                    height={560}
                  />
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 backdrop-blur-md">
                    <Heart className="h-3.5 w-3.5 text-foreground/85" strokeWidth={1.6} />
                  </span>
                  <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-semibold tracking-tight text-foreground/85 backdrop-blur-md">
                    <Heart className="h-3 w-3 fill-accent text-accent" strokeWidth={0} />
                    {item.likes}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Based on Your Body DNA ──────────────────────────────── */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-tight text-foreground">
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
          <button
            type="button"
            onClick={() => navigate("/fit")}
            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-3 text-left transition-shadow hover:shadow-[var(--shadow-2)]"
          >
            <img
              src={heroSpring}
              alt="Relaxed Blazer"
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-xl object-cover"
              width={64}
              height={64}
            />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                92% Match
              </div>
              <div className="mt-0.5 truncate font-display text-[16px] font-medium text-foreground">
                Relaxed Blazer
              </div>
              <div className="truncate text-[11px] text-muted-foreground">Acne Studios</div>
            </div>
            <ArrowRight className="h-4 w-4 text-foreground/40" strokeWidth={1.5} />
          </button>
        </section>

        {/* tagline / footer text */}
        <p className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/40">
          {t("howAreYouFeeling")}
        </p>
      </main>
    </div>
  );
};

export default HomePage;
