import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Sparkles, X, Film } from "lucide-react";
import {
  OOTD_BG_THEMES,
  type OOTDBgTheme,
  saveOOTDBgTheme,
  loadOOTDBgRealistic,
  saveOOTDBgRealistic,
} from "./OOTDBackground";

interface Props {
  value: OOTDBgTheme;
  onChange: (theme: OOTDBgTheme) => void;
}

/**
 * Compact button that opens a modal sheet for picking the OOTD background
 * theme. Selection is persisted to localStorage via `saveOOTDBgTheme`.
 *
 * The modal is rendered into a portal on `document.body` so it escapes any
 * ancestor that creates a containing block for fixed children (e.g. the
 * `backdrop-blur-xl` wrapper around the My Page header). Without the portal
 * the sheet would be clipped or hidden behind the blurred panel.
 */
export default function MyBackgroundPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [realistic, setRealistic] = useState<boolean>(() => loadOOTDBgRealistic());

  // Lock body scroll while the picker modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const current = OOTD_BG_THEMES.find((t) => t.id === value) ?? OOTD_BG_THEMES[0];

  const handleSelect = (theme: OOTDBgTheme) => {
    saveOOTDBgTheme(theme);
    onChange(theme);
  };

  const toggleRealistic = () => {
    const next = !realistic;
    setRealistic(next);
    saveOOTDBgRealistic(next);
  };

  const modal = open ? (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl border border-border/40 bg-card p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[12px] font-medium tracking-[0.2em] text-foreground/85">
              MY BACKGROUND
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-foreground/55 leading-relaxed">
          Pick a scene that plays behind the OOTD tab — only you see this.
        </p>

        {/* Realistic mode toggle — switches between AI cinematic video and SVG art */}
        <button
          type="button"
          onClick={toggleRealistic}
          className={`mt-3 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-all ${
            realistic
              ? "border-accent/60 bg-accent/10"
              : "border-border/40 bg-background/40 hover:border-border/70"
          }`}
        >
          <div className="flex items-center gap-2">
            <Film className={`h-3.5 w-3.5 ${realistic ? "text-accent" : "text-foreground/60"}`} />
            <div className="text-left">
              <p className={`text-[11.5px] font-medium ${realistic ? "text-accent" : "text-foreground/85"}`}>
                Cinematic real footage
              </p>
              <p className="text-[10px] text-foreground/45 leading-snug">
                AI-generated video loops · feels like real life
              </p>
            </div>
          </div>
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
              realistic ? "bg-accent" : "bg-foreground/20"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${
                realistic ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto">
          {OOTD_BG_THEMES.map((t) => {
            const active = t.id === value;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t.id)}
                className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? "border-accent/70 bg-accent/10 ring-1 ring-accent/30"
                    : "border-border/30 bg-background/50 hover:border-border/60"
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
                <p className={`text-[11.5px] font-medium ${active ? "text-accent" : "text-foreground/85"}`}>
                  {t.label}
                </p>
                <p className="text-[10px] text-foreground/45 leading-snug line-clamp-2">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 items-center gap-1.5 rounded-full border border-border/40 bg-background/60 backdrop-blur px-2.5 text-[10px] font-medium tracking-[0.18em] text-foreground/75 hover:border-accent/60 hover:text-accent transition-colors shrink-0"
        aria-label="Customize OOTD background"
      >
        <Sparkles className="h-3 w-3" />
        BG
        <span className="text-foreground/40 normal-case tracking-normal text-[10px]">
          · {current.label}
        </span>
      </button>

      {modal && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
