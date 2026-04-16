import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Package, Camera, Star, FolderTree, Bookmark } from "lucide-react";

interface Stats {
  users: number;
  products: number;
  categories: number;
  ootdPosts: number;
  savedItems: number;
  interactions: number;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<Stats>({ users: 0, products: 0, categories: 0, ootdPosts: 0, savedItems: 0, interactions: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("product_categories").select("id", { count: "exact", head: true }),
      supabase.from("ootd_posts").select("id", { count: "exact", head: true }),
      supabase.from("saved_items").select("id", { count: "exact", head: true }),
      supabase.from("interactions").select("id", { count: "exact", head: true }),
    ]).then(([u, p, c, o, s, i]) => {
      setStats({
        users: u.count || 0,
        products: p.count || 0,
        categories: c.count || 0,
        ootdPosts: o.count || 0,
        savedItems: s.count || 0,
        interactions: i.count || 0,
      });
    });
  }, []);

  const cards = [
    { label: "Users", value: stats.users, icon: Users },
    { label: "Products", value: stats.products, icon: Package },
    { label: "Categories", value: stats.categories, icon: FolderTree },
    { label: "OOTD Posts", value: stats.ootdPosts, icon: Camera },
    { label: "Saved Items", value: stats.savedItems, icon: Bookmark },
    { label: "Interactions", value: stats.interactions, icon: Star },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-display text-foreground/80">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(card => (
          <div key={card.label} className="rounded-xl bg-card/50 border border-border/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <card.icon className="h-4 w-4 text-accent/60" />
              <span className="text-[10px] tracking-[0.1em] text-foreground/50 uppercase">{card.label}</span>
            </div>
            <p className="text-2xl font-light text-foreground/80">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
