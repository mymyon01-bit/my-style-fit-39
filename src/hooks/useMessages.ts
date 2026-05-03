import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ConversationSummary {
  id: string;
  is_group: boolean;
  title: string | null;
  other_user_id: string | null; // null for group rooms
  other_display_name: string | null;
  other_username: string | null;
  other_avatar_url: string | null;
  member_count: number;
  member_avatars: string[];
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
  recipient_id: string | null;
  content: string;
  tagged_user_ids: string[];
  attachments: ChatAttachmentRow[];
  read_at: string | null;
  created_at: string;
}

function buildConversationPreview(content: string, attachments: ChatAttachmentRow[]) {
  const trimmed = content.trim();
  if (trimmed) return trimmed.slice(0, 140);
  const firstAttachment = attachments[0];
  if (!firstAttachment) return "";
  if ((firstAttachment as any).type === "image") return "Photo";
  if ((firstAttachment as any).type === "file") return firstAttachment.name || "File";
  const metaName = (firstAttachment as any).meta?.name;
  return (metaName || firstAttachment.name || "Shared item").slice(0, 140);
}

/**
 * Hook: list all conversations for the current user (1:1 + group), with
 * profile data + unread counts. Live updates via realtime.
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

    // Find every conversation the user participates in (group or 1:1)
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    const convIds = Array.from(new Set((parts || []).map((p: any) => p.conversation_id)));

    // Also include legacy 1:1 rows where user_a/user_b match (in case backfill missed any)
    const { data: legacy } = await supabase
      .from("conversations")
      .select("id")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    (legacy || []).forEach((c: any) => {
      if (!convIds.includes(c.id)) convIds.push(c.id);
    });

    if (convIds.length === 0) {
      setConversations([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    const { data: convos } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, is_group, title, last_message_preview, last_message_at")
      .in("id", convIds)
      .order("last_message_at", { ascending: false });

    if (!convos || convos.length === 0) {
      setConversations([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    // Get all participants of these conversations
    const { data: allParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convos.map((c: any) => c.id));

    const partsByConv = new Map<string, string[]>();
    (allParts || []).forEach((p: any) => {
      const arr = partsByConv.get(p.conversation_id) || [];
      arr.push(p.user_id);
      partsByConv.set(p.conversation_id, arr);
    });

    // Collect every unique other-user id we need profiles for
    const otherIds = new Set<string>();
    convos.forEach((c: any) => {
      const ids = partsByConv.get(c.id) || [];
      // legacy fallback
      if (ids.length === 0) {
        if (c.user_a && c.user_a !== user.id) otherIds.add(c.user_a);
        if (c.user_b && c.user_b !== user.id) otherIds.add(c.user_b);
      }
      ids.filter((id) => id !== user.id).forEach((id) => otherIds.add(id));
    });

    const [{ data: profiles }, { data: unread }] = await Promise.all([
      otherIds.size > 0
        ? supabase
            .from("profiles")
            .select("user_id, display_name, username, avatar_url")
            .in("user_id", Array.from(otherIds))
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("messages")
        .select("conversation_id, sender_id")
        .in("conversation_id", convos.map((c: any) => c.id))
        .is("read_at", null)
        .neq("sender_id", user.id),
    ]);

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p));

    const unreadByConvo = new Map<string, number>();
    (unread || []).forEach((m: any) => {
      unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) || 0) + 1);
    });

    const summaries: ConversationSummary[] = convos.map((c: any) => {
      const memberIds = partsByConv.get(c.id) || [c.user_a, c.user_b].filter(Boolean);
      const others = memberIds.filter((id: string) => id !== user.id);
      const isGroup = !!c.is_group || others.length > 1;

      let other_user_id: string | null = null;
      let other_display_name: string | null = null;
      let other_username: string | null = null;
      let other_avatar_url: string | null = null;

      if (!isGroup && others[0]) {
        const profile = profileMap.get(others[0]) || {};
        other_user_id = others[0];
        other_display_name = profile.display_name ?? null;
        other_username = profile.username ?? null;
        other_avatar_url = profile.avatar_url ?? null;
      }

      const member_avatars = others
        .map((id: string) => profileMap.get(id)?.avatar_url)
        .filter(Boolean) as string[];

      return {
        id: c.id,
        is_group: isGroup,
        title: c.title ?? null,
        other_user_id,
        other_display_name,
        other_username,
        other_avatar_url,
        member_count: memberIds.length,
        member_avatars,
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

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { conversations, loading, totalUnread, reload: load };
}

/**
 * Hook: load + subscribe to messages for a single conversation (1:1 or group),
 * mark incoming messages as read while open.
 */
