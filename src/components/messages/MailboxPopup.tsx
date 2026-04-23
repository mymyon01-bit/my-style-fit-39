import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, X, GripHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useConversations } from "@/hooks/useMessages";
import MessageThread from "./MessageThread";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Anchor in viewport coords (top-right of mailbox icon). Used for initial position. */
  anchor?: { x: number; y: number } | null;
  initialConversationId?: string | null;
  initialOtherUserId?: string | null;
}

const POPUP_W = 340;
const POPUP_H = 460;

/**
 * Sticky-note style draggable Messages popup. Pops out near the mailbox icon
 * and can be dragged anywhere on screen — like a Post-it note. Esc or × closes.
 */
export default function MailboxPopup({
  open, onClose, anchor, initialConversationId, initialOtherUserId,
}: Props) {
  const { conversations, loading, totalUnread } = useConversations();
  const [active, setActive] = useState<{ id: string; otherUserId: string } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });

  // Reset thread when closed; preset thread when external request arrives
  useEffect(() => {
    if (open && initialConversationId && initialOtherUserId) {
      setActive({ id: initialConversationId, otherUserId: initialOtherUserId });
    }
    if (!open) setActive(null);
  }, [open, initialConversationId, initialOtherUserId]);

  // Initial position from the anchor — clamp to viewport
  useEffect(() => {
    if (!open) return;
    if (pos) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = anchor ? Math.min(anchor.x - POPUP_W + 32, vw - POPUP_W - 12) : vw - POPUP_W - 12;
    let y = anchor ? anchor.y + 12 : 80;
    x = Math.max(8, x);
    y = Math.max(8, Math.min(y, vh - POPUP_H - 8));
    setPos({ x, y });
  }, [open, anchor, pos]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, dragging: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.max(4, Math.min(e.clientX - dragRef.current.dx, vw - POPUP_W - 4));
    const y = Math.max(4, Math.min(e.clientY - dragRef.current.dy, vh - 80));
    setPos({ x, y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.dragging = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // Reset position when the popup is reopened in a new spot
  useEffect(() => { if (!open) setPos(null); }, [open]);

  return (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          key="mailbox-popup"
          initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: -1.2 }}
          exit={{ opacity: 0, scale: 0.92, rotate: -3 }}
          transition={{ type: "spring", damping: 22, stiffness: 320 }}
          style={{
            position: "fixed",
            top: pos.y,
            left: pos.x,
            width: POPUP_W,
            height: POPUP_H,
            zIndex: 120,
          }}
          className="select-none rounded-2xl border border-accent/20 bg-card shadow-elevated overflow-hidden flex flex-col"
        >
          {/* Drag handle bar — sticky-note tab look */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 px-3.5 py-2 bg-gradient-to-b from-accent/15 to-accent/[0.05] border-b border-accent/15"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="h-3 w-3 text-accent/60 shrink-0" />
              <MessageCircle className="h-3.5 w-3.5 text-accent/70 shrink-0" />
              <span className="text-[10px] font-semibold tracking-[0.22em] text-foreground/85 truncate">
                MAILBOX
              </span>
              {totalUnread > 0 && !active && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground leading-none">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => { if (active) setActive(null); else onClose(); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-foreground/45 hover:text-foreground transition-colors"
              aria-label="Close mailbox"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3">
            {active ? (
              <MessageThread
                conversationId={active.id}
                otherUserId={active.otherUserId}
                onBack={() => setActive(null)}
              />
            ) : loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageCircle className="h-7 w-7 text-foreground/20" />
                <p className="text-[12px] text-foreground/55">No messages yet</p>
                <p className="text-[10px] text-foreground/35 max-w-[220px]">
                  Open a profile and tap Message to start a chat
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/20 overflow-hidden rounded-xl border border-border/30 bg-card/40">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActive({ id: c.id, otherUserId: c.other_user_id })}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                        {c.other_avatar_url ? (
                          <img src={c.other_avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                            {(c.other_display_name || c.other_username || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                        {c.unread_count > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-accent-foreground">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] font-semibold text-foreground">
                            {c.other_display_name || c.other_username || "User"}
                          </p>
                          <span className="shrink-0 text-[9px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                          </span>
                        </div>
                        <p
                          className={`truncate text-[10.5px] ${
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
