import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2 } from "lucide-react";

const AdminUsers = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    setProfiles(data || []);
    setLoading(false);
  };

  const filtered = profiles.filter(p =>
    !search || p.display_name?.toLowerCase().includes(search.toLowerCase()) || p.user_id?.includes(search)
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
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users…"
          className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-4 w-4 animate-spin text-foreground/75" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/20 text-left text-foreground/75">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">User ID</th>
                <th className="pb-3 pr-4 font-medium">Language</th>
                <th className="pb-3 pr-4 font-medium">Onboarded</th>
                <th className="pb-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-border/10 hover:bg-foreground/[0.02] transition-colors">
                  <td className="py-3 pr-4 text-foreground/70">{p.display_name || "—"}</td>
                  <td className="py-3 pr-4 text-foreground/75 font-mono text-[10px]">{p.user_id?.slice(0, 8)}…</td>
                  <td className="py-3 pr-4 text-foreground/70">{p.language || "en"}</td>
                  <td className="py-3 pr-4 text-foreground/70">{p.onboarded ? "✓" : "—"}</td>
                  <td className="py-3 text-foreground/75">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
