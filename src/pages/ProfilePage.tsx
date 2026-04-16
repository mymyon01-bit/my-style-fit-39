import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt,
  Star, Camera, LogOut, Loader2, User, Crown, Folder, Shield
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useSavedFolders } from "@/hooks/useSavedFolders";
import { useAdmin } from "@/hooks/useAdmin";

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

  useEffect(() => { if (user) loadProfileData(); }, [user]);

  const loadProfileData = async () => {
    if (!user) return;
    setIsLoading(true);
    const [profileRes, styleRes, bodyRes, savedRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("saved_items").select("id", { count: "exact" }).eq("user_id", user.id),
      supabase.from("ootd_posts").select("id, star_count").eq("user_id", user.id),
    ]);
    setProfile(profileRes.data);
    setStyleProfile(styleRes.data);
    setBodyProfile(bodyRes.data);
    setSavedCount(savedRes.count || 0);
    const posts = postsRes.data || [];
    setPostCount(posts.length);
    setTotalStars(posts.reduce((sum, p) => sum + (p.star_count || 0), 0));
    setIsLoading(false);
  };

  const handleSignOut = async () => { await signOut(); navigate("/", { replace: true }); };

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
            <button onClick={() => navigate("/settings")} className="text-foreground/60 hover:text-foreground/70 transition-colors">
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-12 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12">
        {/* Identity */}
        <div className="flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground/[0.03]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-foreground/40" />
            )}
          </div>
          <div>
            <p className="font-display text-lg text-foreground/80">{displayName}</p>
            <p className="text-[11px] text-foreground/50 mt-1">{user?.email}</p>
          </div>
        </div>

        {/* Subscription */}
        <div className="flex items-center gap-4">
          <Crown className={`h-4 w-4 ${subscription.isPremium ? "text-accent/70" : "text-foreground/30"}`} />
          <div>
            <p className="text-[11px] font-medium text-foreground/60">{subscription.isPremium ? "Premium" : "Free"}</p>
            {subscription.isPremium && subscription.daysRemaining !== null && (
              <p className="text-[10px] text-foreground/40">{subscription.plan === "premium_trial" ? `Trial · ${subscription.daysRemaining}d remaining` : "Active"}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-12">
          {[
            { icon: Camera, label: "Posts", value: postCount },
            { icon: Star, label: "Stars", value: totalStars },
            { icon: Bookmark, label: "Saved", value: savedCount },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-xl font-light text-foreground/80">{stat.value}</p>
              <p className="text-[10px] text-foreground/50 mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="h-px bg-accent/[0.12]" />

        {/* Saved Folders */}
        <div className="space-y-5">
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/50">SAVED</p>
          {foldersLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
          ) : folders.length === 0 ? (
            <p className="text-[12px] text-foreground/40">No saved items yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  className="flex items-center gap-3 rounded-xl border border-border/20 bg-card/30 p-3 text-left transition-colors hover:bg-card/50"
                >
                  <Folder className="h-4 w-4 text-accent/50 shrink-0" />
                  <span className="text-[11px] text-foreground/60 truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-accent/[0.12]" />

        {/* Style */}
        <div className="space-y-5">
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/50">STYLE</p>
          {styleProfile ? (
            <div className="space-y-3">
              {styleProfile.preferred_styles?.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {styleProfile.preferred_styles.map((s: string) => (
                    <span key={s} className="text-[12px] text-accent/70">{s}</span>
                  ))}
                </div>
              )}
              {styleProfile.preferred_fit && <p className="text-[12px] text-foreground/50">Fit: {styleProfile.preferred_fit}</p>}
              {styleProfile.budget && <p className="text-[12px] text-foreground/50">Budget: {styleProfile.budget}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-foreground/40">Not set</p>
              <button onClick={() => navigate("/onboarding")} className="text-[10px] font-medium text-accent/60 hover:text-accent">Complete profile →</button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="space-y-5">
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/50">BODY</p>
          {bodyProfile ? (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {bodyProfile.height_cm && <p className="text-[12px] text-foreground/50">{bodyProfile.height_cm}cm</p>}
              {bodyProfile.weight_kg && <p className="text-[12px] text-foreground/50">{bodyProfile.weight_kg}kg</p>}
              {bodyProfile.shoulder_width_cm && <p className="text-[12px] text-foreground/50">Shoulder {bodyProfile.shoulder_width_cm}cm</p>}
              {bodyProfile.waist_cm && <p className="text-[12px] text-foreground/50">Waist {bodyProfile.waist_cm}cm</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] text-foreground/40">No scan yet</p>
              <button onClick={() => navigate("/fit")} className="text-[10px] font-medium text-accent/60 hover:text-accent">Start scan →</button>
            </div>
          )}
        </div>

        <div className="h-px bg-accent/[0.12]" />

        {/* Links */}
        <div className="space-y-1">
          {[
            { icon: Ruler, label: "Fit Preferences", action: () => navigate("/fit") },
            { icon: Palette, label: "Style Settings", action: () => navigate("/onboarding") },
            { icon: Shirt, label: "Discover", action: () => navigate("/discover") },
          ].map(section => (
            <button key={section.label} onClick={section.action} className="flex w-full items-center gap-5 py-4.5 transition-colors hover:text-foreground">
              <section.icon className="h-[18px] w-[18px] text-foreground/40" strokeWidth={1.5} />
              <span className="flex-1 text-left text-[13px] text-foreground/50">{section.label}</span>
              <ChevronRight className="h-4 w-4 text-foreground/30" />
            </button>
          ))}
        </div>

        {/* Sign out */}
        <button onClick={handleSignOut} className="flex items-center gap-2 py-3 text-[11px] font-medium tracking-[0.1em] text-destructive/40 transition-colors hover:text-destructive/60">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