export function useThread(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const markRead = useCallback(async () => {
    if (!user || !conversationId) return;
    // For 1:1 (recipient_id set) — keep existing behavior
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("recipient_id", user.id)
      .is("read_at", null);
    // For groups (recipient_id null), mark anything not authored by me as read
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .is("recipient_id", null)
      .neq("sender_id", user.id)
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
        .limit(500);
      if (cancelled) return;
      setMessages(((data as unknown) as MessageRow[]) || []);
      setLoading(false);
      markRead();
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, markRead]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`thread-${conversationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = (payload.new as unknown) as MessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (user && row.sender_id !== user.id) {
            markRead();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, markRead]);

  /**
   * Send a message. For 1:1 conversations pass the recipient id; for group
   * conversations leave recipientId null.
   */
  const sendMessage = useCallback(
    async (
      recipientId: string | null,
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
      const created = (data as unknown) as MessageRow;
      await supabase
        .from("conversations")
        .update({
          last_message_at: created.created_at,
          last_message_preview: buildConversationPreview(created.content, created.attachments || []),
          updated_at: created.created_at,
        } as any)
        .eq("id", conversationId);
      setMessages((prev) =>
        prev.some((m) => m.id === created.id) ? prev : [...prev, created],
      );
      return created;
    },
    [user, conversationId],
  );

  /**
   * Unsend (delete) one of my own messages. Realtime will remove it from the
   * other participant's view as well.
   */
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user || !conversationId) return false;
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", user.id);
      if (error) {
        console.error("delete message failed", error);
        return false;
      }
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      return true;
    },
    [user, conversationId],
  );

  /**
   * Broadcast a "nudge" — the other participant's bubble for this message
   * shakes briefly. Uses Supabase Realtime broadcast (no DB writes).
   */
  const nudgeMessage = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      const channel = supabase.channel(`nudge-${conversationId}`);
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "nudge",
        payload: { messageId },
      });
      setTimeout(() => supabase.removeChannel(channel), 500);
    },
    [conversationId],
  );

  return { messages, loading, sendMessage, markRead, deleteMessage, nudgeMessage };
}

/** Subscribe to incoming nudges for a conversation. */
export function subscribeNudges(
  conversationId: string,
  onNudge: (messageId: string) => void,
) {
  const channel = supabase
    .channel(`nudge-${conversationId}`)
    .on("broadcast", { event: "nudge" }, (payload: any) => {
      const id = payload?.payload?.messageId;
      if (id) onNudge(id);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get-or-create a 1:1 conversation between the current user and another.
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

/**
 * Create a group conversation with multiple members.
 */
export async function createGroupConversation(
  title: string,
  memberIds: string[],
): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_group_conversation" as any, {
    _title: title,
    _member_ids: memberIds,
  });
  if (error) {
    console.error("create group failed", error);
    return null;
  }
  return (data as string) || null;
}

/**
 * Add a member to an existing group conversation.
 */
export async function addConversationMember(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase.rpc("add_conversation_member" as any, {
    _conv_id: conversationId,
    _user_id: userId,
  });
  if (error) {
    console.error("add member failed", error);
    return false;
  }
  return true;
}
