import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Ban, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const AdminUsers = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setProfiles(data || []);
    setLoading(false);
  };

  const suspend = async (p: any) => {
    if (!confirm(`Suspend ${p.display_name || p.user_id}?`)) return;
    setBusyId(p.user_id);
    const reason = prompt("Reason (optional):") || null;
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended_at: new Date().toISOString(),
        suspended_reason: reason,
        suspended_by: me.user?.id ?? null,
      })
      .eq("user_id", p.user_id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("User suspended");
      loadProfiles();
    }
  };

  const unsuspend = async (p: any) => {
    setBusyId(p.user_id);
    const { error } = await supabase
      .from("profiles")
      .update({ suspended_at: null, suspended_reason: null, suspended_by: null })
      .eq("user_id", p.user_id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("User reinstated");
      loadProfiles();
    }
  };

  const deleteUser = async (p: any) => {
    if (
      !confirm(
        `Permanently delete ${p.display_name || p.user_id}? This removes their account, profile, posts. Cannot be undone.`,
      )
    )
      return;
    setBusyId(p.user_id);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: p.user_id },
    });
    setBusyId(null);
    if (error || (data as any)?.error) {
      toast.error(error?.message || (data as any)?.error || "Delete failed");
    } else {
      toast.success("User deleted");
      loadProfiles();
    }
  };

  const filtered = profiles.filter(
    (p) =>
      !search ||
      p.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.user_id?.includes(search),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">Users</h1>
        <span className="text-[11px] text-foreground/75">{profiles.length} total</span>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 px-3 py-2">
        <Search className="h-4 w-4 text-foreground/70" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/75" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/20 text-left text-foreground/75">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">User ID</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Joined</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const suspended = !!p.suspended_at;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/10 hover:bg-foreground/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 text-foreground/70">
                      {p.display_name || "—"}
                    </td>
                    <td className="py-3 pr-4 text-foreground/75 font-mono text-[10px]">
                      {p.user_id?.slice(0, 8)}…
                    </td>
                    <td className="py-3 pr-4">
                      {suspended ? (
                        <span className="text-[10px] text-destructive">
                          Suspended
                        </span>
                      ) : (
                        <span className="text-[10px] text-foreground/60">Active</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-foreground/75">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {suspended ? (
                          <button
                            onClick={() => unsuspend(p)}
                            disabled={busyId === p.user_id}
                            className="inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[10px] text-foreground/75 hover:bg-foreground/5 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" /> Reinstate
                          </button>
                        ) : (
                          <button
                            onClick={() => suspend(p)}
                            disabled={busyId === p.user_id}
                            className="inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[10px] text-foreground/75 hover:bg-foreground/5 disabled:opacity-50"
                          >
                            <Ban className="h-3 w-3" /> Suspend
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(p)}
                          disabled={busyId === p.user_id}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
