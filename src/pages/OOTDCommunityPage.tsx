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
import { Button } from "@/components/ui/button";
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
const TABS: { key: TabKey; label: string; caption: string; Icon: typeof Home }[] = [
  { key: "my",       label: "My",       caption: "ME",      Icon: User  },
  { key: "feed",     label: "Feed",     caption: "STREAM",  Icon: Home  },
  { key: "quicks",   label: "Quicks",   caption: "SHORTS",  Icon: Zap   },
  { key: "wave",     label: "Wave",     caption: "CULTURE", Icon: Waves },
  { key: "showroom", label: "Showroom", caption: "EXHIBIT", Icon: Store },
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
    <div className="ootd-modern-shell min-h-screen w-full bg-background pb-28 font-sans md:pb-16">
      {/* ── OOTD fashion-station header ────────────────────── */}
      <header className="sticky top-0 z-30 border-b-2 border-foreground/10 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1600px] px-3 min-[360px]:px-5 md:px-10 xl:px-16">
          {/* Title row */}
          <div className="flex min-w-0 items-center justify-between gap-2 pb-5 pt-5 md:gap-4 md:pb-7 md:pt-7">
            <div className="min-w-0 shrink">
              <p className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.26em] text-foreground/42">
                MYMYON / STYLE STATION
              </p>
              <h1 className="text-[26px] font-black uppercase leading-none tracking-normal text-foreground min-[360px]:text-[30px] md:text-[42px]">
                OOTD<span className="text-accent">.</span>
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 min-[360px]:gap-1.5 md:gap-2">
              <IconBtn label="Home" onClick={() => navigate("/")}>
                <Home className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </IconBtn>
              <IconBtn label="Search" onClick={() => navigate("/search")}>
                <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
              </IconBtn>
              <MailboxIcon
                unread={msgUnread}
                onClick={(anchor) => { setMailboxAnchor(anchor); setMessagesOpen(true); }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                onClick={() => setNotifsOpen(true)}
                className="relative h-9 w-9 rounded-full border border-foreground/10 bg-card text-foreground/65 hover:bg-foreground hover:text-background min-[360px]:h-10 min-[360px]:w-10"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} />
                {notifUnread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-accent-foreground leading-none">
                    {notifUnread > 99 ? "99+" : notifUnread}
                  </span>
                )}
              </Button>
              {tab === "my" && (
                <IconBtn label="Settings" onClick={() => navigate("/settings")}>
                  <Settings className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </IconBtn>
              )}
            </div>
          </div>

          {/* Circular fashion-station navigation */}
          <nav className="grid grid-cols-5 items-start gap-0.5 overflow-visible pb-5 min-[360px]:gap-1 md:flex md:justify-center md:gap-12 md:pb-7">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Button
                  key={t.key}
                  type="button"
                  variant="ghost"
                  onClick={() => switchTo(t.key)}
                  aria-label={t.label}
                  className={`group relative h-auto min-w-0 flex-col gap-2 rounded-none p-0 md:w-[78px] md:flex-none ${
                    active ? "text-foreground" : "text-foreground/38 hover:bg-transparent hover:text-foreground"
                  }`}
                >
                  <span
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-300 min-[360px]:h-[52px] min-[360px]:w-[52px] md:h-16 md:w-16 ${
                      active
                        ? "border-foreground bg-foreground text-background shadow-[4px_5px_0_hsl(var(--accent))] -translate-y-0.5"
                        : "border-foreground/12 bg-card text-foreground/35 group-hover:border-foreground group-hover:text-foreground"
                    }`}
                  >
                    <t.Icon
                      className="h-[19px] w-[19px] md:h-[22px] md:w-[22px]"
                      strokeWidth={active ? 2.5 : 1.8}
                    />
                    {t.key === "wave" && (
                      <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
                    )}
                  </span>
                  <span className="flex flex-col items-center leading-none">
                    <span className={`text-[10px] font-extrabold uppercase tracking-normal md:text-[11px] ${active ? "text-foreground" : "text-foreground/55"}`}>
                      {t.label}
                    </span>
                    <span className={`mt-1 hidden font-mono text-[8px] font-bold tracking-[0.14em] sm:block ${active ? "text-accent" : "text-foreground/28"}`}>
                      {t.caption}
                    </span>
                  </span>
                </Button>
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
            className="pt-3 md:pt-7"
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

      <MailboxPopup
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        anchor={mailboxAnchor}
      />
      <NotificationsSheet open={notifsOpen} onClose={() => setNotifsOpen(false)} />
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className="h-9 w-9 rounded-full border border-foreground/10 bg-card text-foreground/65 hover:bg-foreground hover:text-background min-[360px]:h-10 min-[360px]:w-10"
    >
      {children}
    </Button>
  );
}
