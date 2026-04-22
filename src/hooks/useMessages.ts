import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ConversationSummary {
  id: string;
  other_user_id: string;
  other_display_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface ChatAttachmentRow {
  url: string;
  type: "image" | "file";
  name?: string;
  size?: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  tagged_user_ids: string[];
  attachments: ChatAttachmentRow[];
  read_at: string | null;
  created_at: string;
}

/**
 * Hook: list all conversations for the current user, with the other
 * participant's profile data and unread counts. Updates in realtime.
 */
export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: convos } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, last_message_preview, last_message_at")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (!convos || convos.length === 0) {
      setConversations([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    const otherIds = convos.map((c: any) => (c.user_a === user.id ? c.user_b : c.user_a));

    const [{ data: profiles }, { data: unread }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", otherIds),
      supabase
        .from("messages")
        .select("conversation_id")
        .eq("recipient_id", user.id)
        .is("read_at", null),
    ]);

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const unreadByConvo = new Map<string, number>();
    (unread || []).forEach((m: any) => {
      unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) || 0) + 1);
    });

    const summaries: ConversationSummary[] = convos.map((c: any) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const profile = profileMap.get(otherId) || {};
      return {
        id: c.id,
        other_user_id: otherId,
        other_display_name: profile.display_name ?? null,
        other_username: profile.username ?? null,
        other_avatar_url: profile.avatar_url ?? null,
        last_message_preview: c.last_message_preview ?? null,
        last_message_at: c.last_message_at,
        unread_count: unreadByConvo.get(c.id) || 0,
      };
    });

    setConversations(summaries);
    setTotalUnread(Array.from(unreadByConvo.values()).reduce((a, b) => a + b, 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh whenever a message arrives or a conversation updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { conversations, loading, totalUnread, reload: load };
}

/**
 * Hook: load + subscribe to messages for a single conversation, and mark
 * incoming messages as read while the thread is open.
 */
export function useThread(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const markRead = useCallback(async () => {
    if (!user || !conversationId) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("recipient_id", user.id)
      .is("read_at", null);
  }, [user, conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setMessages(((data as unknown) as MessageRow[]) || []);
      setLoading(false);
      markRead();
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, markRead]);

  // Realtime subscribe to new messages on this conversation
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (user && row.recipient_id === user.id) {
            markRead();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, markRead]);

  const sendMessage = useCallback(
    async (
      recipientId: string,
      content: string,
      taggedUserIds: string[] = [],
      attachments: ChatAttachmentRow[] = [],
    ) => {
      if (!user || !conversationId) return null;
      if (!content.trim() && attachments.length === 0) return null;
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          recipient_id: recipientId,
          content: content.trim(),
          tagged_user_ids: taggedUserIds,
          attachments: attachments as any,
        } as any)
        .select()
        .single();
      if (error) {
        console.error("send message failed", error);
        return null;
      }
      setMessages((prev) =>
        prev.some((m) => m.id === (data as any).id) ? prev : [...prev, (data as unknown) as MessageRow],
      );
      return (data as unknown) as MessageRow;
    },
    [user, conversationId],
  );

  return { messages, loading, sendMessage, markRead };
}

/**
 * Helper: get-or-create a conversation between the current user and another.
 * Returns the conversation id (uuid) or null on failure.
 */
export async function openConversationWith(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_or_create_conversation" as any, {
    _other_user: otherUserId,
  });
  if (error) {
    console.error("open conversation failed", error);
    return null;
  }
  return (data as string) || null;
}
