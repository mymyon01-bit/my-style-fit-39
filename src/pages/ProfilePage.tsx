import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { mockUserProfile } from "@/lib/mockData";
import { Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt, Star, Trophy, Camera, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const profileSections = [
    { icon: Ruler, label: t("bodyProfile"), value: mockUserProfile.bodyType },
    { icon: Palette, label: t("preferences"), value: mockUserProfile.colorDirection },
    { icon: Shirt, label: t("styleProfile"), value: mockUserProfile.style },
    { icon: Bookmark, label: t("savedItems"), value: "12 items" },
  ];

  const ootdStats = [
    { icon: Camera, label: t("myPosts"), value: "8" },
    { icon: Star, label: t("starsReceived"), value: "342" },
    { icon: Trophy, label: t("ranking"), value: "#12" },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold text-foreground">{t("profile")}</h1>
          <button onClick={() => navigate("/settings")} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary text-muted-foreground">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-2xl ring-2 ring-accent/20">
            👤
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold text-foreground">
              {user?.email?.split("@")[0] || "Your Style Profile"}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email || mockUserProfile.style}</p>
          </div>
        </div>

        {/* OOTD Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {ootdStats.map(stat => (
            <div key={stat.label} className="flex flex-col items-center gap-1 rounded-2xl bg-card border border-border p-3 shadow-card">
              <stat.icon className="h-4 w-4 text-accent" />
              <span className="text-base font-bold text-foreground">{stat.value}</span>
              <span className="text-[10px] text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent">AI Analysis</p>
          <div className="mt-3 space-y-2">
            {mockUserProfile.aiSummary.map((line, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-foreground">{line}</p>
            ))}
          </div>
        </div>

        {/* Profile sections */}
        <div className="mt-4 space-y-0.5">
          {profileSections.map((section) => (
            <button
              key={section.label}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary"
            >
              <section.icon className="h-4.5 w-4.5 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{section.label}</p>
                <p className="text-[11px] text-muted-foreground">{section.value}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Fit + Silhouette */}
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Fit Direction</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{mockUserProfile.fitDirection}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Silhouette</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">{mockUserProfile.silhouette}</p>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
