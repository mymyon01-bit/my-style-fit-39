import { useAuth } from "@/lib/auth";

const AdminSettings = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-display text-foreground/80">Admin Settings</h1>

      <div className="rounded-xl border border-border/20 bg-card/30 p-6 space-y-4">
        <p className="text-[12px] font-medium text-foreground/75">Current Admin</p>
        <p className="text-[11px] text-foreground/75 font-mono">{user?.email}</p>
        <p className="text-[11px] text-foreground/75 font-mono">{user?.id}</p>
      </div>

      <div className="rounded-xl border border-border/20 bg-card/30 p-6 space-y-3">
        <p className="text-[12px] font-medium text-foreground/75">Adding Admins</p>
        <p className="text-[11px] text-foreground/75 leading-relaxed">
          Admin roles are assigned directly in the database for security. Insert a row into <code className="text-accent/60">user_roles</code> with the user's ID and role <code className="text-accent/60">'admin'</code>.
        </p>
      </div>
    </div>
  );
};

export default AdminSettings;
