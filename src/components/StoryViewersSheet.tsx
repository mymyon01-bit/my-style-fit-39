import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  storyId: string | null;
  onClose: () => void;
}

interface ViewerRow {
  viewer_id: string;
  viewed_at: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

/**
 * Bottom sheet shown when the story owner taps the "Seen by" affordance in
 * the viewer. Lists everyone who has opened this particular story so far.
 */
const StoryViewersSheet = ({ open, storyId, onClose }: Props) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ViewerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !storyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: views } = await supabase
        .from("story_views")
        .select("viewer_id, viewed_at")
        .eq("story_id", storyId)
        .order("viewed_at", { ascending: false });

      const list = (views || []) as { viewer_id: string; viewed_at: string }[];
      const ids = [...new Set(list.map((v) => v.viewer_id))];
      let profileMap: Record<string, { display_name: string | null; avatar_url: string | null; username: string | null }> = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, username")
          .in("user_id", ids);
        for (const p of profiles || []) {
          profileMap[(p as any).user_id] = {
            display_name: (p as any).display_name,
            avatar_url: (p as any).avatar_url,
            username: (p as any).username,
          };
        }
      }
      const merged: ViewerRow[] = list.map((v) => ({
        viewer_id: v.viewer_id,
        viewed_at: v.viewed_at,
        display_name: profileMap[v.viewer_id]?.display_name ?? null,
        avatar_url: profileMap[v.viewer_id]?.avatar_url ?? null,
        username: profileMap[v.viewer_id]?.username ?? null,
      }));
      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, storyId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border max-h-[85vh] sm:max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-foreground/60" />
                <h3 className="text-[13px] font-semibold tracking-[0.05em] text-foreground">
                  Seen by {rows.length}
                </h3>
              </div>
              <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-2 py-2">
              {loading ? (
                <div className="py-10 text-center text-[11px] text-foreground/40">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="py-10 text-center space-y-1">
                  <p className="text-[12px] text-foreground/55">No one has seen this story yet</p>
                  <p className="text-[10px] text-foreground/35">Viewers appear here as they open it</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {rows.map((r) => (
                    <li key={r.viewer_id}>
                      <button
                        onClick={() => {
                          onClose();
                          navigate(`/user/${r.viewer_id}`);
                        }}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/5 transition-colors text-left"
                      >
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-foreground/10 shrink-0">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[11px] font-medium text-foreground/55">
                              {(r.display_name || r.username || "?")[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">
                            {r.display_name || r.username || "User"}
                          </p>
                          {r.username && (
                            <p className="text-[10px] text-foreground/45 truncate">@{r.username}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-foreground/40 shrink-0">{relTime(r.viewed_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default StoryViewersSheet;
