import { useEffect, useMemo, useState } from "react";
import { Bell, Loader2, X, Star, MessageCircle, UserPlus, CheckCheck, Heart, AtSign, Smile, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationsList, type NotificationRow } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useI18n } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ICON_BY_TYPE: Record<string, any> = {
  follow: UserPlus,
  circle_request: UserPlus,
  star: Star,
  ootd_star: Star,
  comment: MessageCircle,
  ootd_comment: MessageCircle,
  ootd_reply: MessageCircle,
  ootd_like: Heart,
  comment_like: Heart,
  ootd_mention: AtSign,
  ootd_reaction: Smile,
  reaction: Smile,
};

const SUFFIX_KEY_BY_TYPE: Record<string, string> = {
  follow: "notifSuffixFollow",
  circle_request: "notifSuffixCircleRequest",
  star: "notifSuffixStar",
  ootd_star: "notifSuffixOotdStar",
  ootd_like: "notifSuffixOotdLike",
  comment_like: "notifSuffixCommentLike",
  comment: "notifSuffixComment",
  ootd_comment: "notifSuffixOotdComment",
  ootd_reply: "notifSuffixOotdReply",
  ootd_mention: "notifSuffixOotdMention",
  ootd_reaction: "notifSuffixOotdReaction",
  reaction: "notifSuffixReaction",
  showroom_star: "notifSuffixShowroomStar",
  showroom_like: "notifSuffixShowroomLike",
  showroom_save: "notifSuffixShowroomSave",
  showroom_follow: "notifSuffixShowroomFollow",
};

/**
 * Notifications inbox: splits items into "Unread" and "Earlier" sections so
 * read items stay visible (history). The badge clears only when the user
 * taps "Mark all read" — never automatically — so they can actually see
 * what's new on open.
 */
export default function NotificationsSheet({ open, onClose }: Props) {
  const { items, actors, loading, markAllRead, reload, deleteAll } = useNotificationsList();
  const [confirmClear, setConfirmClear] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  // Esc closes the sheet — guarantees a keyboard exit if the X is missed
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { unread, earlier } = useMemo(() => {
    const u: NotificationRow[] = [];
    const e: NotificationRow[] = [];
    items.forEach((n) => (n.read_at ? e.push(n) : u.push(n)));
    return { unread: u, earlier: e };
  }, [items]);

  const renderItem = (n: NotificationRow) => {
    const Icon = ICON_BY_TYPE[n.type] || Bell;
    const actor = n.actor_id ? actors[n.actor_id] : null;
    const actorName = actor?.display_name || actor?.username || t("notifSomeone" as any);
    const isUnread = !n.read_at;
    return (
      <li key={n.id}>
        <button
          onClick={() => {
            if (n.type === "follow" && n.actor_id) {
              onClose();
              navigate(`/user/${n.actor_id}`);
            } else if ((n.type === "star" || n.type === "comment") && n.target_id) {
              onClose();
              navigate(`/ootd?post=${n.target_id}`);
            }
          }}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-accent/5 ${
            isUnread ? "bg-accent/[0.06]" : "opacity-75"
          }`}
        >
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
            {actor?.avatar_url ? (
              <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground/50">
                {actorName[0].toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background">
              <Icon className="h-2 w-2 text-accent" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] text-foreground/90">
              <span className="font-semibold">{actorName}</span>
              <span className="text-foreground/60"> {SUFFIX_KEY_BY_TYPE[n.type] ? t(SUFFIX_KEY_BY_TYPE[n.type] as any) : n.type}</span>
            </p>
            <p className="text-[9.5px] text-foreground/40">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
          </div>
          {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
        </button>
      </li>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="mx-auto flex h-full max-w-lg flex-col">
            {/* Sticky header with prominent close — always reachable */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/30 bg-background/95 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-4 w-4 text-foreground/70 shrink-0" />
                <span className="text-[11px] font-semibold tracking-[0.25em] text-foreground/80 truncate">
                  {t("notifTitle" as any)}
                </span>
                {unread.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground leading-none">
                    {unread.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {unread.length > 0 && (
                  <button
                    onClick={async () => {
                      await markAllRead();
                      reload();
                    }}
                    className="flex items-center gap-1 rounded-full border border-border/40 px-2.5 py-1.5 text-[9px] font-semibold tracking-wider text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CheckCheck className="h-3 w-3" /> {t("notifMarkRead" as any)}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  aria-label={t("closeNotifications" as any)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List — extra bottom padding so last item clears mobile nav */}
            <div className="flex-1 overflow-y-auto pb-24">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <Bell className="h-8 w-8 text-foreground/15" />
                  <p className="text-[12px] text-foreground/50">{t("notifEmpty" as any)}</p>
                  <p className="text-[10px] text-foreground/35">
                    {t("notifEmptyHint" as any)}
                  </p>
                </div>
              ) : (
                <>
                  {unread.length > 0 && (
                    <div>
                      <p className="px-5 pt-4 pb-2 text-[9px] font-semibold tracking-[0.25em] text-accent">
                        {t("notifUnread" as any)} · {unread.length}
                      </p>
                      <ul className="divide-y divide-border/20">{unread.map(renderItem)}</ul>
                    </div>
                  )}
                  {earlier.length > 0 && (
                    <div>
                      <p className="px-5 pt-5 pb-2 text-[9px] font-semibold tracking-[0.25em] text-foreground/45">
                        {t("notifEarlier" as any)}
                      </p>
                      <ul className="divide-y divide-border/20">{earlier.map(renderItem)}</ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
