import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useConversations } from "@/hooks/useMessages";
import MessageThread from "./MessageThread";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional: open straight into a specific conversation (used by UserProfile message button) */
  initialConversationId?: string | null;
  initialOtherUserId?: string | null;
}

/**
 * Full-screen Messages inbox sheet — opened from the OOTD My Page card.
 * When `initialConversationId` is provided, opens directly into that thread.
 */
export default function MessagesFullSheet({ open, onClose, initialConversationId, initialOtherUserId }: Props) {
  const { conversations, loading, totalUnread } = useConversations();
  const [active, setActive] = useState<{ id: string; otherUserId: string } | null>(null);

  // Sync external "open into this thread" requests
  useEffect(() => {
    if (open && initialConversationId && initialOtherUserId) {
      setActive({ id: initialConversationId, otherUserId: initialOtherUserId });
    }
    if (!open) setActive(null);
  }, [open, initialConversationId, initialOtherUserId]);

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
            <div className="relative flex items-center justify-between border-b border-border/30 bg-gradient-to-b from-card/80 to-background px-5 py-4">
              {/* Brand stamp — graffiti-flavoured OOTD mailbox tag */}
              <div className="flex items-center gap-2.5">
                <span
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(330 100% 65%) 100%)",
                    boxShadow: "0 4px 14px -4px hsl(var(--accent) / 0.45)",
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-white" strokeWidth={2.4} />
                </span>
                <div className="flex flex-col leading-none">
                  <span className="font-display text-[15px] italic font-semibold tracking-tight text-foreground">
                    Mailbox
                  </span>
                  <span className="mt-0.5 text-[8.5px] font-mono font-semibold tracking-[0.28em] text-foreground/55">
                    OOTD · INBOX
                    {totalUnread > 0 && (
                      <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold text-accent-foreground">
                        {totalUnread}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (active) setActive(null);
                  else onClose();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-foreground/55 hover:bg-foreground/5 hover:text-foreground"
                aria-label="Close messages"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className={`flex-1 min-h-0 ${active ? "p-0" : "overflow-y-auto p-4"}`}>
              {active ? (
                <MessageThread
                  conversationId={active.id}
                  otherUserId={active.otherUserId}
                  onBack={() => setActive(null)}
                />
              ) : loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <MessageCircle className="h-7 w-7 text-foreground/20" />
                  <p className="text-[12px] text-foreground/50">No messages yet</p>
                  <p className="text-[10px] text-foreground/35">
                    Open a profile and tap Message to start a chat
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/20 overflow-hidden rounded-2xl border border-border/30 bg-card/40">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setActive({ id: c.id, otherUserId: c.other_user_id })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                          {c.other_avatar_url ? (
                            <img src={c.other_avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-muted-foreground">
                              {(c.other_display_name || c.other_username || "?")[0]?.toUpperCase()}
                            </div>
                          )}
                          {c.unread_count > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold text-foreground">
                              {c.other_display_name || c.other_username || "User"}
                            </p>
                            <span className="shrink-0 text-[9px] text-muted-foreground">
                              {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                            </span>
                          </div>
                          <p
                            className={`truncate text-[11px] ${
                              c.unread_count > 0 ? "font-semibold text-foreground/85" : "text-muted-foreground"
                            }`}
                          >
                            {c.last_message_preview || "—"}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
