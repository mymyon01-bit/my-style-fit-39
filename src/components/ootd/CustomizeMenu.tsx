import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Lock, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import MyBackgroundPicker from "./MyBackgroundPicker";
import SongOfTheDayPicker, { type SongOfDay } from "./SongOfTheDayPicker";
import CardColorPicker, { type CardColor } from "./CardColorPicker";
import type { OOTDBgTheme } from "./OOTDBackground";

interface Props {
  bgTheme: OOTDBgTheme;
  onBgThemeChange: (t: OOTDBgTheme) => void;
  songOfDay: SongOfDay | null;
  onSongOfDayChange: (s: SongOfDay | null) => void;
  cardColor: CardColor;
  onCardColorChange: (c: CardColor) => void;
  /** Hide the trigger button — useful when an external control opens this menu */
  hideTrigger?: boolean;
  /** Controlled open state (optional). When provided, parent owns visibility. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Single "Customize" button that opens a compact sheet bundling all of the
 * personalization controls (background, card color, song of the day, public
 * vs private). Replaces the row of mini chips that were getting clipped on
 * narrow screens.
 */
export default function CustomizeMenu({
  bgTheme,
  onBgThemeChange,
  songOfDay,
  onSongOfDayChange,
  cardColor,
  onCardColorChange,
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenInternal(next);
    onOpenChange?.(next);
  };
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null);


  // Lazy-load privacy flag the first time the sheet opens
  useEffect(() => {
    if (!open || !user || isPrivate !== null) return;
    supabase
      .from("profiles")
      .select("is_private")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsPrivate(!!data?.is_private));
  }, [open, user, isPrivate]);

  // Lock body scroll while the sheet is open
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

  const sheet = open ? (
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
              CUSTOMIZE
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
        <p className="text-[11px] text-foreground/55 leading-relaxed mb-4">
          Make your page yours — background, card tint, song, and who can see it.
        </p>

        <ul className="space-y-2.5">
          <Row label="Background" hint="Scene that plays behind your tab">
            <MyBackgroundPicker value={bgTheme} onChange={onBgThemeChange} />
          </Row>
          <Row label="Card color" hint="Tint behind your text">
            <CardColorPicker value={cardColor} onChange={onCardColorChange} />
          </Row>
          <Row label="Song of the day" hint="Plays in your mini player">
            <SongOfTheDayPicker value={songOfDay} onChange={onSongOfDayChange} />
          </Row>
          {user && (
            <li className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-foreground/85">
                  Visibility
                </p>
                <p className="text-[10px] text-foreground/50">
                  {isPrivate ? "Only your circle can see" : "Anyone can see your page"}
                </p>
              </div>
              <button
                type="button"
                onClick={togglePrivate}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors shrink-0 ${
                  isPrivate
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border/40 text-foreground/55 hover:text-foreground/80"
                }`}
              >
                {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {isPrivate ? "Private" : "Public"}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-6 items-center gap-1 rounded-full border border-border/40 bg-background/60 backdrop-blur px-2.5 text-[9px] font-medium tracking-[0.16em] text-foreground/75 hover:border-accent/60 hover:text-accent transition-colors shrink-0"
          aria-label="Customize my page"
        >
          <Sparkles className="h-2.5 w-2.5" />
          CUSTOMIZE
        </button>
      )}

      {sheet && typeof document !== "undefined" && createPortal(sheet, document.body)}
    </>
  );
}

const Row = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <li className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/40 px-3 py-2.5">
    <div className="min-w-0">
      <p className="text-[11.5px] font-medium text-foreground/85">{label}</p>
      <p className="text-[10px] text-foreground/50">{hint}</p>
    </div>
    <div className="shrink-0">{children}</div>
  </li>
);
