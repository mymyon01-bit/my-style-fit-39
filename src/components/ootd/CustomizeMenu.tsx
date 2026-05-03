import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Lock, Globe, Square, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import MyBackgroundPicker from "./MyBackgroundPicker";
import SongOfTheDayPicker, { type SongOfDay } from "./SongOfTheDayPicker";
import CardColorPicker, { type CardColor } from "./CardColorPicker";
import { saveCardShape, type CardShape } from "./cardShape";
import type { OOTDBgTheme } from "./OOTDBackground";

interface Props {
  bgTheme: OOTDBgTheme;
  onBgThemeChange: (t: OOTDBgTheme) => void;
  songOfDay: SongOfDay | null;
  onSongOfDayChange: (s: SongOfDay | null) => void;
  cardColor: CardColor;
  onCardColorChange: (c: CardColor) => void;
  cardShape: CardShape;
  onCardShapeChange: (s: CardShape) => void;
  /** Controlled visibility — parent owns open state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modern, minimal customize sheet for the OOTD My Page. Bundles every
 * personalization control (background, card color & shape, song of the day,
 * privacy) behind a single trigger so the page header stays clean.
 *
 * Trigger is owned by the parent (via `open` / `onOpenChange`).
 */
export default function CustomizeMenu({
  bgTheme,
  onBgThemeChange,
  songOfDay,
  onSongOfDayChange,
  cardColor,
  onCardColorChange,
  cardShape,
  onCardShapeChange,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open || !user || isPrivate !== null) return;
    supabase
      .from("profiles")
      .select("is_private")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsPrivate(!!data?.is_private));
  }, [open, user, isPrivate]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const togglePrivate = async () => {
    if (!user) return;
    const next = !isPrivate;
    setIsPrivate(next);
    await supabase.from("profiles").update({ is_private: next }).eq("user_id", user.id);
  };

  const setShape = (s: CardShape) => {
    onCardShapeChange(s);
    saveCardShape(s);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 backdrop-blur-md animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full sm:max-w-md mx-auto rounded-t-[28px] sm:rounded-2xl border border-border/40 bg-background p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — graffiti-tone "Customize" tag, mirroring the OOTD logo */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-4 w-4 shrink-0"
              strokeWidth={2}
              style={{ color: "hsl(330 95% 60%)" }}
            />
            <GraffitiCustomize />
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 text-foreground/50 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-2">
          <Row label="Background">
            <MyBackgroundPicker value={bgTheme} onChange={onBgThemeChange} />
          </Row>
          <Row label="Card color">
            <CardColorPicker value={cardColor} onChange={onCardColorChange} />
          </Row>

          {/* Card shape — round vs sharp */}
          <li className="flex items-center justify-between gap-3 px-1 py-2.5">
            <p className="text-[11px] text-foreground/85">Card shape</p>
            <div className="inline-flex items-center rounded-full border border-border/50 p-0.5">
              <ShapeButton
                active={cardShape === "round"}
                onClick={() => setShape("round")}
                label="Round"
              >
                <Circle className="h-3 w-3" strokeWidth={1.6} />
              </ShapeButton>
              <ShapeButton
                active={cardShape === "sharp"}
                onClick={() => setShape("sharp")}
                label="Sharp"
              >
                <Square className="h-3 w-3" strokeWidth={1.6} />
              </ShapeButton>
            </div>
          </li>

          <Row label="Song of the day">
            <SongOfTheDayPicker value={songOfDay} onChange={onSongOfDayChange} />
          </Row>

          {user && (
            <li className="flex items-center justify-between gap-3 px-1 py-2.5">
              <p className="text-[11px] text-foreground/85">Visibility</p>
              <button
                type="button"
                onClick={togglePrivate}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors shrink-0 ${
                  isPrivate
                    ? "border-foreground/60 bg-foreground/5 text-foreground/85"
                    : "border-border/50 text-foreground/55 hover:text-foreground/80"
                }`}
              >
                {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {isPrivate ? "Private" : "Public"}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <li className="flex items-center justify-between gap-3 px-1 py-2.5">
    <p className="text-[11px] text-foreground/85">{label}</p>
    <div className="shrink-0">{children}</div>
  </li>
);

const ShapeButton = ({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={`flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium transition-colors ${
      active
        ? "bg-foreground text-background"
        : "text-foreground/55 hover:text-foreground/85"
    }`}
  >
    {children}
    {label}
  </button>
);

/**
 * "Customize" tag — same logo style as the Mailbox header on the Messages
 * page (font-display, italic, semibold), with three pink paint drips
 * trickling from underneath letters in an infinite loop.
 */
export const GraffitiCustomize = () => (
  <span className="relative inline-flex items-center select-none pb-2">
    <style>{`
      @keyframes ootd-paint-drip {
        0%   { transform: scaleY(0.05); opacity: 0.95; }
        45%  { transform: scaleY(1);    opacity: 1; }
        80%  { transform: scaleY(1.05); opacity: 0.55; }
        100% { transform: scaleY(1.1);  opacity: 0; }
      }
      .ootd-drip {
        transform-origin: top center;
        animation: ootd-paint-drip 2.6s ease-in infinite;
        will-change: transform, opacity;
      }
    `}</style>

    <span
      className="font-display text-[15px] italic font-semibold tracking-tight leading-none"
      style={{ color: "hsl(330 95% 60%)" }}
    >
      Customize
    </span>

    {/* Paint drips — three streaks at varied positions / delays */}
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-full block h-2">
      <span
        className="ootd-drip absolute block w-[2px] rounded-b-full"
        style={{
          left: "18%",
          height: "7px",
          background: "linear-gradient(to bottom, hsl(330 95% 60%), hsl(330 95% 60% / 0))",
          animationDelay: "0s",
        }}
      />
      <span
        className="ootd-drip absolute block w-[2px] rounded-b-full"
        style={{
          left: "47%",
          height: "10px",
          background: "linear-gradient(to bottom, hsl(330 95% 60%), hsl(330 95% 60% / 0))",
          animationDelay: "0.7s",
        }}
      />
      <span
        className="ootd-drip absolute block w-[2px] rounded-b-full"
        style={{
          left: "78%",
          height: "6px",
          background: "linear-gradient(to bottom, hsl(330 95% 60%), hsl(330 95% 60% / 0))",
          animationDelay: "1.4s",
        }}
      />
    </span>
  </span>
);
