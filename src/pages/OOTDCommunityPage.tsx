/**
 * OOTDCommunityPage — MYMYON #OOTD editorial shell.
 *
 * Desktop reclaims full screen real estate (no max-w-3xl cap) and uses a
 * striking editorial masthead with section numerals. Tabs: Feed, My Page,
 * Wave + Showroom, and Quicks (stories + shorts moved in here per request).
 *
 * Opens OOTDPostDetail via PostDetailHost when ?post=<id> is in the URL,
 * so likes / comments / stars / save work everywhere in the new shell.
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, Settings, Sparkles } from "lucide-react";
import Brandmark from "@/components/Brandmark";
import FeedSection from "@/components/ootd/sections/FeedSection";
import MyPageSection from "@/components/ootd/sections/MyPageSection";
import WaveShowroomSection from "@/components/ootd/sections/WaveShowroomSection";
import QuicksSection from "@/components/ootd/sections/QuicksSection";
import PostDetailHost from "@/components/ootd/PostDetailHost";

type TabKey = "feed" | "my" | "wave" | "quicks";
type WaveSub = "wave" | "showroom";

const TABS: { key: TabKey; label: string; num: string }[] = [
  { key: "feed", label: "Feed", num: "01" },
  { key: "my", label: "My Page", num: "02" },
  { key: "wave", label: "Wave + Showroom", num: "03" },
  { key: "quicks", label: "Quicks", num: "04" },
];

export default function OOTDCommunityPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get("section") as TabKey) || "feed";
  const [tab, setTab] = useState<TabKey>(initial);
  const [waveSub, setWaveSub] = useState<WaveSub>("wave");
  const openPostId = params.get("post");

  // Sync external section param changes (e.g. notifications deep links).
  useEffect(() => {
    const next = params.get("section") as TabKey | null;
    if (next && next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("section")]);

  const switchTo = (k: TabKey) => {
    setTab(k);
    const next = new URLSearchParams(params);
    next.set("section", k);
    next.delete("post");
    setParams(next, { replace: true });
  };

  const closePost = () => {
    const next = new URLSearchParams(params);
    next.delete("post");
    setParams(next, { replace: true });
  };

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="min-h-screen w-full bg-background pb-28 md:pb-16">
      {/* ── Editorial masthead ─────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1600px] px-5 md:px-10 xl:px-16">
          {/* Title row */}
          <div className="flex items-center justify-between pt-5 pb-3 md:pt-7 md:pb-4">
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">
                {activeTab.num} / 04
              </span>
              <h1 className="font-display text-[26px] font-medium leading-none tracking-tight text-foreground md:text-[40px]">
                #OOTD
              </h1>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.32em] text-foreground/45 md:inline">
                {activeTab.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Brandmark variant="inline" size={26} className="hidden md:block" />
              <button
                type="button"
                aria-label="Search"
                onClick={() => navigate("/search")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-secondary/60 hover:text-foreground"
              >
                <Search className="h-4 w-4" strokeWidth={1.6} />
              </button>
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => navigate("/notifications")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-secondary/60 hover:text-foreground"
              >
                <Bell className="h-4 w-4" strokeWidth={1.6} />
              </button>
              {tab === "my" && (
                <button
                  type="button"
                  aria-label="Settings"
                  onClick={() => navigate("/settings")}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-secondary/60 hover:text-foreground"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.6} />
                </button>
              )}
            </div>
          </div>

          {/* Primary tabs */}
          <div className="flex items-center gap-7 overflow-x-auto pb-3 [scrollbar-width:none] md:gap-10 md:pb-4 [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTo(t.key)}
                  className={`group relative shrink-0 pb-1.5 text-left transition ${
                    active ? "text-foreground" : "text-foreground/45 hover:text-foreground/75"
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] tracking-[0.22em] text-foreground/40">
                      {t.num}
                    </span>
                    <span className="font-display text-[15px] tracking-tight md:text-[17px]">
                      {t.label}
                      {t.key === "quicks" && (
                        <Sparkles className="ml-1 inline h-[12px] w-[12px] text-accent" strokeWidth={1.6} />
                      )}
                    </span>
                  </span>
                  {active && (
                    <motion.span
                      layoutId="ootd-tab-underline"
                      className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-foreground"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Wave sub-tabs */}
          {tab === "wave" && (
            <div className="flex items-center gap-10 border-t border-border/40 py-2.5">
              {(["wave", "showroom"] as WaveSub[]).map((s) => {
                const active = waveSub === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWaveSub(s)}
                    className={`relative pb-1 text-[11px] font-semibold uppercase tracking-[0.24em] transition ${
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
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1600px] px-0 md:px-10 xl:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + (tab === "wave" ? waveSub : "")}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pt-4 md:pt-6"
          >
            {tab === "feed" && <FeedSection />}
            {tab === "my" && <MyPageSection />}
            {tab === "wave" && <WaveShowroomSection sub={waveSub} onSubChange={setWaveSub} />}
            {tab === "quicks" && <QuicksSection />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Post detail overlay */}
      {openPostId && <PostDetailHost postId={openPostId} onClose={closePost} />}
    </div>
  );
}
