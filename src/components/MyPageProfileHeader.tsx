import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Edit3, Save, X, Lock, Globe, Settings, Plus, MessageCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import StoryRippleRing from "@/components/StoryRippleRing";
import CirclesSheet from "@/components/CirclesSheet";
import { OfficialBadge, OfficialAvatarRing } from "@/components/OfficialBadge";

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean | null;
  hashtags: string[] | null;
  is_official?: boolean | null;
}

interface Props {
  postCount: number;
  totalStars: number;
  refreshKey?: number;
  hasStory?: boolean;
  hasUnseenStory?: boolean;
  onViewMyStory?: () => void;
  onUploadStory?: () => void;
  onOpenMessages?: () => void;
  /** When provided, the gear opens the OOTD customize modal instead of
   *  navigating to /profile. Used on mobile to keep users in the OOTD flow. */
  onOpenSettings?: () => void;
  /** Hide the inline settings gear — useful when an external trigger handles it. */
  hideSettings?: boolean;
}

const MyPageProfileHeader = ({ postCount, totalStars, refreshKey, hasStory, hasUnseenStory, onViewMyStory, onUploadStory, onOpenMessages, onOpenSettings, hideSettings }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const { msgUnread } = useNotifications();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [circleCount, setCircleCount] = useState(0);
  const [rippleCount, setRippleCount] = useState(0);
  const [starsActual, setStarsActual] = useState<number | null>(null);
  const [circlesOpen, setCirclesOpen] = useState<null | "circle" | "ripple">(null);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, refreshKey]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [pRes, cRes, rRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, bio, is_private, hashtags, is_official").eq("user_id", user.id).maybeSingle(),
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("ootd_posts").select("id").eq("user_id", user.id),
    ]);
    const p = pRes.data as ProfileData | null;
    setProfile(p);
    setEditName(p?.display_name || "");
    setEditBio(p?.bio || "");
    setCircleCount(cRes.count || 0);
    setRippleCount(rRes.count || 0);

    // Real star count: count rows in ootd_stars whose post belongs to me.
    const postIds = (postsRes.data || []).map((row: { id: string }) => row.id);
    if (postIds.length === 0) {
      setStarsActual(0);
    } else {
      const { count } = await supabase
        .from("ootd_stars")
        .select("id", { count: "exact", head: true })
        .in("post_id", postIds);
      setStarsActual(count || 0);
    }
    setLoading(false);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Select an image"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("profile-photos").upload(path, file, { cacheControl: "3600", upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      setProfile(p => p ? { ...p, avatar_url: avatarUrl } : p);
      toast.success("Profile photo updated");
    } catch (err: any) {
      console.error("[avatar-upload]", err);
      toast.error("Couldn't upload photo");
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
      }).eq("user_id", user.id);
      if (error) throw error;
      setProfile(p => p ? { ...p, display_name: editName.trim() || null, bio: editBio.trim() || null } : p);
      setEditing(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const togglePrivate = async () => {
    if (!user || !profile) return;
    const newVal = !profile.is_private;
    setProfile({ ...profile, is_private: newVal });
    await supabase.from("profiles").update({ is_private: newVal }).eq("user_id", user.id);
    toast.success(newVal ? "Account is now private" : "Account is now public");
  };

  if (loading || !user) return null;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "You";
  const initial = displayName[0]?.toUpperCase() || "Y";

  return (
    <div className="mb-6 rounded-2xl border border-border/30 bg-card/40 p-4 space-y-4">
      <div className="flex items-start gap-4">
        {/* Avatar with story ring + upload */}
        <div className="relative shrink-0">
          <div className="relative h-16 w-16">
            <StoryRippleRing active={!!hasStory} unseen={!!hasUnseenStory} inset={3} />
            <OfficialAvatarRing isOfficial={profile?.is_official} className="absolute inset-0">
              <button
                type="button"
                onClick={() => {
                  if (hasStory && onViewMyStory) onViewMyStory();
                  else photoRef.current?.click();
                }}
                className="relative h-16 w-16 rounded-full overflow-hidden bg-foreground/[0.06] ring-2 ring-background block"
                aria-label={hasStory ? "View your story" : "Change profile photo"}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base font-semibold text-foreground/60">{initial}</div>
                )}
              </button>
            </OfficialAvatarRing>
          </div>
          <button
            onClick={() => {
              if (onUploadStory) onUploadStory();
              else photoRef.current?.click();
            }}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-tr from-accent via-pink-400 to-amber-300 text-background flex items-center justify-center border-2 border-card shadow-md hover:scale-110 active:scale-95 transition-transform disabled:opacity-60"
            aria-label={onUploadStory ? "Add story" : "Change profile photo"}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : onUploadStory ? <Plus className="h-3.5 w-3.5" strokeWidth={3} /> : <Camera className="h-3 w-3" />}
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Name + bio */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value.slice(0, 40))}
                placeholder="Display name"
                className="w-full bg-transparent text-[14px] font-medium text-foreground outline-none border-b border-border/30 pb-1 focus:border-accent/40"
              />
              <input
                value={editBio}
                onChange={e => setEditBio(e.target.value.slice(0, 80))}
                placeholder="A short style line"
                className="w-full bg-transparent text-[11px] text-foreground/70 outline-none border-b border-border/30 pb-1 focus:border-accent/40"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[10px] font-semibold text-background disabled:opacity-50">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                </button>
                <button onClick={() => { setEditing(false); setEditName(profile?.display_name || ""); setEditBio(profile?.bio || ""); }} className="flex items-center gap-1 rounded-lg border border-border/40 px-3 py-1.5 text-[10px] text-foreground/60">
                  <X className="h-3 w-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-semibold text-foreground/90 truncate">{displayName}</p>
                {profile?.is_official && <OfficialBadge />}
                <button onClick={() => setEditing(true)} className="text-foreground/40 hover:text-accent transition-colors shrink-0">
                  <Edit3 className="h-3 w-3" />
                </button>
              </div>
              {profile?.bio ? (
                <p className="text-[11px] text-foreground/65 mt-0.5 line-clamp-2">{profile.bio}</p>
              ) : (
                <p className="text-[11px] text-foreground/40 mt-0.5 italic">Add a bio to introduce your style</p>
              )}
              {profile?.hashtags && profile.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {profile.hashtags.slice(0, 4).map(t => (
                    <span key={t} className="text-[9px] text-accent/70">#{t}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Settings shortcut — Messages live in the sticky page header so we
            don't duplicate the action here. */}
        {!hideSettings && (
          <button
            onClick={() => (onOpenSettings ? onOpenSettings() : navigate("/profile"))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/45 hover:bg-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Profile settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stats + privacy */}
      <div className="flex items-center justify-between border-t border-border/20 pt-3">
        <div className="flex gap-5">
          <Stat label="Posts" value={postCount} />
          <Stat label="Stars" value={starsActual ?? totalStars} />
          <Stat label="Circle" value={circleCount} onClick={() => setCirclesOpen("circle")} />
          <Stat label="Ripple" value={rippleCount} onClick={() => setCirclesOpen("ripple")} />
        </div>
      </div>

      <CirclesSheet
        open={circlesOpen !== null}
        initialTab={circlesOpen ?? "circle"}
        onClose={() => setCirclesOpen(null)}
        onChanged={load}
      />
    </div>
  );
};

const Stat = ({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) => {
  const inner = (
    <>
      <p className="text-[14px] font-semibold text-foreground/85 leading-none">{value}</p>
      <p className={`text-[9px] uppercase tracking-[0.15em] mt-1 ${onClick ? "text-accent/70 underline decoration-dotted underline-offset-2" : "text-foreground/45"}`}>{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="text-center hover:opacity-80 active:scale-95 transition-all" aria-label={`View ${label}`}>
        {inner}
      </button>
    );
  }
  return <div className="text-center">{inner}</div>;
};

export default MyPageProfileHeader;
