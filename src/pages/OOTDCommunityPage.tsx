/**
 * OOTDCommunityPage — MYMYON OOTD shell.
 *
 * Redesigned to match the reference: 3 surfaces (Feed, My Page, Wave+Showroom).
 * Stories + shorts moved to /quicks.
 */
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, Settings } from "lucide-react";
import Brandmark from "@/components/Brandmark";
import FeedSection from "@/components/ootd/sections/FeedSection";
import MyPageSection from "@/components/ootd/sections/MyPageSection";
import WaveShowroomSection from "@/components/ootd/sections/WaveShowroomSection";

type TabKey = "feed" | "my" | "wave";
type WaveSub = "wave" | "showroom";

const TABS: { key: TabKey; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "my", label: "My Page" },
  { key: "wave", label: "Wave + Showroom" },
];

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

  // Header text on the wave tab uses "WAVE + SHOWROOM" per the reference.
  const showBrand = tab !== "wave";

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl">
        {/* Top row */}
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-4 pb-2 md:px-8">
          <span className="w-8" aria-hidden />
          {showBrand ? (
            <Brandmark variant="compact" size={30} />
          ) : (
            <h1 className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">
              WAVE + SHOWROOM
            </h1>
          )}
          <button
            type="button"
            aria-label={tab === "wave" ? "Search" : tab === "my" ? "Settings" : "Notifications"}
            onClick={() => {
              if (tab === "wave") navigate("/search");
              else if (tab === "my") navigate("/settings");
              else navigate("/notifications");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 hover:text-foreground"
          >
            {tab === "wave" ? (
              <Search className="h-4 w-4" strokeWidth={1.6} />
            ) : tab === "my" ? (
              <Settings className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Bell className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
        </div>

        {/* Primary tabs */}
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
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-12 border-t border-border/40 px-5 py-2.5 md:px-8">
            {(["wave", "showroom"] as WaveSub[]).map((s) => {
              const active = waveSub === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setWaveSub(s)}
                  className={`relative pb-1 text-[12px] font-semibold uppercase tracking-[0.22em] transition ${
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
          {tab === "feed" && <FeedSection />}
          {tab === "my" && <MyPageSection />}
          {tab === "wave" && <WaveShowroomSection sub={waveSub} onSubChange={setWaveSub} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
