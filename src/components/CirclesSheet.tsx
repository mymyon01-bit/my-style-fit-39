import { useEffect, useState } from "react";
import { X, Loader2, UserPlus, UserMinus, Ban, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Tab = "circle" | "ripple";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
  onChanged?: () => void;
}

interface Row {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  followsBack: boolean; // I follow them
  blocked: boolean;     // I have blocked them
}

const CirclesSheet = ({ open, onClose, initialTab = "circle", onChanged }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  useEffect(() => { if (open && user) load(); }, [open, user, tab]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Circle = people I follow (follower_id = me). Ripple = people who follow me (following_id = me).
      const col = tab === "circle" ? "following_id" : "follower_id";
      const filterCol = tab === "circle" ? "follower_id" : "following_id";
      const { data: links } = await supabase
        .from("circles")
        .select(`${col}`)
        .eq(filterCol, user.id);

      const ids = Array.from(new Set((links || []).map((l: any) => l[col]).filter(Boolean)));
      if (ids.length === 0) { setRows([]); setLoading(false); return; }

      const [profilesRes, myFollowingRes, myBlocksRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids),
        supabase.from("circles").select("following_id").eq("follower_id", user.id).in("following_id", ids),
        supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id).in("blocked_id", ids),
      ]);

      const followingSet = new Set((myFollowingRes.data || []).map((r: any) => r.following_id));
      const blockedSet = new Set((myBlocksRes.data || []).map((r: any) => r.blocked_id));

      const built: Row[] = (profilesRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        followsBack: followingSet.has(p.user_id),
        blocked: blockedSet.has(p.user_id),
      }));
      setRows(built);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (row: Row) => {
    if (!user) return;
    setBusyId(row.user_id);
    try {
      if (row.followsBack) {
        await supabase.from("circles").delete().eq("follower_id", user.id).eq("following_id", row.user_id);
        toast.success("Removed from your circle");
      } else {
        await supabase.from("circles").insert({ follower_id: user.id, following_id: row.user_id });
        toast.success("Added to your circle");
      }
      setRows(rs => rs.map(r => r.user_id === row.user_id ? { ...r, followsBack: !r.followsBack } : r));
      onChanged?.();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const toggleBlock = async (row: Row) => {
    if (!user) return;
    setBusyId(row.user_id);
    try {
      if (row.blocked) {
        await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", row.user_id);
        toast.success("Unblocked");
        setRows(rs => rs.map(r => r.user_id === row.user_id ? { ...r, blocked: false } : r));
      } else {
        await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: row.user_id });
        // Also drop any mutual circle link
        await Promise.all([
          supabase.from("circles").delete().eq("follower_id", user.id).eq("following_id", row.user_id),
          supabase.from("circles").delete().eq("follower_id", row.user_id).eq("following_id", user.id),
        ]);
        toast.success("Blocked");
        // If we were on Ripple tab, this person no longer follows us — drop them from list
        setRows(rs => tab === "ripple"
          ? rs.filter(r => r.user_id !== row.user_id)
          : rs.map(r => r.user_id === row.user_id ? { ...r, blocked: true, followsBack: false } : r));
        onChanged?.();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center md:justify-center bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full md:max-w-md max-h-[85vh] overflow-hidden rounded-t-3xl md:rounded-2xl border border-border/30 bg-card shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/20 px-5 py-4">
          <div className="flex gap-1 rounded-full bg-foreground/[0.05] p-1">
            {(["circle", "ripple"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-[11px] font-medium transition-colors ${
                  tab === t ? "bg-accent text-background" : "text-foreground/60 hover:text-foreground/85"
                }`}
              >
                {t === "circle" ? "My Circle" : "Ripple"}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground/80" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subtitle */}
        <p className="px-5 pt-3 text-[10px] uppercase tracking-[0.2em] text-foreground/45">
          {tab === "circle" ? "People you follow" : "People who follow you"}
        </p>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-accent/60" /></div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12px] text-foreground/55">
              {tab === "circle" ? "Your circle is empty. Follow profiles to fill it." : "No ripple yet. Share more looks to attract followers."}
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map(row => {
                const name = row.display_name || "Unknown";
                const initial = name[0]?.toUpperCase() || "?";
                return (
                  <li key={row.user_id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/[0.03] transition-colors">
                    <button
                      onClick={() => { onClose(); navigate(`/user/${row.user_id}`); }}
                      className="flex flex-1 items-center gap-3 text-left min-w-0"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06] ring-1 ring-border/30">
                        {row.avatar_url ? (
                          <img src={row.avatar_url} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-foreground/55">{initial}</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-foreground/85">{name}</p>
                        {row.blocked && <p className="text-[10px] text-destructive/70">Blocked</p>}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!row.blocked && (
                        <button
                          onClick={() => toggleFollow(row)}
                          disabled={busyId === row.user_id}
                          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                            row.followsBack
                              ? "border border-border/40 text-foreground/60 hover:text-foreground/85"
                              : "bg-accent text-background hover:bg-accent/90"
                          }`}
                          aria-label={row.followsBack ? "Remove from circle" : "Add to circle"}
                        >
                          {busyId === row.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : row.followsBack ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                          {row.followsBack ? "Following" : tab === "ripple" ? "Follow back" : "Follow"}
                        </button>
                      )}
                      <button
                        onClick={() => toggleBlock(row)}
                        disabled={busyId === row.user_id}
                        className={`rounded-full p-1.5 transition-colors disabled:opacity-50 ${
                          row.blocked
                            ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
                            : "text-foreground/40 hover:text-destructive hover:bg-destructive/10"
                        }`}
                        aria-label={row.blocked ? "Unblock" : "Block"}
                        title={row.blocked ? "Unblock" : "Block"}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

export default CirclesSheet;
