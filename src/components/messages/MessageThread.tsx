import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useThread } from "@/hooks/useMessages";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import { useNavigate } from "react-router-dom";

interface Props {
  conversationId: string;
  otherUserId: string;
  onBack: () => void;
}

interface OtherProfile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

/**
 * Full chat thread view: header with the other participant, scrollable message
 * list, and composer with @ mention support.
 */
export default function MessageThread({ conversationId, otherUserId, onBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, sendMessage } = useThread(conversationId);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", otherUserId)
        .maybeSingle();
      setOther((data as OtherProfile) || null);
    })();
  }, [otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async (content: string, taggedUserIds: string[], attachments: any[]) => {
    await sendMessage(otherUserId, content, taggedUserIds, attachments);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-foreground/15 bg-background shadow-soft">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 bg-card/60 px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate(`/user/${otherUserId}`)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
            {other?.avatar_url ? (
              <img src={other.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                {(other?.display_name || other?.username || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {other?.display_name || other?.username || "User"}
            </p>
            {other?.username && (
              <p className="truncate text-[10px] text-muted-foreground">@{other.username}</p>
            )}
          </div>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-[12px] text-muted-foreground">
            No messages yet. Say hi 👋
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              content={m.content}
              isMine={m.sender_id === user?.id}
              createdAt={m.created_at}
              readAt={m.read_at}
              attachments={(m.attachments as any[]) || []}
            />
          ))
        )}
      </div>

      <MessageComposer onSend={handleSend} />
    </div>
  );
}
