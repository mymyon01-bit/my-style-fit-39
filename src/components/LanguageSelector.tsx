import { useState, useRef, useEffect } from "react";
import { useI18n, type Language } from "@/lib/i18n";
import { Globe } from "lucide-react";

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "EN", native: "English" },
  { code: "ko", label: "KO", native: "한국어" },
  { code: "it", label: "IT", native: "Italiano" },
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
        className="hover-burgundy flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-foreground/75 transition-colors hover:text-foreground/75"
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={1.5} />
        {lang.toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[80px] overflow-hidden rounded-lg border border-border/30 bg-popover/95 backdrop-blur-xl shadow-lg">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`flex w-full items-center px-4 py-2.5 text-[10px] font-semibold tracking-[0.2em] transition-colors ${
                lang === l.code
                  ? "text-accent"
                  : "text-foreground/70 hover:bg-accent/[0.06] hover:text-foreground/70"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
