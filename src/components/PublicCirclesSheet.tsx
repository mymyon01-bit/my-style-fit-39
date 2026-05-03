/**
 * PublicCirclesSheet — read-only viewer for any user's Circle (people they
 * follow) or Ripple (people who follow them).
 *
 * Privacy rule: rows whose profile is marked `is_private = true` are still
 * shown, but their avatar/name are masked unless the viewer is already in
 * their circle. Tapping a public profile opens it inside the OOTD modal so
 * the desktop "card pop-out" experience stays consistent.
 */
import { useEffect, useState } from "react";
import { X, Loader2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOOTDModal } from "@/lib/ootdModal";

type Tab = "circle" | "ripple";

interface Props {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  targetDisplayName?: string | null;
  initialTab?: Tab;
}

interface Row {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_private: boolean;
  viewerFollows: boolean;
}

const PublicCirclesSheet = ({ open, onClose, targetUserId, targetDisplayName, initialTab = "circle" }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { open: openOOTDModal } = useOOTDModal();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  useEffect(() => {
    if (!open || !targetUserId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Circle = people targetUser follows (follower_id = target).
        // Ripple = people who follow targetUser (following_id = target).
        const col = tab === "circle" ? "following_id" : "follower_id";
        const filterCol = tab === "circle" ? "follower_id" : "following_id";
        const { data: links } = await supabase
          .from("circles")
          .select(col)
          .eq(filterCol, targetUserId);

        const ids = Array.from(new Set((links || []).map((l: any) => l[col]).filter(Boolean)));
        if (ids.length === 0) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }

        const [profilesRes, viewerFollowsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, avatar_url, is_private").in("user_id", ids),
          user
            ? supabase.from("circles").select("following_id").eq("follower_id", user.id).in("following_id", ids)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const followsSet = new Set((viewerFollowsRes.data || []).map((r: any) => r.following_id));

        const built: Row[] = (profilesRes.data || []).map((p: any) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          is_private: !!p.is_private,
          viewerFollows: followsSet.has(p.user_id),
        }));

        if (!cancelled) setRows(built);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, targetUserId, tab, user]);

  if (!open) return null;

  const handleOpen = (row: Row) => {
    // Private profiles you don't follow: don't navigate (locked).
    const locked = row.is_private && !row.viewerFollows && row.user_id !== user?.id;
    if (locked) return;
    onClose();
    openOOTDModal();
    navigate(`/user/${row.user_id}`);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center md:justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md max-h-[75vh] md:max-h-[85vh] overflow-hidden rounded-t-3xl md:rounded-2xl border border-border/30 bg-card shadow-2xl flex flex-col"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/20 px-4 py-2.5">
          <div className="flex gap-1 rounded-full bg-foreground/[0.05] p-0.5">
            {(["circle", "ripple"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                  tab === t ? "bg-accent text-background" : "text-foreground/60 hover:text-foreground/85"
                }`}
              >
                {t === "circle" ? "Circle" : "Ripple"}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground/80" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-4 pt-2 text-[9px] uppercase tracking-[0.2em] text-foreground/45">
          {targetDisplayName ? `${targetDisplayName} · ` : ""}
          {tab === "circle" ? "People they follow" : "People who follow them"}
        </p>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-accent/60" /></div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[11px] text-foreground/55">
              {tab === "circle" ? "Their circle is empty." : "No ripple yet."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {rows.map(row => {
                const locked = row.is_private && !row.viewerFollows && row.user_id !== user?.id;
                const name = locked ? "Private account" : (row.display_name || "Unknown");
                const initial = (row.display_name?.[0] || "?").toUpperCase();
                return (
                  <li key={row.user_id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-foreground/[0.03] transition-colors">
                    <button
                      onClick={() => handleOpen(row)}
                      disabled={locked}
                      className="flex flex-1 items-center gap-2.5 text-left min-w-0 disabled:cursor-not-allowed"
                    >
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-border/30">
                        {!locked && row.avatar_url ? (
                          <img src={row.avatar_url} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-foreground/55">
                            {locked ? <Lock className="h-3 w-3" /> : initial}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex items-center gap-1.5">
                        <p className="truncate text-[12px] text-foreground/85">{name}</p>
                        {row.is_private && !locked && <Lock className="h-3 w-3 text-foreground/30 shrink-0" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicCirclesSheet;
