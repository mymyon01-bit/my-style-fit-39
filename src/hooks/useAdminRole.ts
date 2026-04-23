import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export type AdminTier = "super_admin" | "admin" | "moderator" | null;

export interface AdminPermissions {
  can_manage_admins: boolean;
  can_manage_flags: boolean;
  can_edit_fit_rules: boolean;
  can_edit_brand_calibration: boolean;
  can_edit_products: boolean;
  can_edit_content: boolean;
  can_view_sensitive: boolean;
  can_edit_app_config: boolean;
}

const FULL_PERMS: AdminPermissions = {
  can_manage_admins: true,
  can_manage_flags: true,
  can_edit_fit_rules: true,
  can_edit_brand_calibration: true,
  can_edit_products: true,
  can_edit_content: true,
  can_view_sensitive: true,
  can_edit_app_config: true,
};

const EMPTY_PERMS: AdminPermissions = {
  can_manage_admins: false,
  can_manage_flags: false,
  can_edit_fit_rules: false,
  can_edit_brand_calibration: false,
  can_edit_products: false,
  can_edit_content: false,
  can_view_sensitive: false,
  can_edit_app_config: false,
};

export function useAdminRole() {
  const { user } = useAuth();
  const [tier, setTier] = useState<AdminTier>(null);
  const [permissions, setPermissions] = useState<AdminPermissions>(EMPTY_PERMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        if (!cancelled) {
          setTier(null);
          setPermissions(EMPTY_PERMS);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const list = (roles || []).map((r: any) => r.role as string);
      let resolved: AdminTier = null;
      if (list.includes("super_admin")) resolved = "super_admin";
      else if (list.includes("admin")) resolved = "admin";
      else if (list.includes("moderator")) resolved = "moderator";

      let perms = EMPTY_PERMS;
      if (resolved === "super_admin") {
        perms = FULL_PERMS;
      } else if (resolved === "admin") {
        const { data: row } = await supabase
          .from("admin_permissions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (row) {
          perms = {
            can_manage_admins: !!row.can_manage_admins,
            can_manage_flags: !!row.can_manage_flags,
            can_edit_fit_rules: !!row.can_edit_fit_rules,
            can_edit_brand_calibration: !!row.can_edit_brand_calibration,
            can_edit_products: !!row.can_edit_products,
            can_edit_content: !!row.can_edit_content,
            can_view_sensitive: !!row.can_view_sensitive,
            can_edit_app_config: !!row.can_edit_app_config,
          };
        } else {
          perms = { ...FULL_PERMS, can_manage_admins: false };
        }
      }

      if (!cancelled) {
        setTier(resolved);
        setPermissions(perms);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = tier === "admin" || tier === "super_admin";
  const isSuperAdmin = tier === "super_admin";

  return { tier, isAdmin, isSuperAdmin, permissions, loading };
}
