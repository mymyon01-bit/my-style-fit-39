import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Wave {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_by: string;
  is_private: boolean;
  member_count: number;
  created_at: string;
  role?: "owner" | "admin" | "member";
}

export interface WaveMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

export interface WaveInvite {
  id: string;
  wave_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  message: string | null;
  created_at: string;
  wave?: Pick<Wave, "id" | "name" | "cover_image_url"> | null;
  inviter?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

/** Hook: list waves the current user belongs to. */
export function useMyWaves() {
  const { user } = useAuth();
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setWaves([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: memberships } = await supabase
      .from("wave_members")
      .select("role, wave_id, waves(*)")
      .eq("user_id", user.id);
    const list: Wave[] = (memberships ?? [])
      .map((m: any) => m.waves ? { ...m.waves, role: m.role } : null)
      .filter(Boolean) as Wave[];
    list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setWaves(list);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { waves, loading, refresh };
}

/** Hook: pending invites for the current user. */
export function usePendingWaveInvites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<WaveInvite[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setInvites([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("wave_invites")
      .select("*, waves:wave_id(id, name, cover_image_url)")
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const inviterIds = Array.from(new Set((data ?? []).map((d: any) => d.inviter_id)));
    let inviterMap = new Map<string, any>();
    if (inviterIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", inviterIds);
      (profs ?? []).forEach((p: any) => inviterMap.set(p.user_id, p));
    }
    setInvites(((data ?? []) as any[]).map((d) => ({
      ...d,
      wave: d.waves ?? null,
      inviter: inviterMap.get(d.inviter_id) ?? null,
    })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { invites, loading, refresh };
}

/** Create a new wave. Caller becomes owner via DB trigger. */
export async function createWave(input: {
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_private?: boolean;
}): Promise<Wave> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("waves")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      cover_image_url: input.cover_image_url ?? null,
      is_private: input.is_private ?? true,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Wave;
}

/** Invite a registered user to a wave. Triggers an in-app notification. */
export async function inviteToWave(waveId: string, inviteeId: string, message?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("wave_invites")
    .upsert({
      wave_id: waveId,
      inviter_id: user.id,
      invitee_id: inviteeId,
      message: message ?? null,
      status: "pending",
    }, { onConflict: "wave_id,invitee_id" });
  if (error) throw error;
}

/** Send a DM with a join-link to a non-circle user. */
export async function sendWaveInviteDM(waveId: string, recipientId: string, waveName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  // Get-or-create 1:1 conversation
  const { data: convId, error: convErr } = await supabase
    .rpc("get_or_create_conversation", { _other_user: recipientId });
  if (convErr) throw convErr;
  // Also send a formal invite
  await inviteToWave(waveId, recipientId);
  const { error } = await supabase.from("messages").insert({
    conversation_id: convId,
    sender_id: user.id,
    recipient_id: recipientId,
    content: `🌊 You're invited to join the wave "${waveName}". Tap your inbox to accept.`,
  });
  if (error) throw error;
}

export async function acceptWaveInvite(inviteId: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_wave_invite", { _invite_id: inviteId });
  if (error) throw error;
  return data as string;
}

export async function declineWaveInvite(inviteId: string) {
  const { error } = await supabase.rpc("decline_wave_invite", { _invite_id: inviteId });
  if (error) throw error;
}

export async function leaveWave(waveId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("wave_members")
    .delete()
    .eq("wave_id", waveId)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function shareOOTDToWave(waveId: string, postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("wave_posts")
    .upsert({ wave_id: waveId, post_id: postId, shared_by: user.id }, {
      onConflict: "wave_id,post_id",
    });
  if (error) throw error;
}

export async function fetchWaveMembers(waveId: string): Promise<WaveMember[]> {
  const { data: members } = await supabase
    .from("wave_members")
    .select("user_id, role, joined_at")
    .eq("wave_id", waveId)
    .order("joined_at", { ascending: true });
  if (!members?.length) return [];
  const userIds = members.map((m: any) => m.user_id);
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .in("user_id", userIds);
  const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
  return members.map((m: any) => ({ ...m, ...(profMap.get(m.user_id) ?? {}) }));
}

export async function fetchWaveFeed(waveId: string) {
  const { data } = await supabase
    .from("wave_posts")
    .select("post_id, shared_by, shared_at, ootd_posts:post_id(*)")
    .eq("wave_id", waveId)
    .order("shared_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((r: any) => r.ootd_posts).filter(Boolean);
}

/** Fetch the user's circle (followings) — used for inviting friends. */
export async function fetchMyCircle() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: rows } = await supabase
    .from("circles")
    .select("following_id")
    .eq("follower_id", user.id);
  const ids = (rows ?? []).map((r: any) => r.following_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .in("user_id", ids);
  return profs ?? [];
}

/** Search users by username/display name to invite. */
export async function searchUsersForInvite(query: string) {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, username, avatar_url")
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(15);
  return data ?? [];
}
