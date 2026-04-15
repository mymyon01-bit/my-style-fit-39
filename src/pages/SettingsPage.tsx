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
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto max-w-lg px-8 pt-8">
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => navigate(-1)} className="text-foreground/20 hover:text-foreground/40 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[9px] font-medium tracking-[0.25em] text-foreground/25">SETTINGS</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 space-y-12">
        {/* Language */}
        <div className="space-y-4">
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20">{t("language").toUpperCase()}</p>
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex w-full items-center justify-between py-3 transition-colors ${
                  lang === l.code ? "text-foreground/70" : "text-foreground/25 hover:text-foreground/40"
                }`}
              >
                <div>
                  <p className="text-[12px]">{l.native}</p>
                </div>
                {lang === l.code && <Check className="h-3.5 w-3.5 text-accent/60" />}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-foreground/[0.04]" />

        {/* Theme */}
        <div className="space-y-4">
          <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20">{t("appearance").toUpperCase()}</p>
          <div className="flex gap-6">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-col items-center gap-2 transition-colors ${
                  theme === opt.value ? "text-foreground/60" : "text-foreground/15 hover:text-foreground/30"
                }`}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-[9px] font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-foreground/[0.04]" />

        {/* Actions */}
        <div className="space-y-1">
          <button className="flex w-full items-center gap-3 py-3.5 transition-colors text-foreground/25 hover:text-foreground/40">
            <RotateCcw className="h-4 w-4" />
            <span className="text-[12px]">{t("resetProfile")}</span>
          </button>
          <button className="flex w-full items-center gap-3 py-3.5 transition-colors text-foreground/25 hover:text-foreground/40">
            <Shield className="h-4 w-4" />
            <span className="text-[12px]">{t("privacy")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
