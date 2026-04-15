import { useI18n } from "@/lib/i18n";
import { mockUserProfile } from "@/lib/mockData";
import { Settings, ChevronRight, Bookmark, Ruler, Palette, Shirt } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const sections = [
    { icon: Ruler, label: t("bodyProfile"), value: mockUserProfile.bodyType },
    { icon: Palette, label: t("preferences"), value: mockUserProfile.colorDirection },
    { icon: Shirt, label: t("styleProfile"), value: mockUserProfile.style },
    { icon: Bookmark, label: t("savedItems"), value: "12 items" },
  ];

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold text-foreground">{t("profile")}</h1>
          <button onClick={() => navigate("/settings")} className="text-muted-foreground">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl">
            👤
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Your Style Profile</p>
            <p className="text-xs text-muted-foreground">{mockUserProfile.style}</p>
          </div>
        </div>

        {/* AI Summary */}
        <div className="mt-5 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">AI Analysis</p>
          <div className="mt-3 space-y-2.5">
            {mockUserProfile.aiSummary.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Profile sections */}
        <div className="mt-5 space-y-1">
          {sections.map((section) => (
            <button
              key={section.label}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-secondary"
            >
              <section.icon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{section.label}</p>
                <p className="text-xs text-muted-foreground">{section.value}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Fit direction */}
        <div className="mt-5 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fit Direction
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {mockUserProfile.fitDirection}
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Silhouette
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {mockUserProfile.silhouette}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
