import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export interface StyleBoard {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  board_type: "archive" | "style_mix" | "inspiration" | "look";
  tags: string[];
  item_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StyleBoardItem {
  id: string;
  board_id: string;
  user_id: string;
  product_id: string | null;
  product_key: string | null;
  image_url: string | null;
  title: string | null;
  brand: string | null;
  notes: string | null;
  position: number;
  layout: Record<string, any>;
  created_at: string;
}

const SUGGESTED_BOARDS = [
  { title: "Save for Later", board_type: "archive" as const },
  { title: "Thinking About It", board_type: "archive" as const },
  { title: "Summer Fit Ideas", board_type: "inspiration" as const },
  { title: "Office Style", board_type: "look" as const },
  { title: "Minimal Looks", board_type: "inspiration" as const },
  { title: "Next Purchase", board_type: "archive" as const },
];

export function useStyleBoards() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<StyleBoard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setBoards([]); setLoading(false); return; }
    const { data } = await supabase
      .from("style_boards")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });
    setBoards((data || []) as StyleBoard[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const createBoard = useCallback(async (title: string, opts?: Partial<StyleBoard>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("style_boards")
      .insert({
        user_id: user.id,
        title,
        board_type: opts?.board_type || "archive",
        is_public: opts?.is_public ?? false,
        description: opts?.description ?? null,
        tags: opts?.tags ?? [],
      })
      .select()
      .single();
    if (!error) await load();
    return data as StyleBoard | null;
  }, [user, load]);

  const addItem = useCallback(async (boardId: string, item: Partial<StyleBoardItem>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("style_board_items")
      .insert({
        board_id: boardId,
        user_id: user.id,
        product_id: item.product_id ?? null,
        product_key: item.product_key ?? null,
        image_url: item.image_url ?? null,
        title: item.title ?? null,
        brand: item.brand ?? null,
        notes: item.notes ?? null,
      })
      .select()
      .single();
    if (!error) await load();
    return data as StyleBoardItem | null;
  }, [user, load]);

  const deleteBoard = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("style_boards").delete().eq("id", id).eq("user_id", user.id);
    await load();
  }, [user, load]);

  return { boards, loading, reload: load, createBoard, addItem, deleteBoard, SUGGESTED_BOARDS };
}

export function useBoardItems(boardId: string | null) {
  const [items, setItems] = useState<StyleBoardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!boardId) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("style_board_items")
      .select("*")
      .eq("board_id", boardId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data || []) as StyleBoardItem[]);
    setLoading(false);
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, reload: load };
}
