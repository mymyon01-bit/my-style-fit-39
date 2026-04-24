import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { OOTD_BG_THEMES, type OOTDBgTheme, saveOOTDBgTheme } from "./OOTDBackground";

interface Props {
  value: OOTDBgTheme;
  onChange: (theme: OOTDBgTheme) => void;
}

/**
 * Picker shown inside the My Page tab so each user can choose the animated
 * background that plays behind the OOTD experience. Selection is persisted
 * to localStorage via `saveOOTDBgTheme`.
 */
export default function MyBackgroundPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(true);

  const handleSelect = (theme: OOTDBgTheme) => {
    saveOOTDBgTheme(theme);
    onChange(theme);
  };

  return (
    <section className="rounded-2xl border border-border/30 bg-card/40 p-4 mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent/80" />
          <span className="text-[11px] font-medium tracking-[0.2em] text-foreground/80">
            MY BACKGROUND
          </span>
        </div>
        <span className="text-[10px] text-foreground/45">
          {OOTD_BG_THEMES.find((t) => t.id === value)?.label ?? "None"}
        </span>
      </button>

      {open && (
        <>
          <p className="mt-2 text-[10.5px] text-foreground/50 leading-relaxed">
            Choose an effect that plays behind the OOTD tab — only you see this.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OOTD_BG_THEMES.map((t) => {
              const active = t.id === value;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t.id)}
                  className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-accent/60 bg-accent/10"
                      : "border-border/30 bg-background/40 hover:border-border/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-base leading-none">{t.emoji}</span>
                    {active && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-background">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] font-medium ${active ? "text-accent" : "text-foreground/80"}`}>
                    {t.label}
                  </p>
                  <p className="text-[9.5px] text-foreground/45 leading-snug line-clamp-2">
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
