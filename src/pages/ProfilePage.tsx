import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt,
  Star, Camera, LogOut, Loader2, User, Crown, Folder, Shield,
  Edit3, CheckCircle, XCircle, Upload, Save, Image, Lock
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import StylePreferenceEditor from "@/components/StylePreferenceEditor";
import CirclesSheet from "@/components/CirclesSheet";
import { useNavigate, useSearchParams } from "react-router-dom";
import StyleBoardDetailSheet from "@/components/profile/StyleBoardDetailSheet";
import { useSubscription } from "@/hooks/useSubscription";
import { useSavedFolders } from "@/hooks/useSavedFolders";
import { useAdmin } from "@/hooks/useAdmin";
import PremiumBanner from "@/components/PremiumBanner";
import TodayPicks from "@/components/today/TodayPicks";
import SavedProductsTab from "@/components/profile/SavedProductsTab";
import StyleMeButton from "@/components/StyleMeButton";
// MessagesInbox moved to OOTD My Page (full-screen sheet)
import { toast } from "sonner";
import ShowroomMyBlock from "@/components/showroom/ShowroomMyBlock";
import StyleBoardsPanel from "@/components/profile/StyleBoardsPanel";
import CountUp from "@/components/CountUp";
import ShootingStarIcon from "@/components/ShootingStarIcon";
import { useCircleCounts } from "@/hooks/useCircleCounts";

