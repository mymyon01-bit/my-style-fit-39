import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera } from "lucide-react";
import SafeImage from "@/components/SafeImage";

const AdminOOTD = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("ootd_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { setPosts(data || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">OOTD Posts</h1>
        <span className="text-[11px] text-foreground/75">{posts.length} posts</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-4 w-4 animate-spin text-foreground/75" /></div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Camera className="mx-auto h-8 w-8 text-foreground/70" />
          <p className="text-[13px] text-foreground/70">No OOTD posts yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {posts.map(post => (
            <div key={post.id} className="rounded-xl border border-border/20 bg-card/30 overflow-hidden">
              <SafeImage
                src={post.image_url}
                alt={post.caption || "OOTD"}
                className="aspect-square w-full object-cover"
                fallbackClassName="aspect-square w-full"
              />
              <div className="p-3 space-y-1">
                <p className="text-[11px] text-foreground/75 truncate">{post.caption || "No caption"}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-foreground/70">⭐ {post.star_count || 0}</span>
                  <span className="text-[10px] text-foreground/70">{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                {post.topics?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {post.topics.map((t: string) => (
                      <span key={t} className="text-[9px] text-accent/60">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOOTD;
