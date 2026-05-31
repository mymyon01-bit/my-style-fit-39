import { Sparkles, Scan, Layers, History, ArrowRight, ShieldCheck, Ruler, Tag, Gauge, GitCompare } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface FitLabDashboardProps {
  scanQuality: number;            // 0..100 (defensive against 0..1)
  hasBodyProfile: boolean;
  recentTryOnCount: number;
  onNewScan: () => void;
  onTryOn: () => void;
  onAnalyze: () => void;
  onHistory: () => void;
}

const FitLabDashboard = ({
  scanQuality,
  hasBodyProfile,
  recentTryOnCount,
  onNewScan,
  onTryOn,
  onAnalyze,
  onHistory,
}: FitLabDashboardProps) => {
  const { t } = useI18n();
  const raw = scanQuality || 0;
  const normalized = raw <= 1 ? raw * 100 : raw;
  // Cap at 98% — never claim absolute precision.
  const accuracyPct = Math.min(98, Math.max(0, Math.round(normalized)));
  const ready = hasBodyProfile && accuracyPct >= 60;

  return (
    <div className="space-y-7 md:space-y-8">
      {/* ── Body DNA status — image-first hero ─────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        {/* Decorative gradient field */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative grid grid-cols-[1fr_auto] gap-5 p-6 md:p-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.22em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} />
              {t("fitLabBodyDna")}
            </div>
            <h2 className="font-display text-[28px] md:text-[40px] leading-[1.05] mt-3 tracking-tight">
              {ready ? t("fitLabReady") : t("fitLabNotReady")}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-2.5 max-w-md leading-snug">
              {ready ? t("fitLabReadyDesc") : t("fitLabNotReadyDesc")}
            </p>

            <button
              onClick={onNewScan}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-medium text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Scan className="h-4 w-4" strokeWidth={2} />
              {ready ? t("fitLabUpdate") : t("fitLabStart")}
              <ArrowRight className="h-3.5 w-3.5 ml-0.5 opacity-80" />
            </button>
          </div>

          <AccuracyRing pct={accuracyPct} label={t("fitLabAccuracy")} />
        </div>
      </section>

      {/* ── Quick actions — large iconic tiles ───────────── */}
      <section>
        <h3 className="font-body text-[10px] font-medium tracking-[0.22em] text-muted-foreground mb-3 px-1">
          {t("fitLabQuickActions")}
        </h3>
        <div className="grid grid-cols-3 gap-2.5 md:gap-3">
          <ActionTile icon={Sparkles} label={t("fitLabTryOn")}  desc={t("fitLabTryOnDesc")}  onClick={onTryOn} />
          <ActionTile icon={Layers}   label={t("fitLabAnalyze")} desc={t("fitLabAnalyzeDesc")} onClick={onAnalyze} />
          <ActionTile icon={History}  label={t("fitLabHistory")} desc={t("fitLabHistoryDesc").replace("{n}", String(recentTryOnCount))} onClick={onHistory} />
        </div>
      </section>

      {/* ── Capability grid — icon-led, no essay text ────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        <CapTile icon={Ruler}      title={t("fitLabFitMap")}     desc={t("fitLabFitMapDesc")} />
        <CapTile icon={Tag}        title={t("fitLabSizeRec")}    desc={t("fitLabSizeRecDesc")} />
        <CapTile icon={Gauge}      title={t("fitLabConfidence")} desc={t("fitLabConfidenceDesc")} />
        <CapTile icon={GitCompare} title={t("fitLabCompare")}    desc={t("fitLabCompareDesc")} />
      </section>
    </div>
  );
};

/* ── Subcomponents ─────────────────────────────────────── */

const AccuracyRing = ({ pct, label }: { pct: number; label: string }) => {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <div className="relative h-24 w-24 md:h-28 md:w-28">
        <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-display text-[22px] md:text-[26px] tracking-tight">{pct}</span>
          <span className="text-[9px] tracking-[0.18em] text-muted-foreground mt-0.5">%</span>
        </div>
      </div>
      <span className="mt-2 text-[9.5px] tracking-[0.22em] text-muted-foreground">{label}</span>
    </div>
  );
};

const ActionTile = ({
  icon: Icon, label, desc, onClick,
}: { icon: typeof Sparkles; label: string; desc: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3.5 md:p-4 text-left transition-all hover:border-accent/40 hover:shadow-soft active:scale-[0.98]"
  >
    <span className="h-9 w-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center ring-1 ring-accent/15">
      <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} />
    </span>
    <span className="block text-[12.5px] font-semibold leading-tight text-foreground">{label}</span>
    <span className="block text-[10.5px] text-muted-foreground leading-tight">{desc}</span>
  </button>
);

const CapTile = ({
  icon: Icon, title, desc,
}: { icon: typeof Sparkles; title: string; desc: string }) => (
  <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-card/60 p-3.5">
    <span className="h-7 w-7 rounded-lg bg-foreground/[0.04] text-foreground/70 flex items-center justify-center shrink-0">
      <Icon className="h-[14px] w-[14px]" strokeWidth={1.8} />
    </span>
    <div className="min-w-0">
      <p className="text-[12px] font-semibold leading-tight text-foreground truncate">{title}</p>
      <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{desc}</p>
    </div>
  </div>
);

export default FitLabDashboard;