const ProfilePage = () => {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBoardId = searchParams.get("board");
  const closeBoardSheet = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("board");
    setSearchParams(next, { replace: true });
  };
  const { subscription } = useSubscription();
  const { folders, loading: foldersLoading } = useSavedFolders();
  const { isAdmin } = useAdmin();
  const [userCount, setUserCount] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setUserCount(count ?? 0));
  }, [isAdmin]);

  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [bodyProfile, setBodyProfile] = useState<any>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editGender, setEditGender] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [editHashtags, setEditHashtags] = useState("");
  const [scrapCount, setScrapCount] = useState(0);
  const [myOotds, setMyOotds] = useState<any[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [circlesSheet, setCirclesSheet] = useState<{ open: boolean; tab: "circle" | "ripple" }>({ open: false, tab: "circle" });
  const { counts: circleCounts, refresh: refreshCircleCounts } = useCircleCounts(user?.id);

  useEffect(() => { if (user) loadProfileData(); }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    setIsLoading(true);
    const [profileRes, styleRes, bodyRes, savedRes, postsRes, ootdsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("saved_items").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("ootd_posts").select("id, star_count", { count: "exact" }).eq("user_id", user.id),
      supabase.from("ootd_posts").select("id, image_url, caption, star_count, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    ]);

    // Load scrap count. Circle/Ripple counters come from useCircleCounts.
    const [scrapRes] = await Promise.all([
      supabase.from("saved_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setScrapCount(scrapRes.count || 0);

    const p = profileRes.data;
    setProfile(p);
    setStyleProfile(styleRes.data);
    setBodyProfile(bodyRes.data);
    setSavedCount(savedRes.count || 0);
    const posts = postsRes.data || [];
    setPostCount(postsRes.count ?? posts.length);
    const postStars = posts.reduce((sum: number, pt: any) => sum + (pt.star_count || 0), 0);
    setTotalStars(postStars);
    setMyOotds(ootdsRes.data || []);
    if (p) {
      setEditName(p.display_name || "");
      setEditUsername(p.username || "");
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
    if (file.size > 5 * 1024 * 1024) { toast.error(t("profilePhotoMaxSize")); return; }
    if (!file.type.startsWith("image/")) { toast.error(t("profileSelectImage")); return; }

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
      toast.success(t("profilePhotoUpdated"));
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast.error(t("profilePhotoFailed"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setUsernameError(null);
    setSavingProfile(true);
    const parsedHashtags = editHashtags.split(/[,\s]+/).map(h => h.replace(/^#/, "").trim()).filter(Boolean);
    const newUsername = editUsername.trim().toLowerCase();
    const usernameChanged = newUsername && newUsername !== (profile?.username || "");

    // Client-side username validation (mirror DB rules)
    if (usernameChanged) {
      if (newUsername.length < 1 || newUsername.length > 30) {
        setUsernameError(t("profileUsernameLen"));
        setSavingProfile(false);
        return;
      }
      if (!/^[a-z0-9._]+$/.test(newUsername)) {
        setUsernameError(t("profileUsernameChars"));
        setSavingProfile(false);
        return;
      }
      if (/\s/.test(newUsername)) {
        setUsernameError(t("profileUsernameSpace"));
        setSavingProfile(false);
        return;
      }
      if (/\.{2,}/.test(newUsername) || /^[._]/.test(newUsername) || /[._]$/.test(newUsername)) {
        setUsernameError(t("profileUsernameEdges"));
        setSavingProfile(false);
        return;
      }
    }

    try {
      const updates: any = {
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
        location: editLocation.trim() || null,
        gender_preference: editGender.trim() || null,
        hashtags: parsedHashtags.length > 0 ? parsedHashtags : null,
      };
      if (usernameChanged) updates.username = newUsername;

      const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
      if (error) {
        const msg = String(error.message || "");
        if (msg.includes("username_yearly_limit")) {
          setUsernameError(t("profileUsernameYearly"));
        } else if (msg.includes("username_monthly_lock")) {
          setUsernameError(t("profileUsernameLock"));
        } else if (msg.includes("username_") || msg.toLowerCase().includes("username")) {
          setUsernameError(t("profileUsernameUnavailable"));
        } else if (msg.includes("duplicate") || msg.includes("unique")) {
          setUsernameError(t("profileUsernameTaken"));
        } else {
          toast.error(t("profileSaveFailed"));
        }
        setSavingProfile(false);
        return;
      }
      setProfile((p: any) => ({
        ...p,
        display_name: editName.trim(),
        bio: editBio.trim(),
        location: editLocation.trim(),
        gender_preference: editGender.trim(),
        hashtags: parsedHashtags,
        username: usernameChanged ? newUsername : p?.username,
        username_changes: usernameChanged ? [...(p?.username_changes || []), new Date().toISOString()] : p?.username_changes,
      }));
      setIsEditing(false);
      toast.success(t("profileSaved"));
    } catch {
      toast.error(t("profileSaveFailed"));
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
  // OOTD에서는 표시 이름으로 username(@핸들)을 사용 — 공백이 있는 display_name을
  // 가진 사용자에게는 멘션 가능한 짧은 아이디로 정리하라고 안내한다.
  const displayNameHasSpace = !!profile?.display_name && /\s/.test(profile.display_name);
  const circleCount = circleCounts?.circle ?? 0;
  const rippleCount = circleCounts?.ripple ?? 0;

  return (
    <div className="min-h-screen pb-28 bg-background md:pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-baseline justify-between mb-12">
          <span className="flex items-baseline font-display text-[15px] font-light leading-none text-foreground lg:hidden">
            <span className="tracking-[0.05em]">my</span>
            <span aria-hidden className="mx-[0.18em] inline-block h-[2.5px] w-[2.5px] translate-y-[-0.55em] rounded-full bg-accent/70" />
            <span className="tracking-[0.05em]">myon</span>
          </span>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <>
                <span className="rounded-full border border-accent/30 bg-accent/[0.06] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-accent/80">
                  USERS {userCount !== null ? userCount.toLocaleString() : "…"}
                </span>
                <button onClick={() => navigate("/admin")} className="text-accent/60 hover:text-accent/80 transition-colors">
                  <Shield className="h-[18px] w-[18px]" />
                </button>
              </>
            )}
            <button onClick={() => navigate("/settings")} className="text-foreground/75 hover:text-foreground/70 transition-colors">
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-10 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12">
        {/* OOTD 멘션용 아이디 안내 — 표시 이름에 공백이 있으면 username 정리 권유 */}
        {displayNameHasSpace && (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full rounded-xl border border-accent/25 bg-accent/[0.04] px-4 py-3 text-left transition-colors hover:bg-accent/[0.08]"
          >
            <p className="text-[11px] font-semibold text-accent/80">
              OOTD에서 사용할 아이디를 설정해 주세요
            </p>
            <p className="mt-1 text-[10px] leading-snug text-foreground/60">
              현재 이름 “{profile?.display_name}”에 공백이 있어 다른 사용자가 @로 멘션할 수 없어요.
              아래 EDIT PROFILE에서 공백 없는 아이디(@username)를 정해주세요.
            </p>
          </button>
        )}

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
              {profile?.username && (
                <span className="text-[11px] text-foreground/50">@{profile.username}</span>
              )}
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
            <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70">{t("profileEditProfile")}</p>

            {/* Username — special handling */}
            <div>
              <label className="text-[10px] font-medium text-foreground/75">{t("profileUsernameLabel")}</label>
              <div className="mt-1 flex items-center gap-1 border-b border-border/20 focus-within:border-accent/30 transition-colors">
                <span className="text-[13px] text-foreground/50">@</span>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => {
                    // strip spaces + uppercase live; keep allowed chars only typed
                    const v = e.target.value.toLowerCase().replace(/\s+/g, "").slice(0, 30);
                    setEditUsername(v);
                    if (usernameError) setUsernameError(null);
                  }}
                  placeholder="your_id"
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 bg-transparent py-2.5 text-[13px] text-foreground outline-none placeholder:text-foreground/50"
                />
              </div>
              <p className="mt-1 text-[10px] text-foreground/50">
                1–30자 · 영문 소문자/숫자/점/밑줄만 · 공백 불가 · 1년 3회, 변경 후 30일간 잠금
              </p>
              {usernameError && (
                <p className="mt-1 text-[10px] text-destructive">{usernameError}</p>
              )}
              {profile?.username_changes && profile.username_changes.length > 0 && (() => {
                const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
                const last = new Date(profile.username_changes[profile.username_changes.length - 1]).getTime();
                const recent = profile.username_changes.filter((t: string) => new Date(t).getTime() > yearAgo).length;
                const daysSince = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
                const remaining = Math.max(0, 30 - daysSince);
                return (
                  <p className="mt-1 text-[10px] text-foreground/45">
                    올해 변경 {recent}/3회{remaining > 0 ? ` · 다음 변경까지 ${remaining}일` : " · 지금 변경 가능"}
                  </p>
                );
              })()}
            </div>

            {[
              { label: t("profileFieldDisplayName"), value: editName, set: setEditName, placeholder: t("profileFieldDisplayNamePh") },
              { label: t("profileFieldBio"), value: editBio, set: setEditBio, placeholder: t("profileFieldBioPh") },
              { label: t("profileFieldLocation"), value: editLocation, set: setEditLocation, placeholder: t("profileFieldLocationPh") },
              { label: t("profileFieldGender"), value: editGender, set: setEditGender, placeholder: t("profileFieldGenderPh") },
              { label: t("profileFieldHashtags"), value: editHashtags, set: setEditHashtags, placeholder: t("profileFieldHashtagsPh") },
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
              <button onClick={() => setIsEditing(false)} className="text-[11px] text-foreground/70 hover:text-foreground/70">{t("profileCancel")}</button>
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
            <span className="text-[11px] text-foreground/60">{t("profilePrivate")}</span>
          </div>
          <button
            onClick={async () => {
              const newVal = !isPrivate;
              setIsPrivate(newVal);
              await supabase.from("profiles").update({ is_private: newVal } as any).eq("user_id", user!.id);
              toast.success(newVal ? t("profilePrivateOn") : t("profilePrivateOff"));
            }}
            className={`relative h-5 w-9 rounded-full transition-colors ${isPrivate ? "bg-accent/60" : "bg-foreground/10"}`}
          >
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform ${isPrivate ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Stats — fixed 3-column grid so labels never break the row on mobile */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { key: "posts", icon: Camera, label: t("posts"), value: postCount, onClick: undefined as undefined | (() => void) },
            { key: "stars", icon: Star, label: t("starsReceived"), value: totalStars, onClick: undefined },
            { key: "saved", icon: Bookmark, label: t("saved"), value: savedCount, onClick: undefined },
            { key: "circle", icon: Crown, label: t("profileLabelCircle"), value: circleCount, onClick: () => setCirclesSheet({ open: true, tab: "circle" }) },
            { key: "ripple", icon: Crown, label: t("profileLabelRipple"), value: rippleCount, onClick: () => setCirclesSheet({ open: true, tab: "ripple" }) },
            { key: "scrap", icon: Bookmark, label: t("profileLabelScrap"), value: scrapCount, onClick: undefined },
          ].map(stat => {
            if (stat.key === "stars") {
              return (
                <ProfileStarsStat
                  key={stat.key}
                  value={Number(stat.value) || 0}
                  receivedLabel={stat.label}
                />
              );
            }
            const Wrap: any = stat.onClick ? "button" : "div";
            return (
              <Wrap
                key={stat.key}
                onClick={stat.onClick}
                className={`flex flex-col items-center justify-center text-center min-w-0 ${stat.onClick ? "hover:text-accent transition-colors cursor-pointer" : ""}`}
              >
                <CountUp value={Number(stat.value) || 0} className="text-xl font-light text-foreground/80 tabular-nums" />
                <p className="text-[10px] text-foreground/70 mt-1.5 truncate">{stat.label}</p>
              </Wrap>
            );
          })}
        </div>

        {!subscription.isPremium && <PremiumBanner />}

        <div className="flex justify-center">
          <StyleMeButton variant="solid" />
        </div>

        <div className="h-px bg-accent/[0.12]" />

        {/* Today's 5 Looks — quiz-driven (always visible, top of MY) */}
        <TodayPicks />

        <div className="h-px bg-accent/[0.12]" />

        {/* MY — collapsible sections, infographic-style headers */}
        <Accordion type="multiple" defaultValue={["saved"]} className="space-y-2">
          {/* Saved & Curated */}
          <AccordionItem value="saved" className="border border-foreground/10 rounded-xl bg-card/30 px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Bookmark className="h-4 w-4 text-foreground/60" />
                <div className="text-left">
                  <p className="font-display text-[15px] tracking-tight text-foreground">{t("profileSavedTitle")}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">{savedCount} items</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              <SavedProductsTab />
              {folders.length > 0 && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {folders.map(folder => (
                    <button key={folder.id} className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-card/40 p-2.5 text-left hover:bg-card/60">
                      <Folder className="h-3.5 w-3.5 text-foreground/55 shrink-0" />
                      <span className="text-[11px] text-foreground/75 truncate">{folder.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Style Boards */}
          <AccordionItem value="boards" className="border border-foreground/10 rounded-xl bg-card/30 px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Palette className="h-4 w-4 text-foreground/60" />
                <div className="text-left">
                  <p className="font-display text-[15px] tracking-tight text-foreground">{t("profileBoardsTitle")}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">{t("profileBoardsSub")}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <StyleBoardsPanel />
            </AccordionContent>
          </AccordionItem>

          {/* Style Profile */}
          <AccordionItem value="style" className="border border-foreground/10 rounded-xl bg-card/30 px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Shirt className="h-4 w-4 text-foreground/60" />
                <div className="text-left">
                  <p className="font-display text-[15px] tracking-tight text-foreground">{t("profileStyleTitle")}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                    {styleProfile?.preferred_styles?.length
                      ? `${styleProfile.preferred_styles.length} preferences`
                      : t("profileNotSet")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <div className="flex justify-end">
                <button onClick={() => setEditingStyle(!editingStyle)} className="text-[10px] font-semibold tracking-[0.15em] text-accent/70 hover:text-accent">
                  {editingStyle ? t("profileEditClose") : styleProfile ? t("profileEditEdit") : t("profileEditSetUp")}
                </button>
              </div>
              {editingStyle ? (
                <StylePreferenceEditor
                  initial={styleProfile}
                  onSave={() => { setEditingStyle(false); loadProfileData(); }}
                  onClose={() => setEditingStyle(false)}
                />
              ) : styleProfile ? (
                <div className="space-y-2">
                  {styleProfile.preferred_styles?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {styleProfile.preferred_styles.map((s: string) => (
                        <span key={s} className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] text-accent/80">{s}</span>
                      ))}
                    </div>
                  )}
                  {styleProfile.disliked_styles?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {styleProfile.disliked_styles.map((s: string) => (
                        <span key={s} className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] text-destructive/60 line-through">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-foreground/65">
                    {styleProfile.preferred_fit && <p>Fit · <span className="text-foreground/85">{styleProfile.preferred_fit}</span></p>}
                    {styleProfile.budget && <p>Budget · <span className="text-foreground/85">{styleProfile.budget}</span></p>}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-foreground/55">{t("notSet")}</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Body Profile — infographic */}
          <AccordionItem value="body" className="border border-foreground/10 rounded-xl bg-card/30 px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Ruler className="h-4 w-4 text-foreground/60" />
                <div className="text-left">
                  <p className="font-display text-[15px] tracking-tight text-foreground">{t("profileBodyTitle")}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                    {bodyProfile?.silhouette_type || (bodyProfile ? t("profileBodyScanned") : t("profileBodyNotScanned"))}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              {bodyProfile ? (
                <>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "HT", value: bodyProfile.height_cm ? `${bodyProfile.height_cm}` : "—", unit: "cm" },
                      { label: "WT", value: bodyProfile.weight_kg ? `${bodyProfile.weight_kg}` : "—", unit: "kg" },
                      { label: "SHL", value: bodyProfile.shoulder_width_cm ? `${bodyProfile.shoulder_width_cm}` : "—", unit: "cm" },
                      { label: "WST", value: bodyProfile.waist_cm ? `${bodyProfile.waist_cm}` : "—", unit: "cm" },
                    ].map(s => (
                      <div key={s.label} className="rounded-lg bg-foreground/[0.04] py-2">
                        <p className="font-display text-[15px] text-foreground tabular-nums">{s.value}</p>
                        <p className="text-[8.5px] uppercase tracking-wider text-foreground/45">{s.label} · {s.unit}</p>
                      </div>
                    ))}
                  </div>
                  {bodyProfile.scan_confidence > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-accent/50" style={{ width: `${bodyProfile.scan_confidence}%` }} />
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-foreground/55">{bodyProfile.scan_confidence}% conf.</span>
                    </div>
                  )}
                  <button onClick={() => navigate("/fit")} className="text-[10px] font-semibold tracking-[0.15em] text-accent/70 hover:text-accent">{t("profileRescan")}</button>
                </>
              ) : (
                <button onClick={() => navigate("/fit")} className="text-[11px] font-semibold tracking-wide text-accent/80 hover:text-accent">{t("profileStartScan")}</button>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* My OOTDs */}
          {myOotds.length > 0 && (
            <AccordionItem value="ootds" className="border border-foreground/10 rounded-xl bg-card/30 px-4">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Camera className="h-4 w-4 text-foreground/60" />
                  <div className="text-left">
                    <p className="font-display text-[15px] tracking-tight text-foreground">OOTDs</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">{myOotds.length} posts · {totalStars} ★</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
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
                <button onClick={() => navigate("/ootd")} className="mt-3 text-[10px] font-semibold tracking-[0.15em] text-accent/70 hover:text-accent">{t("profileViewAll")}</button>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Showroom */}
          <AccordionItem value="showroom" className="border border-foreground/10 rounded-xl bg-card/30 px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Crown className="h-4 w-4 text-foreground/60" />
                <div className="text-left">
                  <p className="font-display text-[15px] tracking-tight text-foreground">{t("profileShowroom")}</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">{t("profileShowroomSub")}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ShowroomMyBlock userId={user?.id} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <StyleBoardDetailSheet boardId={activeBoardId} onClose={closeBoardSheet} />

        <div className="h-px bg-accent/[0.12]" />

        {/* Links */}
        <div className="space-y-1">
          {[
            { icon: Crown, label: t("profileLinkSubscription"), action: () => navigate("/subscription") },
            { icon: Ruler, label: t("fitPreferences"), action: () => navigate("/fit") },
            { icon: Shirt, label: t("discover"), action: () => navigate("/discover") },
            { icon: Camera, label: t("profileLinkPostOotd"), action: () => navigate("/ootd") },
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

      <CirclesSheet
        open={circlesSheet.open}
        initialTab={circlesSheet.tab}
        onClose={() => setCirclesSheet(s => ({ ...s, open: false }))}
        onChanged={refreshCircleCounts}
      />
    </div>
  );
};

/**
 * Stars stat for the profile grid: shows a shooting-star icon under the
 * count by default. Tapping reveals the localized "Received" label briefly.
 */
const ProfileStarsStat = ({ value, receivedLabel }: { value: number; receivedLabel: string }) => {
  const [showLabel, setShowLabel] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setShowLabel(true);
        window.setTimeout(() => setShowLabel(false), 1800);
      }}
      className="flex flex-col items-center justify-center text-center min-w-0 hover:opacity-80 active:scale-95 transition-all"
      aria-label={receivedLabel}
    >
      <CountUp value={value} className="text-xl font-light text-foreground/80 tabular-nums" />
      <div className="mt-1.5 flex h-[14px] items-center justify-center text-amber-400">
        {showLabel ? (
          <span className="text-[10px] text-accent/80 truncate whitespace-nowrap">{receivedLabel}</span>
        ) : (
          <ShootingStarIcon size={16} />
        )}
      </div>
    </button>
  );
};

export default ProfilePage;
