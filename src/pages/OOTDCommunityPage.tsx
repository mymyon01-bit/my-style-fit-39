/**
 * OOTDCommunityPage — MYMYON community ecosystem shell.
 *
 * Reference: "OOTD COMMUNITY EVOLUTION" — 4 sections:
 *   A. Feed       — infinite vertical feed (uses OOTDShortsFeed)
 *   B. My Page    — outfit archive, saved looks, stats (existing OOTDPage)
 *   C. Wave       — viral looks / challenges / trend discovery (WaveBar + WaveModal)
 *   D. Showroom   — creator collections, theme rooms (HotShowroomSection)
 *
 * Closet has been folded into Showroom — "내 쇼룸 = 내 클로젯".
 */
import { Suspense, lazy, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Rss, User as UserIcon, Radio, LayoutGrid } from "lucide-react";

const OOTDPage = lazy(() => import("@/pages/OOTDPage"));
const OOTDShortsFeed = lazy(() => import("@/components/ootd/OOTDShortsFeed"));
const ShowroomBrowsePage = lazy(() => import("@/pages/ShowroomBrowsePage"));
const WaveSection = lazy(() => import("@/components/ootd/sections/WaveSection"));

type TabKey = "feed" | "my" | "wave" | "showroom";

const TABS: { key: TabKey; label: string; icon: typeof Rss }[] = [
  { key: "feed", label: "Feed", icon: Rss },
  { key: "my", label: "My Page", icon: UserIcon },
  { key: "wave", label: "Wave", icon: Radio },
  { key: "showroom", label: "Showroom", icon: LayoutGrid },
];

const Fallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
  </div>
);

export default function OOTDCommunityPage() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get("section") as TabKey) || "my";
  const [tab, setTab] = useState<TabKey>(initial);

  const switchTo = (k: TabKey) => {
    setTab(k);
    const next = new URLSearchParams(params);
    next.set("section", k);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      {/* Editorial tab bar */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-3 py-2 md:px-8">
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTo(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-medium tracking-tight transition ${
                  active
                    ? "text-foreground"
                    : "text-foreground/55 hover:text-foreground"
                }`}
              >
                <Icon className="h-[14px] w-[14px]" strokeWidth={active ? 2.2 : 1.6} />
                <span>{t.label}</span>
                {active && (
                  <motion.span
                    layoutId="ootd-tab-underline"
                    className="absolute inset-x-2 -bottom-[5px] h-[2px] rounded-full bg-accent"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<Fallback />}>
            {tab === "feed" && (
              <div className="mx-auto max-w-md">
                <OOTDShortsFeed />
              </div>
            )}
            {tab === "my" && <OOTDPage />}
            {tab === "wave" && <WaveSection />}
            {tab === "showroom" && <ShowroomBrowsePage />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
