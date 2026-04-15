import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt,
  Star, Camera, LogOut, Loader2, User, Crown
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
        <Loader2 className="h-4 w-4 animate-spin text-foreground/15" />
      </div>
    );
  }

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "You";

  return (
    <div className="min-h-screen pb-28 bg-background">
      {/* Header */}
      <div className="mx-auto max-w-lg px-8 pt-8">
        <div className="flex items-baseline justify-between mb-10">
          <span className="font-display text-[11px] font-medium tracking-[0.35em] text-foreground/25">WARDROBE</span>
          <button onClick={() => navigate("/settings")} className="text-foreground/15 hover:text-foreground/30 transition-colors">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-10">
        {/* Identity */}
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.03]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-foreground/12" />
            )}
          </div>
          <div>
            <p className="font-display text-base text-foreground/80">{displayName}</p>
            <p className="text-[10px] text-foreground/25 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Subscription */}
        <div className="flex items-center gap-4">
          <Crown className={`h-4 w-4 ${subscription.isPremium ? "text-accent/70" : "text-foreground/12"}`} />
          <div>
            <p className="text-[10px] font-medium text-foreground/50">
              {subscription.isPremium ? "Premium" : "Free"}
            </p>
            {subscription.isPremium && subscription.daysRemaining !== null && (
              <p className="text-[9px] text-foreground/25">
                {subscription.plan === "premium_trial" ? `Trial · ${subscription.daysRemaining}d remaining` : "Active"}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-10">
          {[
            { icon: Camera, label: "Posts", value: postCount },
            { icon: Star, label: "Stars", value: totalStars },
            { icon: Bookmark, label: "Saved", value: savedCount },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-light text-foreground/70">{stat.value}</p>
              <p className="text-[9px] text-foreground/20 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="h-px bg-foreground/[0.04]" />

        {/* Style */}
        <div className="space-y-3">
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20">STYLE</p>
          {styleProfile ? (
            <div className="space-y-2">
              {styleProfile.preferred_styles?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {styleProfile.preferred_styles.map((s: string) => (
                    <span key={s} className="text-[10px] text-accent/60">{s}</span>
                  ))}
                </div>
              )}
              {styleProfile.preferred_fit && <p className="text-[11px] text-foreground/30">Fit: {styleProfile.preferred_fit}</p>}
              {styleProfile.budget && <p className="text-[11px] text-foreground/30">Budget: {styleProfile.budget}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-foreground/20">Not set</p>
              <button onClick={() => navigate("/onboarding")} className="text-[9px] font-medium text-accent/50 hover:text-accent">
                Complete profile →
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="space-y-3">
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20">BODY</p>
          {bodyProfile ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {bodyProfile.height_cm && <p className="text-[11px] text-foreground/30">{bodyProfile.height_cm}cm</p>}
              {bodyProfile.weight_kg && <p className="text-[11px] text-foreground/30">{bodyProfile.weight_kg}kg</p>}
              {bodyProfile.shoulder_width_cm && <p className="text-[11px] text-foreground/30">Shoulder {bodyProfile.shoulder_width_cm}cm</p>}
              {bodyProfile.waist_cm && <p className="text-[11px] text-foreground/30">Waist {bodyProfile.waist_cm}cm</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-foreground/20">No scan yet</p>
              <button onClick={() => navigate("/fit")} className="text-[9px] font-medium text-accent/50 hover:text-accent">
                Start scan →
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-foreground/[0.04]" />

        {/* Links */}
        <div className="space-y-1">
          {[
            { icon: Ruler, label: "Fit Preferences", action: () => navigate("/fit") },
            { icon: Palette, label: "Style Settings", action: () => navigate("/onboarding") },
            { icon: Shirt, label: "Saved Looks", action: () => navigate("/discover") },
          ].map(section => (
            <button key={section.label} onClick={section.action} className="flex w-full items-center gap-4 py-3.5 transition-colors hover:text-foreground">
              <section.icon className="h-4 w-4 text-foreground/12" />
              <span className="flex-1 text-left text-[12px] text-foreground/40">{section.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-foreground/8" />
            </button>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 py-3 text-[10px] font-medium tracking-[0.1em] text-destructive/40 transition-colors hover:text-destructive/60"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
