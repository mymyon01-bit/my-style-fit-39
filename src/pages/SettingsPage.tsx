import { useI18n, type Language } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { ArrowLeft, Check, Moon, Sun, Monitor, RotateCcw, Shield } from "lucide-react";
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

const SettingsPage = () => {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-16 lg:pt-20">
      <div className="mx-auto max-w-lg px-8 pt-8 lg:max-w-2xl lg:px-12 lg:pt-12">
        <div className="flex items-center gap-4 mb-10 lg:mb-14">
          <button onClick={() => navigate(-1)} className="text-foreground/20 hover:text-foreground/40 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[9px] font-medium tracking-[0.25em] text-foreground/25 lg:text-[10px]">SETTINGS</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-12 lg:max-w-2xl lg:px-12 lg:space-y-16">
        {/* Language */}
        <div className="space-y-4 lg:space-y-5">
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20 lg:text-[10px]">{t("language").toUpperCase()}</p>
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex w-full items-center justify-between py-3.5 transition-colors lg:py-4 ${
                  lang === l.code ? "text-foreground/70" : "text-foreground/25 hover:text-foreground/40"
                }`}
              >
                <p className="text-[12px] lg:text-[13px]">{l.native}</p>
                {lang === l.code && <Check className="h-3.5 w-3.5 text-accent/60" />}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-accent/[0.06]" />

        {/* Theme */}
        <div className="space-y-4 lg:space-y-5">
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20 lg:text-[10px]">{t("appearance").toUpperCase()}</p>
          <div className="flex gap-8 lg:gap-10">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2.5 transition-colors ${
                  theme === opt.value ? "text-foreground/60" : "text-foreground/15 hover:text-foreground/30"
                }`}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-[9px] font-medium lg:text-[10px]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-accent/[0.06]" />

        {/* Actions */}
        <div className="space-y-1">
          <button className="flex w-full items-center gap-3 py-4 transition-colors text-foreground/25 hover:text-foreground/40 lg:py-5">
            <RotateCcw className="h-4 w-4" />
            <span className="text-[12px] lg:text-[13px]">{t("resetProfile")}</span>
          </button>
          <button className="flex w-full items-center gap-3 py-4 transition-colors text-foreground/25 hover:text-foreground/40 lg:py-5">
            <Shield className="h-4 w-4" />
            <span className="text-[12px] lg:text-[13px]">{t("privacy")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
