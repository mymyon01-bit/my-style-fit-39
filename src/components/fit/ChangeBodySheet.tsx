// ─── CHANGE BODY SHEET — V3.5 ─────────────────────────────────────────────
// Quick body switcher that lives inside FitResults. Lets users swap body,
// upload new photo, edit measurements, or apply a preset WITHOUT restarting
// the try-on flow. The garment + selected size are preserved.

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { X, User, Upload, Pencil, Sparkles } from "lucide-react";

export type ChangeBodyAction =
  | { type: "rescan" }
  | { type: "edit" }
  | { type: "preset"; preset: PresetKey };

export type PresetKey = "mine" | "slim" | "oversized" | "male" | "female";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAction: (a: ChangeBodyAction) => void;
}

const PRESETS: { key: PresetKey; label: string; description: string }[] = [
  { key: "mine",      label: "MY BODY",        description: "Use your saved profile" },
  { key: "slim",      label: "SLIM",           description: "Lean reference build" },
  { key: "oversized", label: "OVERSIZED",      description: "Heavier reference build" },
  { key: "male",      label: "MALE MANNEQUIN", description: "Neutral male reference" },
  { key: "female",    label: "FEMALE MANNEQUIN", description: "Neutral female reference" },
];

const TABS = [
  { key: "presets", label: "Presets",     icon: Sparkles },
  { key: "saved",   label: "Saved",       icon: User },
  { key: "upload",  label: "Upload New",  icon: Upload },
  { key: "edit",    label: "Manual Edit", icon: Pencil },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function ChangeBodySheet({ open, onOpenChange, onAction }: Props) {
  const [tab, setTab] = useState<TabKey>("presets");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-background border-l border-border/30 p-0"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-background/95 backdrop-blur-md px-6 py-4">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-bold tracking-[0.25em] text-foreground/85">CHANGE BODY</span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-foreground/45 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-border/20 grid grid-cols-4 gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[9px] font-bold tracking-[0.15em] transition-all ${
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground/55 hover:bg-foreground/5"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-6">
          {tab === "presets" && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55 mb-3">
                QUICK PRESETS
              </p>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    onAction({ type: "preset", preset: p.key });
                    onOpenChange(false);
                  }}
                  className="group w-full flex items-center justify-between rounded-xl border border-foreground/10 bg-card/40 px-4 py-3.5 text-left transition-all hover:border-accent/40 hover:bg-accent/5"
                >
                  <div>
                    <p className="text-[12px] font-bold tracking-[0.15em] text-foreground">
                      {p.label}
                    </p>
                    <p className="text-[11px] text-foreground/55 mt-0.5">{p.description}</p>
                  </div>
                  <span className="text-foreground/40 group-hover:text-accent transition-colors">→</span>
                </button>
              ))}
            </div>
          )}

          {tab === "saved" && (
            <SectionAction
              title="SAVED BODIES"
              body="Switch to a previously scanned body. Opens your saved scans in the body setup screen."
              cta="Open scan library"
              onClick={() => { onAction({ type: "rescan" }); onOpenChange(false); }}
            />
          )}

          {tab === "upload" && (
            <SectionAction
              title="UPLOAD NEW"
              body="Upload a fresh front + side body photo. Your garment + selected size will be preserved."
              cta="Upload body photos"
              onClick={() => { onAction({ type: "rescan" }); onOpenChange(false); }}
            />
          )}

          {tab === "edit" && (
            <SectionAction
              title="MANUAL EDIT"
              body="Adjust your measurements (height, weight, chest, waist, hip, inseam) directly."
              cta="Edit measurements"
              onClick={() => { onAction({ type: "edit" }); onOpenChange(false); }}
            />
          )}
        </div>

        <div className="px-6 pb-6 pt-2 border-t border-border/20">
          <p className="text-[10px] leading-relaxed text-foreground/50">
            The garment and selected size are preserved. Only the body composite
            is regenerated.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionAction({ title, body, cta, onClick }: {
  title: string; body: string; cta: string; onClick: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
        {title}
      </p>
      <p className="text-[12.5px] leading-relaxed text-foreground/75">{body}</p>
      <button
        onClick={onClick}
        className="w-full rounded-xl bg-foreground py-3.5 text-[11px] font-bold tracking-[0.22em] text-background transition-opacity hover:opacity-90"
      >
        {cta.toUpperCase()}
      </button>
    </div>
  );
}
