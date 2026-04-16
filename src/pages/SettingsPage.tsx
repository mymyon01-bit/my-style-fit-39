import { useI18n, type Language } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useTransition, type TransitionStyle } from "@/lib/transition";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  ArrowLeft, Check, Moon, Sun, Monitor, RotateCcw, Shield, Layers,
  User, Globe, Palette, Bell, Lock, Crown, HelpCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "it", label: "Italian", native: "Italiano" },
];

const themeOptions = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
];

const transitionOptions: { value: TransitionStyle; label: string; desc: string }[] = [
  { value: "none", label: "None", desc: "No animation" },
  { value: "vertical", label: "Vertical", desc: "Slide from bottom" },
  { value: "fade", label: "Fade", desc: "Dark to light" },
  { value: "split", label: "Split", desc: "Open from center" },
];

const SettingsPage = () => {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { transition, setTransition } = useTransition();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-center gap-4 mb-12 md:mb-14 lg:mb-16">
          <button onClick={() => navigate(-1)} className="hover-burgundy text-foreground/50">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/45 md:text-[11px]">SETTINGS</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-14 md:max-w-2xl md:px-10 md:space-y-16 lg:max-w-3xl lg:px-12">
        {/* Account */}
        {user && (
          <>
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
                <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 md:text-[11px]">ACCOUNT</p>
              </div>
              <div className="space-y-2">
                <p className="text-[13px] text-foreground/60">{user.email}</p>
                <button
                  onClick={() => navigate("/profile")}
                  className="text-[11px] font-medium text-accent/60 hover:text-accent transition-colors"
                >
                  View Profile →
                </button>
              </div>
            </div>
            <div className="h-px bg-border/30" />
          </>
        )}

        {/* Language */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 md:text-[11px]">{t("language").toUpperCase()}</p>
          </div>
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`hover-burgundy flex w-full items-center justify-between py-4 md:py-5 ${
                  lang === l.code ? "text-foreground" : "text-foreground/50"
                }`}
              >
                <p className="text-[13px] font-medium md:text-[14px]">{l.native}</p>
                {lang === l.code && <Check className="h-4 w-4 text-accent" />}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Appearance */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 md:text-[11px]">{t("appearance").toUpperCase()}</p>
          </div>
          <div className="flex gap-10 md:gap-12">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`hover-burgundy flex flex-col items-center gap-3 ${
                  theme === opt.value ? "text-foreground" : "text-foreground/40"
                }`}
              >
                <opt.icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.8} />
                <span className="text-[10px] font-semibold md:text-[11px]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Notifications */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 md:text-[11px]">NOTIFICATIONS</p>
          </div>
          <p className="text-[12px] text-foreground/35">Coming soon — get notified about daily picks and trending styles.</p>
        </div>

        <div className="h-px bg-border/30" />

        {/* Page Transition */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 md:text-[11px]">PAGE TRANSITION</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {transitionOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTransition(opt.value)}
                className={`hover-burgundy rounded-lg border px-4 py-3.5 text-left transition-all duration-300 ${
                  transition === opt.value
                    ? "border-accent/40 bg-accent/[0.06] text-foreground"
                    : "border-border/30 text-foreground/40"
                }`}
              >
                <p className="text-[12px] font-semibold md:text-[13px]">{opt.label}</p>
                <p className="mt-1 text-[10px] text-foreground/35">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Subscription */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-foreground/40" strokeWidth={1.8} />
            <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 md:text-[11px]">SUBSCRIPTION</p>
          </div>
          <div className="rounded-xl border border-border/20 bg-card/30 p-5 space-y-2">
            <p className="text-[13px] font-medium text-foreground/65">
              {subscription.isPremium
                ? subscription.plan === "premium_trial"
                  ? `Premium Trial · ${subscription.daysRemaining}d remaining`
                  : "Premium · Active"
                : "Free Plan"}
            </p>
            <p className="text-[11px] text-foreground/35">
              {subscription.isPremium
                ? "You have access to daily picks, weekly planning, and enhanced AI styling."
                : "Upgrade to Premium for deeper recommendations and weekly planning."}
            </p>
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {/* Privacy & Actions */}
        <div className="space-y-1">
          <button className="hover-burgundy flex w-full items-center gap-4 py-4.5 text-foreground/40 md:py-5">
            <Lock className="h-[18px] w-[18px]" strokeWidth={1.6} />
            <span className="text-[13px] font-medium md:text-[14px]">{t("privacy")}</span>
          </button>
          <button className="hover-burgundy flex w-full items-center gap-4 py-4.5 text-foreground/40 md:py-5">
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.6} />
            <span className="text-[13px] font-medium md:text-[14px]">{t("resetProfile")}</span>
          </button>
          <button className="hover-burgundy flex w-full items-center gap-4 py-4.5 text-foreground/40 md:py-5">
            <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.6} />
            <span className="text-[13px] font-medium md:text-[14px]">Help</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
