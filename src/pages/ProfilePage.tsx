import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt,
  Star, Trophy, Camera, LogOut, Loader2, User, Crown
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

const ProfilePage = () => {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [profile, setProfile] = useState<any>(null);
  const [styleProfile, setStyleProfile] = useState<any>(null);
  const [bodyProfile, setBodyProfile] = useState<any>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) loadProfileData();
  }, [user]);

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/20" />
      </div>
    );
  }

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";

  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-foreground/[0.04]">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/70">WARDROBE</span>
          <button onClick={() => navigate("/settings")} className="text-foreground/25 hover:text-foreground/40">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 pt-6 space-y-6">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card border border-foreground/[0.06]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-foreground/15" />
            )}
          </div>
          <div>
            <p className="font-display text-base font-semibold text-foreground">{displayName}</p>
            <p className="text-[11px] text-foreground/40">{user?.email}</p>
          </div>
        </div>

        {/* Subscription badge */}
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
          subscription.isPremium 
            ? "border-accent/30 bg-accent/5" 
            : "border-foreground/[0.06] bg-card/30"
        }`}>
          <Crown className={`h-5 w-5 ${subscription.isPremium ? "text-accent" : "text-foreground/20"}`} />
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">
              {subscription.isPremium ? "Premium Active" : "Free Plan"}
            </p>
            {subscription.isPremium && subscription.daysRemaining !== null && (
              <p className="text-[10px] text-foreground/40">
                {subscription.plan === "premium_trial" ? `Trial ends in ${subscription.daysRemaining} days` : "Active subscription"}
              </p>
            )}
            {!subscription.isPremium && (
              <p className="text-[10px] text-foreground/40">Upgrade for daily & weekly styling</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Camera, label: "Posts", value: postCount },
            { icon: Star, label: "Stars", value: totalStars },
            { icon: Bookmark, label: "Saved", value: savedCount },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center gap-1 rounded-2xl border border-foreground/[0.04] bg-card/30 p-3">
              <stat.icon className="h-4 w-4 text-accent/60" />
              <span className="text-sm font-bold text-foreground">{stat.value}</span>
              <span className="text-[9px] text-foreground/25">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Style profile */}
        <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">STYLE PROFILE</p>
          {styleProfile ? (
            <div className="space-y-2">
              {styleProfile.preferred_styles?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {styleProfile.preferred_styles.map((s: string) => (
                    <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{s}</span>
                  ))}
                </div>
              )}
              {styleProfile.preferred_fit && (
                <p className="text-xs text-foreground/40">Fit: {styleProfile.preferred_fit}</p>
              )}
              {styleProfile.budget && (
                <p className="text-xs text-foreground/40">Budget: {styleProfile.budget}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-foreground/35">No style profile yet</p>
              <button
                onClick={() => navigate("/onboarding")}
                className="text-[10px] font-semibold text-accent hover:underline"
              >
                Complete your style profile →
              </button>
            </div>
          )}
        </div>

        {/* Body profile */}
        <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">BODY PROFILE</p>
          {bodyProfile ? (
            <div className="grid grid-cols-2 gap-2">
              {bodyProfile.height_cm && (
                <p className="text-xs text-foreground/40">Height: {bodyProfile.height_cm}cm</p>
              )}
              {bodyProfile.weight_kg && (
                <p className="text-xs text-foreground/40">Weight: {bodyProfile.weight_kg}kg</p>
              )}
              {bodyProfile.shoulder_width_cm && (
                <p className="text-xs text-foreground/40">Shoulders: {bodyProfile.shoulder_width_cm}cm</p>
              )}
              {bodyProfile.waist_cm && (
                <p className="text-xs text-foreground/40">Waist: {bodyProfile.waist_cm}cm</p>
              )}
              {bodyProfile.silhouette_type && (
                <p className="text-xs text-foreground/40">Silhouette: {bodyProfile.silhouette_type}</p>
              )}
              <p className="text-[9px] text-foreground/20 col-span-2">
                Scan confidence: {bodyProfile.scan_confidence || 0}%
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-foreground/35">No body scan yet</p>
              <button
                onClick={() => navigate("/fit")}
                className="text-[10px] font-semibold text-accent hover:underline"
              >
                Start your body scan →
              </button>
            </div>
          )}
        </div>

        {/* Profile sections */}
        <div className="space-y-0.5">
          {[
            { icon: Ruler, label: "Fit Preferences", action: () => navigate("/fit") },
            { icon: Palette, label: "Style Settings", action: () => navigate("/onboarding") },
            { icon: Shirt, label: "Saved Looks", action: () => navigate("/discover") },
          ].map(section => (
            <button
              key={section.label}
              onClick={section.action}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-card/40"
            >
              <section.icon className="h-4 w-4 text-foreground/20" />
              <span className="flex-1 text-left text-sm text-foreground/60">{section.label}</span>
              <ChevronRight className="h-4 w-4 text-foreground/10" />
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 py-3 text-sm font-medium text-destructive/60 transition-colors hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
