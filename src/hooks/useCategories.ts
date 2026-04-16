import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  icon: string | null;
  children?: Category[];
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tree, setTree] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("product_categories")
      .select("*")
      .order("sort_order");
    const cats = (data || []) as Category[];
    setCategories(cats);
    setTree(buildTree(cats));
    setLoading(false);
  };

  return { categories, tree, loading, reload: loadCategories };
}

function buildTree(cats: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];
  cats.forEach(c => map.set(c.id, { ...c, children: [] }));
  cats.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}
