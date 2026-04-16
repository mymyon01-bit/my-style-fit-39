import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export interface SavedFolder {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  itemCount?: number;
}

const DEFAULT_FOLDERS = [
  { name: "Saved Looks", slug: "saved-looks", icon: "sparkles", sort_order: 0 },
  { name: "Clothes", slug: "clothes", icon: "shirt", sort_order: 1 },
  { name: "Accessories", slug: "accessories", icon: "gem", sort_order: 2 },
  { name: "Bags", slug: "bags", icon: "shopping-bag", sort_order: 3 },
  { name: "Wallets", slug: "wallets", icon: "wallet", sort_order: 4 },
  { name: "Shoes", slug: "shoes", icon: "footprints", sort_order: 5 },
  { name: "Wishlist", slug: "wishlist", icon: "heart", sort_order: 6 },
  { name: "OOTD References", slug: "ootd-references", icon: "camera", sort_order: 7 },
];

export function useSavedFolders() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFolders = useCallback(async () => {
    if (!user) { setFolders([]); setLoading(false); return; }
    const { data } = await supabase
      .from("saved_folders")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order");
    
    if (!data || data.length === 0) {
      // Create default folders
      const inserts = DEFAULT_FOLDERS.map(f => ({ ...f, user_id: user.id }));
      await supabase.from("saved_folders").insert(inserts);
      const { data: created } = await supabase
        .from("saved_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order");
      setFolders(created || []);
    } else {
      setFolders(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  return { folders, loading, reload: loadFolders };
}
