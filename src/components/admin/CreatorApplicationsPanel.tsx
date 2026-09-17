/**
 * CreatorApplicationsPanel — admin review queue for creator accounts.
 * Approving flips the applicant's profile to a verified creator so their
 * OOTD posts carry the CREATOR badge in the feed.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, BadgeCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Row {
  id: string;
  user_id: string;
  platform: string;
  handle: string;
  follower_count: number;
  note: string | null;
  status: string;
  created_at: string;
}

export default function CreatorApplicationsPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("creator_applications")
      .select("id, user_id, platform, handle, follower_count, note, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as Row[];
    setRows(list);
    setLoading(false);
    const ids = [...new Set(list.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      ((profs as any[]) ?? []).forEach((p) => { map[p.user_id] = p.display_name || p.username || p.user_id.slice(0, 8); });
      setNames(map);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (row: Row, approve: boolean) => {
    setBusy(row.id);
    const { error } = await supabase
      .from("creator_applications")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (!error && approve) {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ is_creator: true })
        .eq("user_id", row.user_id);
      if (pErr) toast.error(pErr.message);
    }
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "크리에이터로 승인했어요" : "신청을 거절했어요");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground/80">Creator applications</h2>
        <span className="text-[11px] text-foreground/75">{rows.length} pending</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-foreground/75" /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-foreground/70">No pending applications</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border/20 bg-card/30 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">
                  {names[r.user_id] ?? r.user_id.slice(0, 8)} · {r.platform} {r.handle}
                </p>
                <p className="truncate text-[11px] text-foreground/60">
                  팔로워 {r.follower_count.toLocaleString()}{r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => review(r, true)}
                className="flex h-8 items-center gap-1 rounded-md border border-border/40 px-2.5 text-[11px] text-foreground/80 hover:border-foreground"
              >
                <BadgeCheck className="h-3.5 w-3.5" /> 승인
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => review(r, false)}
                className="flex h-8 items-center gap-1 rounded-md border border-border/40 px-2.5 text-[11px] text-foreground/60 hover:border-foreground"
              >
                <X className="h-3.5 w-3.5" /> 거절
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
