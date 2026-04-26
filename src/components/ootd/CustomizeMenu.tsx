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
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-md animate-fade-in"
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
 * Graffiti "Customize" tag that infinitely:
 *   1) writes the word with a spray-paint stroke (dash-offset draw)
 *   2) overlays a second "tag" pass on top
 *   3) wipes it away with an eraser sweep
 *   4) repeats forever
 */
const GraffitiCustomize = () => (
  <div className="relative h-[26px] w-[150px] overflow-visible select-none">
    <style>{`
      @keyframes ootd-graffiti-write {
        0%   { stroke-dashoffset: 600; opacity: 1; }
        25%  { stroke-dashoffset: 0;   opacity: 1; }
        55%  { stroke-dashoffset: 0;   opacity: 1; }
        70%  { stroke-dashoffset: 0;   opacity: 1; }
        100% { stroke-dashoffset: 0;   opacity: 0; }
      }
      @keyframes ootd-graffiti-fill {
        0%, 28%   { opacity: 0; }
        38%, 70%  { opacity: 1; }
        100%      { opacity: 0; }
      }
      @keyframes ootd-graffiti-erase {
        0%, 70%   { transform: translateX(-110%); }
        95%       { transform: translateX(110%); }
        100%      { transform: translateX(110%); }
      }
      @keyframes ootd-graffiti-eraser-icon {
        0%, 70%   { transform: translateX(-20px) rotate(-8deg); opacity: 0; }
        72%       { opacity: 1; }
        95%       { transform: translateX(140px) rotate(-8deg); opacity: 1; }
        100%      { opacity: 0; }
      }
      .ootd-gw-stroke {
        stroke-dasharray: 600;
        stroke-dashoffset: 600;
        animation: ootd-graffiti-write 4s ease-in-out infinite;
      }
      .ootd-gw-fill {
        opacity: 0;
        animation: ootd-graffiti-fill 4s ease-in-out infinite;
      }
      .ootd-gw-erase {
        animation: ootd-graffiti-erase 4s ease-in-out infinite;
      }
      .ootd-gw-eraser {
        animation: ootd-graffiti-eraser-icon 4s ease-in-out infinite;
      }
    `}</style>

    <svg
      viewBox="0 0 150 26"
      className="absolute inset-0 h-full w-full overflow-visible"
      style={{ transform: "rotate(-4deg)", transformOrigin: "left center" }}
    >
      {/* Pass 1: stroke that "writes" — same family as the #OOTD logo (font-display = Fraunces, italic black) */}
      <text
        x="0"
        y="20"
        className="ootd-gw-stroke"
        fontFamily="Fraunces, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize="19"
        fontWeight={900}
        letterSpacing="-0.5"
        fill="none"
        stroke="hsl(0 0% 8%)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        Customize
      </text>
      {/* Pass 2: pink fill "tag" overlay added on top of the outline */}
      <text
        x="0"
        y="20"
        className="ootd-gw-fill"
        fontFamily="Fraunces, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize="19"
        fontWeight={900}
        letterSpacing="-0.5"
        fill="hsl(330 95% 60%)"
        stroke="hsl(0 0% 8%)"
        strokeWidth="0.6"
        style={{
          filter:
            "drop-shadow(0 0 2px hsl(330 100% 70% / 0.55)) drop-shadow(0 1px 0 hsl(0 0% 0% / 0.35))",
        }}
      >
        Customize
      </text>

      {/* Eraser sweep — wipes the word away */}
      <g className="ootd-gw-erase" style={{ transformOrigin: "0 0" }}>
        <rect
          x="0"
          y="-2"
          width="40"
          height="30"
          fill="hsl(var(--background))"
        />
      </g>

      {/* Eraser icon following the sweep */}
      <g className="ootd-gw-eraser" style={{ transformOrigin: "0 0" }}>
        <rect
          x="-10"
          y="6"
          width="18"
          height="10"
          rx="2"
          fill="hsl(330 60% 88%)"
          stroke="hsl(0 0% 8%)"
          strokeWidth="1"
        />
        <rect
          x="-10"
          y="6"
          width="18"
          height="4"
          rx="2"
          fill="hsl(220 70% 60%)"
          stroke="hsl(0 0% 8%)"
          strokeWidth="1"
        />
      </g>
    </svg>
  </div>
);
