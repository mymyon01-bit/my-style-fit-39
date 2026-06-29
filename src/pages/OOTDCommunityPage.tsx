/**
 * OOTDCommunityPage — MYMYON #OOTD social shell.
 *
 * Social-media vibe: cute icon-based tab bar, no editorial numerals.
 * Tab order: Feed · My Page · Quicks (center, highlighted) · Wave · Showroom.
 * Opens OOTDPostDetail via PostDetailHost when ?post=<id> is in the URL.
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Search, Settings, Home, User, Zap, Waves, Store } from "lucide-react";
import FeedSection from "@/components/ootd/sections/FeedSection";
import MyPageSection from "@/components/ootd/sections/MyPageSection";
import WaveShowroomSection from "@/components/ootd/sections/WaveShowroomSection";
import QuicksSection from "@/components/ootd/sections/QuicksSection";
import PostDetailHost from "@/components/ootd/PostDetailHost";

type TabKey = "feed" | "my" | "quicks" | "wave" | "showroom";

const TABS: { key: TabKey; label: string; Icon: typeof Home; emoji: string }[] = [
  { key: "feed",     label: "Feed",     Icon: Home,  emoji: "🏠" },
  { key: "my",       label: "My",       Icon: User,  emoji: "👤" },
  { key: "quicks",   label: "Quicks",   Icon: Zap,   emoji: "⚡" },
  { key: "wave",     label: "Wave",     Icon: Waves, emoji: "🌊" },
  { key: "showroom", label: "Showroom", Icon: Store, emoji: "🛍️" },
];

export default function OOTDCommunityPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get("section") as TabKey) || "feed";
  const [tab, setTab] = useState<TabKey>(initial);
  const openPostId = params.get("post");

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

  return (
    <div className="min-h-screen w-full bg-background pb-28 md:pb-16">
      {/* ── Social-style header ─────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1600px] px-5 md:px-10 xl:px-16">
          {/* Title row */}
          <div className="flex items-center justify-between pt-4 pb-2 md:pt-5">
            <h1 className="font-display text-[24px] font-medium leading-none tracking-tight text-foreground md:text-[30px]">
              <span className="text-accent">#</span>OOTD
            </h1>
            <div className="flex items-center gap-1">
              <IconBtn label="Search" onClick={() => navigate("/search")}>
                <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </IconBtn>
              <IconBtn label="Notifications" onClick={() => navigate("/notifications")}>
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </IconBtn>
              {tab === "my" && (
                <IconBtn label="Settings" onClick={() => navigate("/settings")}>
                  <Settings className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </IconBtn>
              )}
            </div>
          </div>

          {/* Cute icon tabs */}
          <nav className="flex items-end justify-around gap-1 pb-2 pt-1 md:justify-center md:gap-10">
            {TABS.map((t) => {
              const active = tab === t.key;
              const isCenter = t.key === "quicks";
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTo(t.key)}
                  className={`group relative flex flex-col items-center gap-1 px-2 pt-1 pb-1.5 transition ${
                    active ? "text-foreground" : "text-foreground/45 hover:text-foreground/80"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full transition-all ${
                      isCenter
                        ? active
                          ? "h-11 w-11 bg-gradient-to-br from-accent to-primary text-background shadow-[0_6px_20px_-6px_hsl(var(--accent)/0.6)]"
                          : "h-11 w-11 bg-gradient-to-br from-accent/30 to-primary/30 text-foreground/75"
                        : active
                          ? "h-9 w-9 bg-secondary"
                          : "h-9 w-9"
                    }`}
                  >
                    <t.Icon
                      className={isCenter ? "h-[20px] w-[20px]" : "h-[18px] w-[18px]"}
                      strokeWidth={active ? 2 : 1.6}
                    />
                  </span>
                  <span
                    className={`text-[10.5px] font-medium tracking-tight ${
                      active ? "text-foreground" : "text-foreground/55"
                    }`}
                  >
                    {t.label}
                  </span>
                  {active && !isCenter && (
                    <motion.span
                      layoutId="ootd-tab-dot"
                      className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1600px] px-0 md:px-10 xl:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pt-4 md:pt-6"
          >
            {tab === "feed" && <FeedSection />}
            {tab === "my" && <MyPageSection />}
            {tab === "quicks" && <QuicksSection />}
            {tab === "wave" && <WaveShowroomSection sub="wave" onSubChange={() => switchTo("showroom")} />}
            {tab === "showroom" && <WaveShowroomSection sub="showroom" onSubChange={() => switchTo("wave")} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {openPostId && <PostDetailHost postId={openPostId} onClose={closePost} />}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-secondary/60 hover:text-foreground"
    >
      {children}
    </button>
  );
}
