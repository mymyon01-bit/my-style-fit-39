import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

/**
 * Curated Style Stream — replaces the flat OOTD feed with editorial rails
 * grouped by silhouette / aesthetic. Pulls posts from `ootd_posts` filtered
 * by `style_tags` / `topics`. No schema changes.
 */
const STREAMS: { label: string; tags: string[] }[] = [
  { label: "Relaxed Minimal", tags: ["minimal", "relaxed", "neutral"] },
  { label: "Oversized Street", tags: ["oversized", "street", "streetwear"] },
  { label: "Smart Casual", tags: ["smart casual", "smart-casual", "office"] },
  { label: "Korean Casual", tags: ["korean", "k-casual", "k-style"] },
  { label: "Tailored Monochrome", tags: ["tailored", "monochrome", "mono"] },
  { label: "Vintage Archive", tags: ["vintage", "archive", "retro"] },
  { label: "Technical Outerwear", tags: ["technical", "gorpcore", "outerwear"] },
];

interface PostLite {
  id: string;
  image_url: string;
  caption: string | null;
  user_id: string;
  style_tags: string[] | null;
}

interface Props {
  onOpen: (postId: string) => void;
}

export default function CuratedStyleStream({ onOpen }: Props) {
  const [groups, setGroups] = useState<{ label: string; posts: PostLite[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ootd_posts")
        .select("id, image_url, caption, user_id, style_tags, topics, occasion_tags, star_count, created_at")
        .order("star_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(400);
      const all = (data || []) as any[];

      const result = STREAMS.map(({ label, tags }) => {
        const matches = all.filter((p) => {
          const haystack = [
            ...(p.style_tags || []),
            ...(p.topics || []),
            ...(p.occasion_tags || []),
          ].map((t: string) => (t || "").toLowerCase());
          return tags.some((tg) => haystack.some((h) => h.includes(tg)));
        }).slice(0, 8);
        return { label, posts: matches };
      }).filter((g) => g.posts.length >= 2);

      if (!cancelled) { setGroups(result); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-40 bg-foreground/[0.06] rounded animate-pulse" />
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="aspect-[3/4] w-32 shrink-0 rounded-lg bg-foreground/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) return null;

  return (
    <div className="space-y-7">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-semibold tracking-[0.28em] text-foreground/65">CURATED STYLE STREAM</h2>
        <span className="text-[9px] tracking-[0.22em] text-foreground/35">BY SILHOUETTE</span>
      </div>
      {groups.map((g) => (
        <section key={g.label} className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-serif text-[15px] tracking-tight text-foreground/90">{g.label}</h3>
            <span className="text-[9px] tracking-[0.22em] text-foreground/35">{g.posts.length} LOOKS</span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide snap-x">
            {g.posts.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="relative aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-lg bg-foreground/[0.04] snap-start group"
              >
                <img
                  src={p.image_url}
                  alt={p.caption || g.label}
                  loading="lazy"
                  className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-1.5">
                  <span className="text-[9px] tracking-[0.18em] text-white/80 uppercase">{g.label}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
