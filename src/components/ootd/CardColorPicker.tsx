import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Palette, X, Check, Pipette } from "lucide-react";

/**
 * "Card color" picker — controls the tint of the translucent panels
 * (profile header, stories row, feed grid…) that sit on top of the
 * animated OOTD background. Defaults to the original card surface but
 * can be swapped for any pastel preset or a fully custom HEX color.
 *
 * Mechanics:
 *   - Persists the chosen HEX to localStorage.
 *   - Sets --ootd-card-bg and --ootd-card-fg CSS variables on
 *     <html>. The OOTDPage cards consume these via inline style fallbacks
 *     so the original bg-background/80 only applies when no override
 *     is set.
 *   - Emits ootd-card-color-change so other components can react.
 */
export interface CardColor {
  /** Hex color, e.g. "#FFE5EC". null = use default theme card surface. */
  hex: string | null;
  /** Optional human label (preset name or "Custom"). */
  label?: string;
}

const STORAGE_KEY = "ootd-card-color";
const ROOT_BG_VAR = "--ootd-card-bg";
const ROOT_FG_VAR = "--ootd-card-fg";

export const PASTEL_PRESETS: { hex: string; label: string }[] = [
  { hex: "#FFE5EC", label: "Cherry milk" },
  { hex: "#FFD6A5", label: "Peach" },
  { hex: "#FFF4B8", label: "Butter" },
  { hex: "#D4F1C5", label: "Matcha" },
  { hex: "#C8E7FF", label: "Sky" },
  { hex: "#D9D2FF", label: "Lilac" },
  { hex: "#FFCFE7", label: "Bubblegum" },
  { hex: "#E9DCC9", label: "Latte" },
  { hex: "#C7F0DB", label: "Mint" },
  { hex: "#FFE0B5", label: "Apricot" },
  { hex: "#E2C2FF", label: "Grape" },
  { hex: "#B5EAEA", label: "Aqua" },
];

// ----- persistence -----
export function loadCardColor(): CardColor {
  if (typeof window === "undefined") return { hex: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hex: null };
    return JSON.parse(raw) as CardColor;
  } catch {
    return { hex: null };
  }
}

export function saveCardColor(color: CardColor) {
  try {
    if (color.hex) localStorage.setItem(STORAGE_KEY, JSON.stringify(color));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
  applyCardColorToRoot(color);
  try {
    window.dispatchEvent(new CustomEvent("ootd-card-color-change", { detail: color }));
  } catch {}
}

// ----- helpers -----
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readableTextFor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  // Perceived luminance — pick dark text on light pastels, white on dark.
  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1a1a1a" : "#ffffff";
}

export function applyCardColorToRoot(color: CardColor) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!color.hex) {
    root.style.removeProperty(ROOT_BG_VAR);
    root.style.removeProperty(ROOT_FG_VAR);
    return;
  }
  const rgb = hexToRgb(color.hex);
  if (!rgb) return;
  // 80% opacity to keep the background scene faintly visible behind the card.
  root.style.setProperty(
    ROOT_BG_VAR,
    `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.82)`,
  );
  root.style.setProperty(ROOT_FG_VAR, readableTextFor(color.hex));
}

interface Props {
  value: CardColor;
  onChange: (color: CardColor) => void;
}

