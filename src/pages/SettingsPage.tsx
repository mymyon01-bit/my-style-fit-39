import { useI18n, type Language } from "@/lib/i18n";
import { ArrowLeft, Globe, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "it", label: "Italian", native: "Italiano" },
];

const SettingsPage = () => {
  const { t, lang, setLang } = useI18n();
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

      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="flex items-center gap-2 pb-3">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{t("language")}</span>
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
    </div>
  );
};

export default SettingsPage;
