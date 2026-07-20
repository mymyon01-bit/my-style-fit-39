import { useState, useRef, useEffect } from "react";
import { useI18n, type Language } from "@/lib/i18n";
import { Globe } from "lucide-react";

const languages: { code: Language; label: string; native: string; flag: string }[] = [
  { code: "ko", label: "KO", native: "한국어",   flag: "🇰🇷" },
  { code: "en", label: "EN", native: "English",  flag: "🇬🇧" },
  { code: "it", label: "IT", native: "Italiano", flag: "🇮🇹" },
  { code: "zh", label: "ZH", native: "中文",     flag: "🇨🇳" },
  { code: "fr", label: "FR", native: "Français", flag: "🇫🇷" },
  { code: "ja", label: "JA", native: "日本語",   flag: "🇯🇵" },
];

const LanguageSelector = () => {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="hover-burgundy flex items-center gap-1 font-sans text-[10px] font-medium tracking-[0.05em] text-foreground/60 transition-colors hover:text-foreground"
      >
        <Globe className="h-3 w-3" strokeWidth={1.5} />
        {lang.toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 min-w-[160px] overflow-hidden rounded-lg border border-border/30 bg-popover/95 backdrop-blur-xl shadow-lg">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                lang === l.code
                  ? "bg-accent/[0.08] text-accent"
                  : "text-foreground/70 hover:bg-accent/[0.06] hover:text-foreground"
              }`}
            >
              <span className="text-[14px] leading-none">{l.flag}</span>
              <span className="flex-1 text-left">{l.native}</span>
              <span className="text-[9px] tracking-[0.15em] text-foreground/40">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
