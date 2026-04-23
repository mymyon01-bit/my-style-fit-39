import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view_sensitive"
  | "role_change"
  | "flag_change"
  | "config_change";

export async function logAdminAction(params: {
  action: AuditAction;
  targetTable?: string | null;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  try {
    await supabase.rpc("log_admin_action", {
      _action: params.action,
      _target_table: params.targetTable ?? null,
      _target_id: params.targetId ?? null,
      _before: (params.before ?? null) as any,
      _after: (params.after ?? null) as any,
      _reason: params.reason ?? null,
    });
  } catch (err) {
    console.warn("[admin-audit] failed to log action", err);
  }
}