export default function CardColorPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState(value.hex ?? "#FFE5EC");
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  // Apply on mount in case parent only loaded from storage.
  useEffect(() => {
    applyCardColorToRoot(value);
  }, [value]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleSelect = (color: CardColor) => {
    saveCardColor(color);
    onChange(color);
  };

  const currentLabel =
    value.label ??
    PASTEL_PRESETS.find((p) => p.hex.toLowerCase() === value.hex?.toLowerCase())?.label ??
    (value.hex ? "Custom" : "Default");

  const modal = open ? (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full sm:max-w-md mx-auto rounded-t-3xl sm:rounded-3xl border border-border/40 bg-card p-5 shadow-2xl animate-scale-in max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1 shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[12px] font-medium tracking-[0.2em] text-foreground/85">
              CARD COLOR
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
        <p className="text-[11px] text-foreground/55 leading-relaxed mb-4 shrink-0">
          Pick a tint for the panels behind your text. Pastel presets or any HEX.
        </p>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {/* Default / clear */}
          <button
            type="button"
            onClick={() => handleSelect({ hex: null, label: "Default" })}
            className={`w-full mb-3 flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
              !value.hex
                ? "border-accent/70 bg-accent/10 ring-1 ring-accent/30"
                : "border-border/30 hover:border-border/60"
            }`}
          >
            <span
              className="h-9 w-9 rounded-lg border border-border/50 bg-gradient-to-br from-background to-muted/40 shrink-0"
              aria-hidden
            />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[12px] font-medium text-foreground/90">Default</p>
              <p className="text-[10px] text-foreground/50">Original frosted card surface</p>
            </div>
            {!value.hex && <Check className="h-4 w-4 text-accent" />}
          </button>

          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground/55 font-semibold">
            Pastel palette
          </p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PASTEL_PRESETS.map((p) => {
              const active = value.hex?.toLowerCase() === p.hex.toLowerCase();
              const txt = readableTextFor(p.hex);
              return (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => handleSelect({ hex: p.hex, label: p.label })}
                  className={`relative aspect-square rounded-xl border-2 transition-all overflow-hidden flex flex-col items-center justify-center gap-1 p-1 ${
                    active
                      ? "border-foreground/70 ring-2 ring-accent/40 scale-[1.03]"
                      : "border-border/40 hover:border-foreground/40"
                  }`}
                  style={{ background: p.hex, color: txt }}
                  aria-label={p.label}
                  title={p.label}
                >
                  <span
                    className="text-[15px] font-bold leading-none"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    Aa
                  </span>
                  <span className="text-[8.5px] font-medium tracking-tight leading-none truncate max-w-full px-0.5">
                    {p.label}
                  </span>
                  {active && (
                    <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground/90">
                      <Check className="h-2 w-2 text-background" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom HEX */}
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-foreground/55 font-semibold">
            Custom color
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/40 p-2.5 mb-2">
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="relative h-12 w-12 shrink-0 rounded-lg border-2 border-border/50 overflow-hidden"
              style={{ background: customHex }}
              aria-label="Open color wheel"
            >
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                <Pipette className="h-4 w-4 text-white" />
              </span>
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              className="sr-only"
            />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={customHex}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) {
                    setCustomHex(v.startsWith("#") ? v : `#${v}`);
                  }
                }}
                className="w-full rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-[12px] font-mono uppercase outline-none focus:border-accent/60"
                placeholder="#FFE5EC"
                maxLength={7}
              />
              <p className="mt-1 text-[9.5px] text-foreground/50">
                Tap the swatch to open the color wheel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (/^#[0-9a-fA-F]{6}$/.test(customHex)) {
                  handleSelect({ hex: customHex, label: "Custom" });
                }
              }}
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-background hover:opacity-90"
            >
              Apply
            </button>
          </div>

          {/* Live preview */}
          <div className="mt-3 rounded-xl border border-border/40 p-3 text-center"
               style={{
                 background: value.hex
                   ? `${value.hex}D6` // ~84% alpha
                   : undefined,
                 color: value.hex ? readableTextFor(value.hex) : undefined,
               }}
          >
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase">
              Sample card
            </p>
            <p className="mt-1 text-[10px] opacity-80">
              Your text will sit on this color.
            </p>
          </div>
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
        aria-label="Pick card color"
      >
        <Palette className="h-3 w-3" />
        CARD
        <span
          className="inline-block h-3 w-3 rounded-full border border-border/60 shrink-0"
          style={{ background: value.hex ?? "transparent" }}
        />
        <span className="text-foreground/40 normal-case tracking-normal text-[10px] truncate max-w-[80px]">
          · {currentLabel}
        </span>
      </button>

      {modal && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
