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
import NotificationsSheet from "@/components/NotificationsSheet";
import MailboxIcon from "@/components/messages/MailboxIcon";
import MailboxPopup from "@/components/messages/MailboxPopup";
import { useNotifications } from "@/hooks/useNotifications";

type TabKey = "my" | "feed" | "quicks" | "wave" | "showroom";

// Tab bar reads left-to-right: MY first (your page), then the social feed,
// Quicks in the middle as the hero CTA, then Wave and Showroom.
const TABS: { key: TabKey; label: string; Icon: typeof Home }[] = [
  { key: "my",       label: "My",       Icon: User  },
  { key: "feed",     label: "Feed",     Icon: Home  },
  { key: "quicks",   label: "Quicks",   Icon: Zap   },
  { key: "wave",     label: "Wave",     Icon: Waves },
  { key: "showroom", label: "Showroom", Icon: Store },
];

export default function OOTDCommunityPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (params.get("section") as TabKey) || "my";
  const [tab, setTab] = useState<TabKey>(initial);
  const openPostId = params.get("post");
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [mailboxAnchor, setMailboxAnchor] = useState<{ x: number; y: number } | null>(null);
  const { notifUnread, msgUnread } = useNotifications();

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
              <IconBtn label="Home" onClick={() => navigate("/")}>
                <Home className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </IconBtn>
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
          <nav className="flex items-end justify-around gap-1 pb-2.5 pt-1 md:justify-center md:gap-12">
            {TABS.map((t) => {
              const active = tab === t.key;
              const isCenter = t.key === "quicks";
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTo(t.key)}
                  aria-label={t.label}
                  className={`group relative flex flex-col items-center gap-1.5 px-2 pt-1 pb-0.5 transition ${
                    active ? "text-foreground" : "text-foreground/50 hover:text-foreground/85"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                      isCenter
                        ? active
                          ? "h-12 w-12 bg-gradient-to-br from-accent to-primary text-background shadow-[0_8px_24px_-8px_hsl(var(--accent)/0.7)] scale-105"
                          : "h-12 w-12 bg-gradient-to-br from-accent/25 to-primary/25 text-foreground/80"
                        : active
                          ? "h-10 w-10 bg-secondary ring-2 ring-accent/40"
                          : "h-10 w-10 bg-secondary/40 group-hover:bg-secondary/70"
                    }`}
                  >
                    <t.Icon
                      className={isCenter ? "h-[22px] w-[22px]" : "h-[19px] w-[19px]"}
                      strokeWidth={active ? 2.1 : 1.7}
                    />
                  </span>
                  <span
                    className={`text-[11px] font-semibold tracking-tight transition-colors ${
                      active ? "text-foreground" : "text-foreground/55"
                    }`}
                  >
                    {t.label}
                  </span>
                  {active && !isCenter && (
                    <motion.span
                      layoutId="ootd-tab-dot"
                      className="absolute -bottom-1 h-1 w-4 rounded-full bg-accent"
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
