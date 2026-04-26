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
  <div className="relative h-[22px] w-[140px] overflow-visible select-none">
    <style>{`
      @keyframes ootd-gw-write {
        0%   { stroke-dashoffset: 600; }
        25%  { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: 0; }
      }
      @keyframes ootd-gw-fill-in {
        0%, 28%  { opacity: 0; }
        38%      { opacity: 1; }
        65%      { opacity: 1; }
        100%     { opacity: 1; }
      }
      /* Mask reveal: starts fully white (text visible), then a black wipe
         moves left→right turning the mask black (text vanishes → bg shows
         through). Resets to white for the next write pass. */
      @keyframes ootd-gw-mask-wipe {
        0%, 65%   { transform: translateX(-110%); }
        90%       { transform: translateX(110%); }
        90.01%    { transform: translateX(110%); }
        100%      { transform: translateX(-110%); }
      }
      @keyframes ootd-gw-eraser {
        0%, 65%  { transform: translateX(-22px); opacity: 0; }
        67%      { opacity: 1; }
        90%      { transform: translateX(132px); opacity: 1; }
        91%, 100%{ opacity: 0; }
      }
      .ootd-gw-stroke {
        stroke-dasharray: 600;
        stroke-dashoffset: 600;
        animation: ootd-gw-write 4s ease-in-out infinite;
      }
      .ootd-gw-fill {
        opacity: 0;
        animation: ootd-gw-fill-in 4s ease-in-out infinite;
      }
      .ootd-gw-mask-wipe {
        animation: ootd-gw-mask-wipe 4s ease-in-out infinite;
      }
      .ootd-gw-eraser {
        animation: ootd-gw-eraser 4s ease-in-out infinite;
      }
    `}</style>

    <svg
      viewBox="0 0 140 22"
      className="absolute inset-0 h-full w-full overflow-visible"
      style={{ transform: "rotate(-3deg)", transformOrigin: "left center" }}
    >
      <defs>
        {/* Mask: white = visible, black = erased (shows underlying bg). */}
        <mask id="ootd-customize-mask" maskUnits="userSpaceOnUse" x="-10" y="-4" width="160" height="30">
          <rect x="-10" y="-4" width="160" height="30" fill="white" />
          <rect
            className="ootd-gw-mask-wipe"
            x="-10"
            y="-4"
            width="60"
            height="30"
            fill="black"
          />
        </mask>
      </defs>

      <g mask="url(#ootd-customize-mask)">
        {/* Pass 1: thin outline that "writes" */}
        <text
          x="0"
          y="16"
          className="ootd-gw-stroke"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontSize="14"
          fontWeight={500}
          letterSpacing="0.2"
          fill="none"
          stroke="hsl(0 0% 8%)"
          strokeWidth="0.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          Customize
        </text>
        {/* Pass 2: pink fill */}
        <text
          x="0"
          y="16"
          className="ootd-gw-fill"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontSize="14"
          fontWeight={500}
          letterSpacing="0.2"
          fill="hsl(330 95% 60%)"
        >
          Customize
        </text>
      </g>

      {/* Eraser icon following the wipe (outside the mask so it's always visible) */}
      <g className="ootd-gw-eraser">
        <rect x="-10" y="4" width="16" height="9" rx="2" fill="hsl(330 60% 90%)" stroke="hsl(0 0% 8%)" strokeWidth="0.8" />
        <rect x="-10" y="4" width="16" height="3.5" rx="2" fill="hsl(220 70% 60%)" stroke="hsl(0 0% 8%)" strokeWidth="0.8" />
      </g>
    </svg>
  </div>
);
