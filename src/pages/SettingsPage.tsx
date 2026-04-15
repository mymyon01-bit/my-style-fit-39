import { useI18n, type Language } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { ArrowLeft, Globe, Check, Moon, Sun, Monitor, RotateCcw, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "it", label: "Italian", native: "Italiano" },
];

const themeOptions = [
  { value: "light" as const, icon: Sun },
  { value: "dark" as const, icon: Moon },
  { value: "system" as const, icon: Monitor },
];

const SettingsPage = () => {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold text-foreground">{t("settings")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-5 space-y-6">
        {/* Language */}
        <div>
          <div className="flex items-center gap-2 pb-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("language")}</span>
          </div>
          <div className="space-y-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3.5 transition-colors ${
                  lang === l.code ? "bg-accent/10 border border-accent" : "hover:bg-secondary"
                }`}
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">{l.native}</p>
                  <p className="text-xs text-muted-foreground">{l.label}</p>
                </div>
                {lang === l.code && <Check className="h-4 w-4 text-accent" />}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <div className="flex items-center gap-2 pb-3">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("appearance")}</span>
          </div>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3.5 transition-colors ${
                  theme === opt.value
                    ? "bg-accent/10 border border-accent"
                    : "bg-secondary hover:bg-muted"
                }`}
              >
                <opt.icon className={`h-5 w-5 ${theme === opt.value ? "text-accent" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium ${theme === opt.value ? "text-accent" : "text-muted-foreground"}`}>
                  {t(opt.value)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Other settings */}
        <div className="space-y-1 pt-2">
          <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-secondary">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t("resetProfile")}</span>
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-secondary">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t("privacy")}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
