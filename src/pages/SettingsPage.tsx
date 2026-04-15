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
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      <div className="mx-auto max-w-lg px-8 pt-10 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-center gap-4 mb-12 md:mb-14 lg:mb-16">
          <button onClick={() => navigate(-1)} className="text-foreground/22 hover:text-foreground/45 transition-colors">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/28 md:text-[11px]">SETTINGS</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-14 md:max-w-2xl md:px-10 md:space-y-16 lg:max-w-3xl lg:px-12">
        {/* Language */}
        <div className="space-y-5">
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/25 md:text-[11px]">{t("language").toUpperCase()}</p>
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex w-full items-center justify-between py-4 transition-colors md:py-5 ${
                  lang === l.code ? "text-foreground/70" : "text-foreground/30 hover:text-foreground/45"
                }`}
              >
                <p className="text-[13px] md:text-[14px]">{l.native}</p>
                {lang === l.code && <Check className="h-4 w-4 text-accent/60" />}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-accent/[0.08]" />

        {/* Theme */}
        <div className="space-y-5">
          <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/25 md:text-[11px]">{t("appearance").toUpperCase()}</p>
          <div className="flex gap-10 md:gap-12">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-3 transition-colors ${
                  theme === opt.value ? "text-foreground/65" : "text-foreground/18 hover:text-foreground/35"
                }`}
              >
                <opt.icon className="h-5 w-5 md:h-6 md:w-6" />
                <span className="text-[10px] font-medium md:text-[11px]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-accent/[0.08]" />

        {/* Actions */}
        <div className="space-y-1">
          <button className="flex w-full items-center gap-4 py-4.5 transition-colors text-foreground/28 hover:text-foreground/45 md:py-5">
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.5} />
            <span className="text-[13px] md:text-[14px]">{t("resetProfile")}</span>
          </button>
          <button className="flex w-full items-center gap-4 py-4.5 transition-colors text-foreground/28 hover:text-foreground/45 md:py-5">
            <Shield className="h-[18px] w-[18px]" strokeWidth={1.5} />
            <span className="text-[13px] md:text-[14px]">{t("privacy")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
