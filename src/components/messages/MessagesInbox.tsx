import { useState } from "react";
import { Loader2, MessageCircle, PenSquare, Users } from "lucide-react";
import { useConversations } from "@/hooks/useMessages";
import MessageThread from "./MessageThread";
import NewGroupChatDialog from "./NewGroupChatDialog";
import { formatDistanceToNow } from "date-fns";

interface ActiveThread {
  id: string;
  otherUserId: string | null;
  isGroup: boolean;
  groupTitle: string | null;
}

/**
 * Inbox section with conversation list (1:1 + group). Tapping a row opens
 * the thread view in place. The pencil button starts a new chat (1 person
 * → direct, multiple → group).
 */
export default function MessagesInbox() {
  const { conversations, loading, totalUnread } = useConversations();
  const [active, setActive] = useState<ActiveThread | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  if (active) {
    return (
      <MessageThread
        conversationId={active.id}
        otherUserId={active.otherUserId}
        isGroup={active.isGroup}
        groupTitle={active.groupTitle}
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
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:bg-foreground hover:text-background"
        >
          <PenSquare className="h-3 w-3" />
          New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/30 bg-card/30 py-10 text-center">
          <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-[12px] text-muted-foreground">No messages yet</p>
          <button
            onClick={() => setNewOpen(true)}
            className="mt-1 rounded-full bg-foreground px-4 py-1.5 text-[11px] font-bold text-background transition-opacity hover:opacity-90"
          >
            Start a chat
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-border/30 overflow-hidden rounded-2xl border border-border/30 bg-card/40">
          {conversations.map((c) => {
            const title = c.is_group
              ? c.title ||
                (c.member_count > 1 ? `Group · ${c.member_count}` : "Group chat")
              : c.other_display_name || c.other_username || "User";

            return (
              <li key={c.id}>
                <button
                  onClick={() =>
                    setActive({
                      id: c.id,
                      otherUserId: c.other_user_id,
                      isGroup: c.is_group,
                      groupTitle: c.title,
                    })
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {c.is_group ? (
                      <div className="flex h-full w-full items-center justify-center bg-foreground/10">
                        <Users className="h-4 w-4 text-foreground/70" />
                      </div>
                    ) : c.other_avatar_url ? (
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
                      <p className="truncate text-[13px] font-semibold text-foreground">{title}</p>
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
            );
          })}
        </ul>
      )}

      <NewGroupChatDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id, otherUserId) =>
          setActive({ id, otherUserId, isGroup: !otherUserId, groupTitle: null })
        }
      />
    </div>
  );
}
