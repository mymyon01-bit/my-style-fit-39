import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Subscribe to all incoming messages for the signed-in user and pop a sonner
 * toast as soon as one arrives, so the user sees a "you have a new message"
 * indicator without needing to reload or even open the inbox.
 *
 * - Only fires for messages whose sender is NOT the current user.
 * - Looks up the sender's display_name / avatar to make the toast feel personal.
 * - Tapping the toast navigates the user to the OOTD My Page where the
 *   mailbox lives.
 */
export function useMessageToasts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Track which message ids we've already toasted so we don't double-fire if
  // realtime delivers the same row twice (which can happen on reconnect).
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`msg-toast-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload: any) => {
          const row = payload?.new;
          if (!row || !row.id) return;
          // Only notify for messages addressed to me where I'm not the sender.
          if (row.sender_id === user.id) return;
          // recipient_id is null for group chats — fall back to checking
          // participation via the conversation_id.
          if (row.recipient_id && row.recipient_id !== user.id) {
            // Not my 1:1 — but might still be a group I'm in. Check participation.
            const { data: part } = await supabase
              .from("conversation_participants")
              .select("id")
              .eq("conversation_id", row.conversation_id)
              .eq("user_id", user.id)
              .maybeSingle();
            if (!part) return;
          }
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);

          // Look up the sender for a nicer toast title.
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("user_id", row.sender_id)
            .maybeSingle();
          const name =
            profile?.display_name || profile?.username || "새 메시지";
          const preview =
            (typeof row.content === "string" && row.content.trim().slice(0, 80)) ||
            "사진 또는 첨부파일을 보냈어요";

          toast(`${name}님이 메시지를 보냈어요`, {
            description: preview,
            action: {
              label: "열기",
              onClick: () => navigate("/ootd?tab=mypage"),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
}
