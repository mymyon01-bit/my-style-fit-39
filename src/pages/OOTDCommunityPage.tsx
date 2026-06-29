/**
 * OOTDCommunityPage — MYMYON community shell.
 *
 * Editorial 3-tab structure inspired by reference:
 *   1. Feed       — vertical OOTD feed (For You / Following)
 *   2. My Page    — user profile archive
 *   3. Wave + Showroom — viral looks + creator collections
 */
import { Suspense, lazy, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Bell, Search } from "lucide-react";
import Brandmark from "@/components/Brandmark";

const OOTDPage = lazy(() => import("@/pages/OOTDPage"));
const OOTDShortsFeed = lazy(() => import("@/components/ootd/OOTDShortsFeed"));
const ShowroomBrowsePage = lazy(() => import("@/pages/ShowroomBrowsePage"));
const WaveSection = lazy(() => import("@/components/ootd/sections/WaveSection"));

type TabKey = "feed" | "my" | "wave";
type WaveSub = "wave" | "showroom";

const TABS: { key: TabKey; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "my", label: "My Page" },
  { key: "wave", label: "Wave + Showroom" },
];

const Fallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
  </div>
);

export default function OOTDCommunityPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get("section") as TabKey) || "feed";
  const [tab, setTab] = useState<TabKey>(initial);
  const [waveSub, setWaveSub] = useState<WaveSub>("wave");

  const switchTo = (k: TabKey) => {
    setTab(k);
    const next = new URLSearchParams(params);
    next.set("section", k);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      {/* Editorial header — brand mark + utility icons */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-4 pb-2 md:px-8">
          <span className="w-8" aria-hidden />
          <Brandmark variant="compact" size="sm" />
          <button
            type="button"
            aria-label={tab === "wave" ? "Search" : "Notifications"}
            onClick={() => (tab === "wave" ? navigate("/search") : navigate("/notifications"))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 hover:text-foreground"
          >
            {tab === "wave" ? <Search className="h-4 w-4" strokeWidth={1.6} /> : <Bell className="h-4 w-4" strokeWidth={1.6} />}
          </button>
        </div>

        {/* Underline tab bar */}
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-7 px-5 pb-2 md:px-8">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTo(t.key)}
                className={`relative pb-1.5 font-display text-[14px] tracking-tight transition ${
                  active ? "text-foreground" : "text-foreground/45 hover:text-foreground/75"
                }`}
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId="ootd-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-[1.5px] rounded-full bg-foreground"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Wave sub-tabs */}
        {tab === "wave" && (
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-10 border-t border-border/40 px-5 py-2.5 md:px-8">
            {(["wave", "showroom"] as WaveSub[]).map((s) => {
              const active = waveSub === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setWaveSub(s)}
                  className={`relative pb-1 text-[12px] font-semibold uppercase tracking-[0.18em] transition ${
                    active ? "text-foreground" : "text-foreground/40"
                  }`}
                >
                  {s === "wave" ? "WAVE" : "SHOWROOM"}
                  {active && (
                    <motion.span
                      layoutId="ootd-wave-sub-underline"
                      className="absolute inset-x-0 -bottom-px h-[1.5px] rounded-full bg-foreground"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab + (tab === "wave" ? waveSub : "")}
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
            {tab === "wave" && waveSub === "wave" && <WaveSection />}
            {tab === "wave" && waveSub === "showroom" && <ShowroomBrowsePage />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
