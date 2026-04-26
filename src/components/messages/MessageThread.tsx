import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useThread, addConversationMember } from "@/hooks/useMessages";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";
import OOTDBackground, {
  loadOOTDBgTheme,
  loadOOTDBgRealistic,
  type OOTDBgTheme,
} from "@/components/ootd/OOTDBackground";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  conversationId: string;
  otherUserId: string | null; // null when this is a group conversation
  isGroup?: boolean;
  groupTitle?: string | null;
  onBack: () => void;
}

interface ProfileLite {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

/**
 * Full chat thread view — works for 1:1 and group conversations.
 * Header shows the other user (1:1) or the group title + member avatars (group).
 */
export default function MessageThread({
  conversationId,
  otherUserId,
  isGroup,
  groupTitle,
  onBack,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, sendMessage } = useThread(conversationId);
  const [participants, setParticipants] = useState<ProfileLite[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<ProfileLite[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mirror the user's OOTD background preference inside the chat thread.
  const [bgTheme, setBgTheme] = useState<OOTDBgTheme>(() => loadOOTDBgTheme());
  const [bgRealistic, setBgRealistic] = useState<boolean>(() => loadOOTDBgRealistic());
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("ootd_bg_theme, ootd_bg_realistic")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.ootd_bg_theme) setBgTheme(data.ootd_bg_theme as OOTDBgTheme);
        if (typeof data.ootd_bg_realistic === "boolean") setBgRealistic(data.ootd_bg_realistic);
      });
  }, [user]);

  // Load member profiles (group) or the other user (1:1)
  useEffect(() => {
    (async () => {
      if (otherUserId && !isGroup) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .eq("user_id", otherUserId)
          .maybeSingle();
        setParticipants(data ? [data as ProfileLite] : []);
        return;
      }
      // group: fetch participants
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);
      const ids = (parts || []).map((p: any) => p.user_id);
      if (ids.length === 0) {
        setParticipants([]);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      setParticipants((profiles as ProfileLite[]) || []);
    })();
  }, [otherUserId, isGroup, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Search for users to add to group
  useEffect(() => {
    if (!showAdd || !addQuery.trim()) {
      setAddResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${addQuery.trim()}%,display_name.ilike.%${addQuery.trim()}%`)
        .limit(10);
      if (cancelled) return;
      const have = new Set(participants.map((p) => p.user_id));
      setAddResults(((data as ProfileLite[]) || []).filter((p) => !have.has(p.user_id)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addQuery, showAdd, participants]);

  const handleSend = async (content: string, taggedUserIds: string[], attachments: any[]) => {
    // For group rooms recipient is null; for 1:1 it's the other user
    await sendMessage(otherUserId, content, taggedUserIds, attachments);
  };

  const addMember = async (u: ProfileLite) => {
    const ok = await addConversationMember(conversationId, u.user_id);
    if (ok) {
      setParticipants((prev) =>
        prev.some((p) => p.user_id === u.user_id) ? prev : [...prev, u],
      );
      setAddQuery("");
      setAddResults([]);
      toast.success(`Added @${u.username}`);
    } else {
      toast.error("Could not add user");
    }
  };

  const others = participants.filter((p) => p.user_id !== user?.id);
  const headerTitle = isGroup
    ? groupTitle ||
      others
        .slice(0, 3)
        .map((p) => p.display_name || p.username || "User")
        .join(", ") +
      (others.length > 3 ? ` +${others.length - 3}` : "")
    : others[0]?.display_name || others[0]?.username || "User";

  const headerSubtitle = isGroup
    ? `${participants.length} members`
    : others[0]?.username
    ? `@${others[0].username}`
    : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border/30 bg-background/40 shadow-soft">
      {/* OOTD background — mirrors the user's My-Page personalization */}
      {bgTheme !== "none" && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl">
          <OOTDBackground theme={bgTheme} realistic={bgRealistic} contained />
          {/* Soft scrim so chat text stays legible on busy backgrounds */}
          <div className="absolute inset-0 bg-background/55 backdrop-blur-[2px]" />
        </div>
      )}
      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 border-b border-border/20 bg-card/50 backdrop-blur-sm px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => {
            if (!isGroup && otherUserId) navigate(`/user/${otherUserId}`);
          }}
          className="flex flex-1 items-center gap-3 text-left"
        >
          {isGroup ? (
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-foreground/10">
              <Users className="h-4 w-4 text-foreground/70" />
            </div>
          ) : (
            <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
              {others[0]?.avatar_url ? (
                <img src={others[0].avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                  {(others[0]?.display_name || others[0]?.username || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-foreground">{headerTitle}</p>
            {headerSubtitle && (
              <p className="truncate text-[10px] text-muted-foreground">{headerSubtitle}</p>
            )}
          </div>
        </button>

        {isGroup && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              showAdd
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-label="Add member"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Add-member tray (group only) */}
      {isGroup && showAdd && (
        <div className="relative z-10 border-b border-border/20 bg-card/40 backdrop-blur-sm p-3">
          <input
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Add by username or name…"
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          {addResults.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
              {addResults.map((u) => (
                <li key={u.user_id}>
                  <button
                    onClick={() => addMember(u)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-muted">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {(u.display_name || u.username || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold">
                        {u.display_name || u.username}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">@{u.username}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                      Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
          messages.map((m) => {
            const sender = participants.find((p) => p.user_id === m.sender_id);
            const isMine = m.sender_id === user?.id;
            return (
              <div key={m.id}>
                {isGroup && !isMine && sender && (
                  <p className="mb-0.5 ml-11 text-[10px] font-semibold text-muted-foreground">
                    {sender.display_name || sender.username || "User"}
                  </p>
                )}
                <MessageBubble
                  id={m.id}
                  content={m.content}
                  isMine={isMine}
                  createdAt={m.created_at}
                  readAt={m.read_at}
                  attachments={(m.attachments as any[]) || []}
                />
              </div>
            );
          })
        )}
      </div>

      <MessageComposer onSend={handleSend} />
    </div>
  );
}
