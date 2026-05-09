import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type WaveModuleKind = "photos" | "board" | "wardrobe" | "poll" | "anon_board";

export interface WaveModule {
  id: string;
  wave_id: string;
  kind: WaveModuleKind;
  label: string;
  position: number;
  created_at: string;
}

export interface WavePost {
  id: string;
  wave_id: string;
  module_id: string;
  author_id: string;
  kind: "photo" | "text" | "wardrobe_item" | "poll" | "anon";
  title: string | null;
  body: string | null;
  image_urls: string[] | null;
  metadata: any;
  is_anonymous: boolean;
  like_count: number;
  dislike_count: number;
  meh_count: number;
  comment_count: number;
  created_at: string;
  author?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  my_reaction?: "like" | "dislike" | "meh" | null;
}

export interface WaveComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  author?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  liked_by_me?: boolean;
}

/** List modules of a wave. */
export function useWaveModules(waveId: string | null) {
  const [modules, setModules] = useState<WaveModule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!waveId) { setModules([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("wave_modules" as any)
      .select("*")
      .eq("wave_id", waveId)
      .order("position", { ascending: true });
    setModules((data ?? []) as any);
    setLoading(false);
  }, [waveId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { modules, loading, refresh };
}

export async function createWaveModule(waveId: string, kind: WaveModuleKind, label: string, position: number) {
  const { data, error } = await supabase
    .from("wave_modules" as any)
    .insert({ wave_id: waveId, kind, label: label.trim(), position })
    .select("*").single();
  if (error) throw error;
  return data as any as WaveModule;
}

export async function renameWaveModule(moduleId: string, label: string) {
  const { error } = await supabase
    .from("wave_modules" as any)
    .update({ label: label.trim() })
    .eq("id", moduleId);
  if (error) throw error;
}

export async function deleteWaveModule(moduleId: string) {
  const { error } = await supabase
    .from("wave_modules" as any)
    .delete()
    .eq("id", moduleId);
  if (error) throw error;
}

/** Posts within a module. */
export function useWavePosts(moduleId: string | null) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<WavePost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!moduleId) { setPosts([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("wave_module_posts" as any)
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false })
      .limit(80);
    const raw = (data ?? []) as any[];
    const authorIds = Array.from(new Set(raw.filter(p => !p.is_anonymous).map(p => p.author_id)));
    let amap = new Map<string, any>();
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", authorIds);
      (profs ?? []).forEach((p: any) => amap.set(p.user_id, p));
    }
    let myReactions = new Map<string, "like" | "dislike" | "meh">();
    if (user && raw.length) {
      const { data: rs } = await supabase
        .from("wave_post_reactions" as any)
        .select("post_id, reaction")
        .in("post_id", raw.map(p => p.id))
        .eq("user_id", user.id);
      (rs ?? []).forEach((r: any) => myReactions.set(r.post_id, r.reaction));
    }
    setPosts(raw.map(p => ({
      ...p,
      author: p.is_anonymous ? null : (amap.get(p.author_id) ?? null),
      my_reaction: myReactions.get(p.id) ?? null,
    })));
    setLoading(false);
  }, [moduleId, user?.id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { posts, loading, refresh };
}

export async function createWavePost(input: {
  wave_id: string;
  module_id: string;
  kind: WavePost["kind"];
  title?: string | null;
  body?: string | null;
  image_urls?: string[];
  metadata?: any;
  is_anonymous?: boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("wave_module_posts" as any)
    .insert({
      ...input,
      author_id: user.id,
      image_urls: input.image_urls ?? [],
      metadata: input.metadata ?? {},
      is_anonymous: input.is_anonymous ?? false,
      title: input.title ?? null,
      body: input.body ?? null,
    })
    .select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteWavePost(postId: string) {
  const { error } = await supabase.from("wave_module_posts" as any).delete().eq("id", postId);
  if (error) throw error;
}

export async function setWaveReaction(postId: string, reaction: "like" | "dislike" | "meh" | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  // Always delete previous, then insert new (UNIQUE per post,user)
  await supabase.from("wave_post_reactions" as any)
    .delete().eq("post_id", postId).eq("user_id", user.id);
  if (!reaction) return;
  const { error } = await supabase.from("wave_post_reactions" as any)
    .insert({ post_id: postId, user_id: user.id, reaction });
  if (error) throw error;
}

/** Comments. */
export function useWaveComments(postId: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<WaveComment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!postId) { setComments([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("wave_post_comments" as any)
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const raw = (data ?? []) as any[];
    const ids = Array.from(new Set(raw.map(c => c.user_id)));
    let amap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids);
      (profs ?? []).forEach((p: any) => amap.set(p.user_id, p));
    }
    let likedSet = new Set<string>();
    if (user && raw.length) {
      const { data: ls } = await supabase
        .from("wave_comment_likes" as any)
        .select("comment_id")
        .in("comment_id", raw.map(c => c.id))
        .eq("user_id", user.id);
      (ls ?? []).forEach((r: any) => likedSet.add(r.comment_id));
    }
    setComments(raw.map(c => ({
      ...c, author: amap.get(c.user_id) ?? null, liked_by_me: likedSet.has(c.id),
    })));
    setLoading(false);
  }, [postId, user?.id]);

  useEffect(() => { refresh(); }, [refresh]);
  return { comments, loading, refresh };
}

export async function addWaveComment(postId: string, body: string, parentId?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  const { error } = await supabase.from("wave_post_comments" as any).insert({
    post_id: postId, user_id: user.id, parent_id: parentId ?? null, body: body.trim(),
  });
  if (error) throw error;
}

export async function deleteWaveComment(commentId: string) {
  const { error } = await supabase.from("wave_post_comments" as any).delete().eq("id", commentId);
  if (error) throw error;
}

export async function toggleWaveCommentLike(commentId: string, currentlyLiked: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  if (currentlyLiked) {
    await supabase.from("wave_comment_likes" as any)
      .delete().eq("comment_id", commentId).eq("user_id", user.id);
  } else {
    await supabase.from("wave_comment_likes" as any)
      .insert({ comment_id: commentId, user_id: user.id });
  }
}

/** Poll vote. */
export async function castWavePollVote(postId: string, optionIndex: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("not_authenticated");
  await supabase.from("wave_poll_votes" as any)
    .delete().eq("post_id", postId).eq("user_id", user.id);
  const { error } = await supabase.from("wave_poll_votes" as any)
    .insert({ post_id: postId, user_id: user.id, option_index: optionIndex });
  if (error) throw error;
}

export async function fetchWavePollVotes(postId: string) {
  const { data } = await supabase.from("wave_poll_votes" as any)
    .select("user_id, option_index").eq("post_id", postId);
  return (data ?? []) as any as { user_id: string; option_index: number }[];
}

/** Convenience: does the current user own a wave already? */
export async function fetchMyOwnedWave(): Promise<{ id: string; name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("waves")
    .select("id, name")
    .eq("created_by", user.id)
    .limit(1)
    .maybeSingle();
  return (data as any) ?? null;
}
