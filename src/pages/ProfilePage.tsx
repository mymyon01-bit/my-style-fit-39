import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt,
  Star, Camera, LogOut, Loader2, User, Crown, Folder, Shield,
  Edit3, CheckCircle, XCircle, Upload, Save, Image, Lock
} from "lucide-react";
import StylePreferenceEditor from "@/components/StylePreferenceEditor";
import CirclesSheet from "@/components/CirclesSheet";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useSavedFolders } from "@/hooks/useSavedFolders";
import { useAdmin } from "@/hooks/useAdmin";
import PremiumBanner from "@/components/PremiumBanner";
import { toast } from "sonner";

const ProfilePage = () => {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const { folders, loading: foldersLoading } = useSavedFolders();
  const { isAdmin } = useAdmin();
  const [profile, setProfile] = useState<any>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [bodyProfile, setBodyProfile] = useState<any>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editGender, setEditGender] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [editHashtags, setEditHashtags] = useState("");
  const [circleCount, setCircleCount] = useState(0);
  const [addedByCount, setAddedByCount] = useState(0);
  const [scrapCount, setScrapCount] = useState(0);
  const [myOotds, setMyOotds] = useState<any[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [circlesSheet, setCirclesSheet] = useState<{ open: boolean; tab: "circle" | "ripple" }>({ open: false, tab: "circle" });

  useEffect(() => { if (user) loadProfileData(); }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    setIsLoading(true);
    const [profileRes, styleRes, bodyRes, savedRes, postsRes, ootdsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("saved_items").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("ootd_posts").select("id, star_count").eq("user_id", user.id),
      supabase.from("ootd_posts").select("id, image_url, caption, star_count, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    ]);

    // Load circle & scrap counts
    const [circleRes, addedByRes, scrapRes] = await Promise.all([
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("circles").select("id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("saved_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setCircleCount(circleRes.count || 0);
    setAddedByCount(addedByRes.count || 0);
    setScrapCount(scrapRes.count || 0);

    const p = profileRes.data;
    setProfile(p);
    setStyleProfile(styleRes.data);
    setBodyProfile(bodyRes.data);
    setSavedCount(savedRes.count || 0);
    const posts = postsRes.data || [];
    setPostCount(posts.length);
    setTotalStars(posts.reduce((sum: number, pt: any) => sum + (pt.star_count || 0), 0));
    setMyOotds(ootdsRes.data || []);
    if (p) {
      setEditName(p.display_name || "");
      setEditBio(p.bio || "");
      setEditLocation(p.location || "");
      setEditGender(p.gender_preference || "");
      setEditHashtags((p.hashtags || []).join(", "));
      setIsPrivate(p.is_private || false);
    }
    setIsLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(path);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      setProfile((p: any) => ({ ...p, avatar_url: avatarUrl }));
      toast.success("Profile photo updated");
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const parsedHashtags = editHashtags.split(/[,\s]+/).map(h => h.replace(/^#/, "").trim()).filter(Boolean);
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
        location: editLocation.trim() || null,
        gender_preference: editGender.trim() || null,
        hashtags: parsedHashtags.length > 0 ? parsedHashtags : null,
      } as any).eq("user_id", user.id);
      if (error) throw error;
      setProfile((p: any) => ({
        ...p,
        display_name: editName.trim(),
        bio: editBio.trim(),
        location: editLocation.trim(),
        gender_preference: editGender.trim(),
        hashtags: parsedHashtags,
      }));
      setIsEditing(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };

  const emailVerified = user?.email_confirmed_at != null;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-foreground/80" />
      </div>
    );
  }

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";

  return (
    <div className="min-h-screen pb-28 bg-background md:pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-baseline justify-between mb-12">
          <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 lg:hidden">WARDROBE</span>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="text-accent/60 hover:text-accent/80 transition-colors">
                <Shield className="h-[18px] w-[18px]" />
              </button>
            )}
            <button onClick={() => navigate("/settings")} className="text-foreground/75 hover:text-foreground/70 transition-colors">
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-10 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12">
        {/* Identity + Photo Upload */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground/[0.03] overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-foreground/75" />
              )}
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent/70 hover:bg-accent/30 transition-colors"
            >
              {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-lg text-foreground/80">{displayName}</p>
              <button onClick={() => setIsEditing(!isEditing)} className="text-foreground/70 hover:text-foreground/70">
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-foreground/70 mt-0.5">{user?.email}</p>
            {profile?.bio && <p className="text-[11px] text-foreground/75 mt-1 italic">{profile.bio}</p>}
            <div className="flex items-center gap-1.5 mt-1">
              {emailVerified ? (
                <span className="flex items-center gap-1 text-[11px] text-green-500/70"><CheckCircle className="h-3 w-3" /> Verified</span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-orange-400/70"><XCircle className="h-3 w-3" /> Unverified</span>
              )}
              {profile?.location && <span className="text-[11px] text-foreground/70 ml-2">📍 {profile.location}</span>}
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && (
          <div className="rounded-xl border border-border/20 bg-card/30 p-5 space-y-4">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70">EDIT PROFILE</p>
            {[
              { label: "Display Name", value: editName, set: setEditName, placeholder: "Your name" },
              { label: "Bio / Style Line", value: editBio, set: setEditBio, placeholder: "A short style description" },
              { label: "Location", value: editLocation, set: setEditLocation, placeholder: "City, Country" },
              { label: "Gender Preference", value: editGender, set: setEditGender, placeholder: "e.g. masculine, feminine, neutral" },
              { label: "Hashtags", value: editHashtags, set: setEditHashtags, placeholder: "#minimal, #street, #modern" },
            ].map(field => (
              <div key={field.label}>
                <label className="text-[10px] font-medium text-foreground/75">{field.label}</label>
                <input
                  type="text"
                  value={field.value}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  className="mt-1 w-full bg-transparent py-2.5 text-[13px] text-foreground outline-none placeholder:text-foreground/50 border-b border-border/20 focus:border-accent/30 transition-colors"
                />
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-4 py-2 text-[11px] font-semibold text-accent/70 hover:bg-accent/15 disabled:opacity-50"
              >
                {savingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
              <button onClick={() => setIsEditing(false)} className="text-[11px] text-foreground/70 hover:text-foreground/70">Cancel</button>
            </div>
          </div>
        )}

        {/* Subscription */}
        <div className="flex items-center gap-4">
          <Crown className={`h-4 w-4 ${subscription.isPremium ? "text-accent/70" : "text-foreground/70"}`} />
          <div>
            <p className="text-[11px] font-medium text-foreground/75">
              {subscription.isPremium ? t("premiumFeature") : t("free")}
            </p>
            {subscription.isPremium && subscription.daysRemaining !== null && (
              <p className="text-[10px] text-foreground/75">
                {subscription.plan === "premium_trial"
                  ? t("trialRemaining").replace("{days}", String(subscription.daysRemaining))
                  : t("active")}
              </p>
            )}
          </div>
        </div>

        {/* Hashtags */}
        {profile?.hashtags && profile.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile.hashtags.map((tag: string) => (
              <span key={tag} className="text-[10px] text-accent/60">#{tag}</span>
            ))}
          </div>
        )}

        {/* Privacy Toggle */}
        <div className="flex items-center justify-between rounded-xl border border-border/20 bg-card/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-foreground/50" />
            <span className="text-[11px] text-foreground/60">Private Account</span>
          </div>
          <button
            onClick={async () => {
              const newVal = !isPrivate;
              setIsPrivate(newVal);
              await supabase.from("profiles").update({ is_private: newVal } as any).eq("user_id", user!.id);
              toast.success(newVal ? "Account set to private" : "Account set to public");
            }}
            className={`relative h-5 w-9 rounded-full transition-colors ${isPrivate ? "bg-accent/60" : "bg-foreground/10"}`}
          >
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform ${isPrivate ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-8 flex-wrap">
          {[
            { icon: Camera, label: t("posts"), value: postCount, onClick: undefined as undefined | (() => void) },
            { icon: Star, label: t("stars"), value: totalStars, onClick: undefined },
            { icon: Bookmark, label: t("saved"), value: savedCount, onClick: undefined },
            { icon: Crown, label: "Circle", value: circleCount, onClick: () => setCirclesSheet({ open: true, tab: "circle" }) },
            { icon: Crown, label: "Ripple", value: addedByCount, onClick: () => setCirclesSheet({ open: true, tab: "ripple" }) },
            { icon: Bookmark, label: "Scrap", value: scrapCount, onClick: undefined },
          ].map(stat => {
            const Wrap: any = stat.onClick ? "button" : "div";
            return (
              <Wrap
                key={stat.label}
                onClick={stat.onClick}
                className={`text-center ${stat.onClick ? "hover:text-accent transition-colors cursor-pointer" : ""}`}
              >
                <p className="text-xl font-light text-foreground/80">{stat.value}</p>
                <p className="text-[10px] text-foreground/70 mt-1.5">{stat.label}</p>
              </Wrap>
            );
          })}
        </div>

        {!subscription.isPremium && <PremiumBanner />}

        <div className="h-px bg-accent/[0.12]" />

        {/* Saved Folders */}
        <div className="space-y-5">
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">{t("saved").toUpperCase()}</p>
          {foldersLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-foreground/70" />
          ) : folders.length === 0 ? (
            <p className="text-[12px] text-foreground/75">{t("noSavedYet")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {folders.map(folder => (
                <button key={folder.id} className="flex items-center gap-3 rounded-xl border border-border/20 bg-card/30 p-3 text-left transition-colors hover:bg-card/50">
                  <Folder className="h-4 w-4 text-accent/70 shrink-0" />
                  <span className="text-[11px] text-foreground/75 truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-accent/[0.12]" />

        {/* Style Profile */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">{t("style").toUpperCase()}</p>
            <button onClick={() => setEditingStyle(!editingStyle)} className="text-[11px] font-medium text-accent/70 hover:text-accent/70">
              {editingStyle ? "CLOSE" : styleProfile ? "EDIT" : "SET UP"}
            </button>
          </div>
          {editingStyle ? (
            <StylePreferenceEditor
              initial={styleProfile}
              onSave={() => { setEditingStyle(false); loadProfileData(); }}
              onClose={() => setEditingStyle(false)}
            />
          ) : styleProfile ? (
            <div className="space-y-3">
              {styleProfile.preferred_styles?.length > 0 && (
                <div>
                  <p className="text-[11px] text-foreground/70 mb-1.5">PREFERRED</p>
                  <div className="flex gap-2 flex-wrap">
                    {styleProfile.preferred_styles.map((s: string) => (
                      <span key={s} className="rounded-full bg-accent/10 px-3 py-1 text-[10px] text-accent/70">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {styleProfile.disliked_styles?.length > 0 && (
                <div>
                  <p className="text-[11px] text-foreground/70 mb-1.5">AVOID</p>
                  <div className="flex gap-2 flex-wrap">
                    {styleProfile.disliked_styles.map((s: string) => (
                      <span key={s} className="rounded-full bg-destructive/10 px-3 py-1 text-[10px] text-destructive/50 line-through">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {styleProfile.preferred_fit && <p className="text-[11px] text-foreground/70">{t("preferredFit")}: <span className="text-foreground/70">{styleProfile.preferred_fit}</span></p>}
              {styleProfile.budget && <p className="text-[11px] text-foreground/70">{t("budget")}: <span className="text-foreground/70">{styleProfile.budget}</span></p>}
              {styleProfile.favorite_brands?.length > 0 && (
                <p className="text-[11px] text-foreground/70">Brands: <span className="text-foreground/70">{styleProfile.favorite_brands.join(", ")}</span></p>
              )}
              {styleProfile.occasions?.length > 0 && (
                <p className="text-[11px] text-foreground/70">Occasions: <span className="text-foreground/70">{styleProfile.occasions.join(", ")}</span></p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-foreground/75">{t("notSet")}</p>
              <button onClick={() => setEditingStyle(true)} className="text-[10px] font-medium text-accent/60 hover:text-accent">{t("completeProfile")}</button>
            </div>
          )}
        </div>

        {/* Body Profile */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">{t("bodyProfile").toUpperCase()}</p>
            <button onClick={() => navigate("/fit")} className="text-[11px] font-medium text-accent/70 hover:text-accent/70">
              {bodyProfile ? "RESCAN" : "START SCAN"}
            </button>
          </div>
          {bodyProfile ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {bodyProfile.height_cm && <p className="text-[12px] text-foreground/70">{bodyProfile.height_cm}cm</p>}
                {bodyProfile.weight_kg && <p className="text-[12px] text-foreground/70">{bodyProfile.weight_kg}kg</p>}
                {bodyProfile.shoulder_width_cm && <p className="text-[12px] text-foreground/70">{t("shoulderWidth")} {bodyProfile.shoulder_width_cm}cm</p>}
                {bodyProfile.waist_cm && <p className="text-[12px] text-foreground/70">{t("waist")} {bodyProfile.waist_cm}cm</p>}
              </div>
              {bodyProfile.silhouette_type && (
                <p className="text-[11px] text-foreground/75">Body type: <span className="text-foreground/75">{bodyProfile.silhouette_type}</span></p>
              )}
              {bodyProfile.scan_confidence > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-accent/40" style={{ width: `${bodyProfile.scan_confidence}%` }} />
                  </div>
                  <span className="text-[10px] text-foreground/75">{bodyProfile.scan_confidence}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-foreground/75">{t("noScanYet")}</p>
              <button onClick={() => navigate("/fit")} className="text-[10px] font-medium text-accent/60 hover:text-accent">{t("startScan")}</button>
            </div>
          )}
        </div>

        <div className="h-px bg-accent/[0.12]" />

        {/* My OOTDs */}
        {myOotds.length > 0 && (
          <>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/70">MY OOTDS</p>
                <button onClick={() => navigate("/ootd")} className="text-[11px] font-medium text-accent/70 hover:text-accent/70">VIEW ALL</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {myOotds.map(ootd => (
                  <div key={ootd.id} className="relative aspect-square rounded-lg overflow-hidden bg-foreground/[0.04]">
                    <img src={ootd.image_url} alt={ootd.caption || ""} className="h-full w-full object-cover" loading="lazy" />
                    {(ootd.star_count || 0) > 0 && (
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-background/60 px-1.5 py-0.5 backdrop-blur-sm">
                        <Star className="h-2.5 w-2.5 text-accent/70" />
                        <span className="text-[10px] text-foreground/70">{ootd.star_count}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="h-px bg-accent/[0.12]" />
          </>
        )}

        {/* Links */}
        <div className="space-y-1">
          {[
            { icon: Crown, label: "Subscription", action: () => navigate("/subscription") },
            { icon: Ruler, label: t("fitPreferences"), action: () => navigate("/fit") },
            { icon: Shirt, label: t("discover"), action: () => navigate("/discover") },
            { icon: Camera, label: "Post OOTD", action: () => navigate("/ootd") },
          ].map(section => (
            <button key={section.label} onClick={section.action} className="flex w-full items-center gap-5 py-4.5 transition-colors hover:text-foreground">
              <section.icon className="h-[18px] w-[18px] text-foreground/75" strokeWidth={1.5} />
              <span className="flex-1 text-left text-[13px] text-foreground/70">{section.label}</span>
              <ChevronRight className="h-4 w-4 text-foreground/70" />
            </button>
          ))}
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut} className="flex items-center gap-2 py-3 text-[11px] font-medium tracking-[0.1em] text-destructive/40 transition-colors hover:text-destructive/60">
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
