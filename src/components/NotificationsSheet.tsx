import { useMemo } from "react";
import { Bell, Loader2, X, Star, MessageCircle, UserPlus, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationsList, type NotificationRow } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ICON_BY_TYPE: Record<string, any> = {
  follow: UserPlus,
  star: Star,
  comment: MessageCircle,
};

const LABEL_BY_TYPE: Record<string, string> = {
  follow: "joined your circle",
  star: "starred your post",
  comment: "commented on your post",
};

/**
 * Notifications inbox: splits items into "Unread" and "Earlier" sections so
 * read items stay visible (history). The badge clears only when the user
 * taps "Mark all read" — never automatically — so they can actually see
 * what's new on open.
 */
export default function NotificationsSheet({ open, onClose }: Props) {
  const { items, actors, loading, markAllRead, reload } = useNotificationsList();
  const navigate = useNavigate();

  const { unread, earlier } = useMemo(() => {
    const u: NotificationRow[] = [];
    const e: NotificationRow[] = [];
    items.forEach((n) => (n.read_at ? e.push(n) : u.push(n)));
    return { unread: u, earlier: e };
  }, [items]);

  const renderItem = (n: NotificationRow) => {
    const Icon = ICON_BY_TYPE[n.type] || Bell;
    const actor = n.actor_id ? actors[n.actor_id] : null;
    const actorName = actor?.display_name || actor?.username || "Someone";
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
          className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/5 ${
            isUnread ? "bg-accent/[0.06]" : "opacity-75"
          }`}
        >
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
            {actor?.avatar_url ? (
              <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-foreground/50">
                {actorName[0].toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
              <Icon className="h-2.5 w-2.5 text-accent" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-foreground/90">
              <span className="font-semibold">{actorName}</span>{" "}
              <span className="text-foreground/60">{LABEL_BY_TYPE[n.type] || n.type}</span>
            </p>
            <p className="text-[10px] text-foreground/40">
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
          className="fixed inset-0 z-[110] bg-background"
        >
          <div className="mx-auto flex h-full max-w-lg flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-foreground/70" />
                <span className="text-[11px] font-semibold tracking-[0.25em] text-foreground/80">
                  NOTIFICATIONS
                  {unread.length > 0 && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
                      {unread.length}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unread.length > 0 && (
                  <button
                    onClick={async () => {
                      await markAllRead();
                      reload();
                    }}
                    className="flex items-center gap-1 rounded-full border border-border/40 px-2.5 py-1 text-[9px] font-semibold tracking-wider text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CheckCheck className="h-3 w-3" /> MARK READ
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-foreground/50 hover:text-foreground"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <Bell className="h-8 w-8 text-foreground/15" />
                  <p className="text-[12px] text-foreground/50">No notifications yet</p>
                  <p className="text-[10px] text-foreground/35">
                    Stars, comments, and new followers will show up here
                  </p>
                </div>
              ) : (
                <>
                  {unread.length > 0 && (
                    <div>
                      <p className="px-5 pt-4 pb-2 text-[9px] font-semibold tracking-[0.25em] text-accent">
                        UNREAD · {unread.length}
                      </p>
                      <ul className="divide-y divide-border/20">{unread.map(renderItem)}</ul>
                    </div>
                  )}
                  {earlier.length > 0 && (
                    <div>
                      <p className="px-5 pt-5 pb-2 text-[9px] font-semibold tracking-[0.25em] text-foreground/45">
                        EARLIER
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
