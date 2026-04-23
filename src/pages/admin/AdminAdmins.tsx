import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { logAdminAction } from "@/lib/admin/audit";
import { Loader2, Search, Shield, ShieldCheck, ShieldX, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Role = "super_admin" | "admin" | "moderator";
const PERM_KEYS = [
  "can_manage_admins",
  "can_manage_flags",
  "can_edit_fit_rules",
  "can_edit_brand_calibration",
  "can_edit_products",
  "can_edit_content",
  "can_view_sensitive",
  "can_edit_app_config",
] as const;

export default function AdminAdmins() {
  const { isSuperAdmin, loading: roleLoading } = useAdminRole();
  const [admins, setAdmins] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["super_admin", "admin", "moderator"] as Role[]);
    const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (userIds.length === 0) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    const [{ data: profs }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds),
      supabase.from("admin_permissions").select("*").in("user_id", userIds),
    ]);
    const byUser = new Map<string, any>();
    (roles ?? []).forEach((r: any) => {
      const cur = byUser.get(r.user_id) ?? { user_id: r.user_id, roles: [] as Role[] };
      cur.roles.push(r.role as Role);
      byUser.set(r.user_id, cur);
    });
    (profs ?? []).forEach((p: any) => {
      const cur = byUser.get(p.user_id);
      if (cur) Object.assign(cur, p);
    });
    (perms ?? []).forEach((p: any) => {
      const cur = byUser.get(p.user_id);
      if (cur) cur.permissions = p;
    });
    setAdmins(Array.from(byUser.values()));
    setLoading(false);
  }

  async function searchUsers(q: string) {
    setSearch(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(8);
    setResults(data ?? []);
  }

  async function grantRole(userId: string, role: Role) {
    if (!isSuperAdmin) return toast.error("Only super-admins can assign roles");
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: "role_change",
      targetTable: "user_roles",
      targetId: userId,
      after: { role },
      reason: `Granted ${role}`,
    });
    toast.success(`Granted ${role}`);
    setSearch("");
    setResults([]);
    load();
  }

  async function revokeRole(userId: string, role: Role) {
    if (!isSuperAdmin) return toast.error("Only super-admins can revoke roles");
    if (!confirm(`Revoke ${role} from this user?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) return toast.error(error.message);
    await logAdminAction({
      action: "role_change",
      targetTable: "user_roles",
      targetId: userId,
      before: { role },
      reason: `Revoked ${role}`,
    });
    toast.success(`Revoked ${role}`);
    load();
  }

  async function togglePerm(userId: string, key: (typeof PERM_KEYS)[number], value: boolean) {
    if (!isSuperAdmin) return toast.error("Only super-admins can edit permissions");
    const existing = admins.find((a) => a.user_id === userId)?.permissions;
    const before = existing ? { ...existing } : null;
    if (existing) {
      const update: Record<string, boolean> = {};
      update[key] = value;
      const { error } = await supabase
        .from("admin_permissions")
        .update(update as any)
        .eq("user_id", userId);
      if (error) return toast.error(error.message);
    } else {
      const fresh: any = { user_id: userId };
      PERM_KEYS.forEach((k) => (fresh[k] = false));
      fresh[key] = value;
      const { error } = await supabase.from("admin_permissions").insert(fresh);
      if (error) return toast.error(error.message);
    }
    await logAdminAction({
      action: "update",
      targetTable: "admin_permissions",
      targetId: userId,
      before,
      after: { ...(existing ?? {}), [key]: value },
      reason: `Toggled ${key}=${value}`,
    });
    load();
  }

  if (roleLoading || loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="rounded-xl border border-border/20 bg-card/30 p-6">
        <div className="flex items-center gap-2 text-foreground/80">
          <ShieldX className="h-4 w-4 text-destructive" />
          <p className="text-[13px]">Only super-admins can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display text-foreground/80">Admins & Roles</h1>
        <span className="text-[11px] text-foreground/60">{admins.length} admin accounts</span>
      </div>

      <div className="rounded-xl border border-border/20 bg-card/30 p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-accent/70" />
          <p className="text-[12px] font-medium text-foreground/80">Promote existing user</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-background/40 px-3 py-2">
          <Search className="h-4 w-4 text-foreground/60" />
          <input
            value={search}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search by name or username…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground/40"
          />
        </div>
        {results.length > 0 && (
          <div className="mt-2 space-y-1">
            {results.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between rounded-md border border-border/20 bg-background/30 px-3 py-2">
                <div>
                  <p className="text-[12px] text-foreground/85">{u.display_name || u.username}</p>
                  <p className="text-[10px] text-foreground/50">@{u.username}</p>
                </div>
                <div className="flex gap-1">
                  {(["moderator", "admin", "super_admin"] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => grantRole(u.user_id, r)}
                      className="rounded-md border border-border/30 px-2 py-1 text-[10px] text-foreground/75 hover:bg-accent/10"
                    >
                      Grant {r}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {admins.map((a) => {
          const isSuper = (a.roles as Role[]).includes("super_admin");
          const perms = a.permissions ?? {};
          return (
            <div key={a.user_id} className="rounded-xl border border-border/20 bg-card/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {isSuper ? (
                    <ShieldCheck className="h-5 w-5 text-accent/80" />
                  ) : (
                    <Shield className="h-5 w-5 text-foreground/60" />
                  )}
                  <div>
                    <p className="text-[13px] font-medium text-foreground/85">
                      {a.display_name || a.username || a.user_id.slice(0, 8)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(a.roles as Role[]).map((r) => (
                        <span
                          key={r}
                          className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                            r === "super_admin"
                              ? "border-accent/40 text-accent/80"
                              : "border-border/30 text-foreground/65"
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(a.roles as Role[]).map((r) => (
                    <button
                      key={`rev-${r}`}
                      onClick={() => revokeRole(a.user_id, r)}
                      className="rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                    >
                      Revoke {r}
                    </button>
                  ))}
                </div>
              </div>

              {!isSuper && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PERM_KEYS.map((k) => (
                    <label key={k} className="flex items-center gap-2 rounded-md border border-border/15 bg-background/30 px-2 py-1.5 text-[10.5px] text-foreground/75">
                      <input
                        type="checkbox"
                        checked={!!perms[k]}
                        onChange={(e) => togglePerm(a.user_id, k, e.target.checked)}
                        className="h-3 w-3"
                      />
                      {k.replace("can_", "").replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
