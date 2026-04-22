import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { useConversations } from "@/hooks/useMessages";
import MessageThread from "./MessageThread";
import { formatDistanceToNow } from "date-fns";

/**
 * Inbox section embeddable inside the user's My Page. Shows conversation list;
 * tapping a conversation opens the full thread view in place.
 */
export default function MessagesInbox() {
  const { conversations, loading, totalUnread } = useConversations();
  const [active, setActive] = useState<{ id: string; otherUserId: string } | null>(null);

  if (active) {
    return (
      <MessageThread
        conversationId={active.id}
        otherUserId={active.otherUserId}
        onBack={() => setActive(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">
          MESSAGES
          {totalUnread > 0 && (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">
              {totalUnread}
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/30 bg-card/30 py-10 text-center">
          <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-[12px] text-muted-foreground">No messages yet</p>
          <p className="text-[10px] text-muted-foreground/70">
            Open a profile and tap Message to start a chat
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/30 overflow-hidden rounded-2xl border border-border/30 bg-card/40">
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
  );
}
