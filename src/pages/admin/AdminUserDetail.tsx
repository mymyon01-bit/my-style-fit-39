import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Loader2,
  Ban,
  Trash2,
  RotateCcw,
  Shield,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Star,
  Heart,
  MessageCircle,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

const Field = ({ label, value }: { label: string; value: any }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] uppercase tracking-wider text-foreground/50">{label}</span>
    <span className="text-[12px] text-foreground/90 break-all">
      {value === null || value === undefined || value === "" ? "—" : String(value)}
    </span>
  </div>
);

const Card = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border/20 bg-card/30 p-4">
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-foreground/60" />
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">
        {title}
      </h2>
    </div>
    {children}
  </div>
);

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [body, setBody] = useState<any>(null);
  const [style, setStyle] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [stats, setStats] = useState({
    posts: 0,
    comments: 0,
    stars_received: 0,
    interactions: 0,
    saved: 0,
    followers: 0,
    following: 0,
  });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = async () => {
    setLoading(true);
    const [
      profileRes,
      bodyRes,
      styleRes,
      rolesRes,
      postsCount,
      commentsCount,
      interactionsCount,
      savedCount,
      followersCount,
      followingCount,
      postsList,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle(),
      supabase.from("body_profiles").select("*").eq("user_id", userId!).maybeSingle(),
      supabase.from("style_profiles").select("*").eq("user_id", userId!).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId!),
      supabase.from("ootd_posts").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("ootd_comments").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("interactions").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("saved_items").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("following_id", userId!),
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("follower_id", userId!),
      supabase
        .from("ootd_posts")
        .select("id,image_url,caption,star_count,like_count,created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    setProfile(profileRes.data);
    setBody(bodyRes.data);
    setStyle(styleRes.data);
    setRoles((rolesRes.data || []).map((r: any) => r.role));

    // sum stars on posts
    let starsReceived = 0;
    if (postsList.data?.length) {
      starsReceived = postsList.data.reduce((s: number, p: any) => s + (p.star_count || 0), 0);
    }

    setStats({
      posts: postsCount.count || 0,
      comments: commentsCount.count || 0,
      stars_received: starsReceived,
      interactions: interactionsCount.count || 0,
      saved: savedCount.count || 0,
      followers: followersCount.count || 0,
      following: followingCount.count || 0,
    });
    setRecentPosts(postsList.data || []);
    setLoading(false);
  };

  const suspend = async () => {
    if (!profile) return;
    if (!confirm(`Suspend ${profile.display_name || profile.username}?`)) return;
    const reason = prompt("Reason (optional):") || null;
    setBusy(true);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended_at: new Date().toISOString(),
        suspended_reason: reason,
        suspended_by: me.user?.id ?? null,
      })
      .eq("user_id", profile.user_id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("User suspended");
      load();
    }
  };

  const unsuspend = async () => {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ suspended_at: null, suspended_reason: null, suspended_by: null })
      .eq("user_id", profile.user_id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("User reinstated");
      load();
    }
  };

  const deleteUser = async () => {
    if (!profile) return;
    if (
      !confirm(
        `Permanently delete ${profile.display_name || profile.username}? Cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: profile.user_id },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error(error?.message || (data as any)?.error || "Delete failed");
    } else {
      toast.success("User deleted");
      window.history.back();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/70" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1 text-[12px] text-foreground/70 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <p className="text-[13px] text-foreground/70">User not found.</p>
      </div>
    );
  }

  const suspended = !!profile.suspended_at;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1 text-[12px] text-foreground/70 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to users
        </Link>
        <div className="inline-flex items-center gap-2">
          {suspended ? (
            <button
              onClick={unsuspend}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-border/30 px-3 py-1.5 text-[11px] text-foreground/80 hover:bg-foreground/5 disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Reinstate
            </button>
          ) : (
            <button
              onClick={suspend}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-border/30 px-3 py-1.5 text-[11px] text-foreground/80 hover:bg-foreground/5 disabled:opacity-50"
            >
              <Ban className="h-3 w-3" /> Suspend
            </button>
          )}
          <button
            onClick={deleteUser}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      </div>

      {/* Identity */}
      <div className="flex items-start gap-4 rounded-xl border border-border/20 bg-card/30 p-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name || profile.username}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground/10">
            <UserIcon className="h-6 w-6 text-foreground/60" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl text-foreground">
              {profile.display_name || profile.username || "Unnamed"}
            </h1>
            {profile.is_official && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                Official
              </span>
            )}
            {suspended && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-destructive">
                Suspended
              </span>
            )}
            {roles.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-foreground/80"
              >
                <Shield className="h-2.5 w-2.5" /> {r}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-foreground/70">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-2 text-[12px] text-foreground/75">{profile.bio}</p>
          )}
          <p className="mt-2 font-mono text-[10px] text-foreground/50">{profile.user_id}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "Posts", value: stats.posts, icon: ImageIcon },
          { label: "Stars", value: stats.stars_received, icon: Star },
          { label: "Comments", value: stats.comments, icon: MessageCircle },
          { label: "Saved", value: stats.saved, icon: Heart },
          { label: "Followers", value: stats.followers, icon: UserIcon },
          { label: "Following", value: stats.following, icon: UserIcon },
          { label: "Events", value: stats.interactions, icon: Calendar },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border/20 bg-card/30 p-3"
          >
            <div className="flex items-center gap-1.5 text-foreground/60">
              <s.icon className="h-3 w-3" />
              <span className="text-[9px] uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="mt-1 text-lg font-display text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Account */}
        <Card title="Account" icon={UserIcon}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username" value={profile.username} />
            <Field label="Display Name" value={profile.display_name} />
            <Field label="Language" value={profile.language} />
            <Field label="Theme" value={profile.theme} />
            <Field label="Onboarded" value={profile.onboarded ? "Yes" : "No"} />
            <Field label="Email Verified" value={profile.email_verified ? "Yes" : "No"} />
            <Field label="Private" value={profile.is_private ? "Yes" : "No"} />
            <Field label="Bonus Stars" value={profile.bonus_stars} />
            <Field
              label="Joined"
              value={new Date(profile.created_at).toLocaleString()}
            />
            <Field
              label="Updated"
              value={new Date(profile.updated_at).toLocaleString()}
            />
          </div>
        </Card>

        {/* Contact */}
        <Card title="Contact" icon={Mail}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={profile.phone_number || profile.phone} />
            <Field
              label="Phone Verified"
              value={profile.phone_verified ? "Yes" : "No"}
            />
            <Field label="Location" value={profile.location} />
            <Field label="Date of Birth" value={profile.date_of_birth} />
            <Field label="Gender Pref." value={profile.gender_preference} />
          </div>
        </Card>

        {/* Body */}
        <Card title="Body Profile" icon={UserIcon}>
          {body ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (cm)" value={body.height_cm} />
              <Field label="Weight (kg)" value={body.weight_kg} />
              <Field label="Shoulder (cm)" value={body.shoulder_width_cm} />
              <Field label="Waist (cm)" value={body.waist_cm} />
              <Field label="Inseam (cm)" value={body.inseam_cm} />
              <Field label="Silhouette" value={body.silhouette_type} />
              <Field label="Shoe Size" value={body.shoe_size} />
              <Field label="Scan Confidence" value={body.scan_confidence} />
            </div>
          ) : (
            <p className="text-[12px] text-foreground/60">No body profile.</p>
          )}
        </Card>

        {/* Style */}
        <Card title="Style Profile" icon={Star}>
          {style ? (
            <pre className="max-h-60 overflow-auto rounded-md bg-foreground/[0.03] p-3 text-[10px] text-foreground/80">
              {JSON.stringify(style, null, 2)}
            </pre>
          ) : (
            <p className="text-[12px] text-foreground/60">No style profile.</p>
          )}
        </Card>
      </div>

      {/* Suspension info */}
      {suspended && (
        <Card title="Suspension" icon={Ban}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Suspended At"
              value={new Date(profile.suspended_at).toLocaleString()}
            />
            <Field label="Suspended By" value={profile.suspended_by} />
            <Field label="Reason" value={profile.suspended_reason} />
          </div>
        </Card>
      )}

      {/* Recent posts */}
      <Card title={`Recent OOTD Posts (${recentPosts.length})`} icon={ImageIcon}>
        {recentPosts.length === 0 ? (
          <p className="text-[12px] text-foreground/60">No posts yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {recentPosts.map((p) => (
              <div
                key={p.id}
                className="group relative aspect-[3/4] overflow-hidden rounded-md border border-border/20"
              >
                <img
                  src={p.image_url}
                  alt={p.caption || "post"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[9px] text-white">
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5" /> {p.star_count || 0}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Heart className="h-2.5 w-2.5" /> {p.like_count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminUserDetail;
