import { Sparkles, Scan, Layers, History, ArrowRight, ShieldCheck } from "lucide-react";

interface FitLabDashboardProps {
  scanQuality: number;            // already 0..100
  hasBodyProfile: boolean;
  recentTryOnCount: number;
  onNewScan: () => void;
  onTryOn: () => void;
  onAnalyze: () => void;
  onHistory: () => void;
}

/**
 * FIT LAB landing dashboard.
 * Replaces the wizard-first feel with a premium "body status + quick actions"
 * surface. The legacy SCAN/BODY/CHECK/RESULTS tabs are still reachable from
 * here — this is just the entry surface.
 */
const FitLabDashboard = ({
  scanQuality,
  hasBodyProfile,
  recentTryOnCount,
  onNewScan,
  onTryOn,
  onAnalyze,
  onHistory,
}: FitLabDashboardProps) => {
  // scanQuality arrives in 0..100. Normalize defensively in case a 0..1 value
  // sneaks in, and cap realistic accuracy at 98% — we never claim "100%".
  const raw = scanQuality || 0;
  const normalized = raw <= 1 ? raw * 100 : raw;
  const accuracyPct = Math.min(98, Math.max(0, Math.round(normalized)));
  const ready = hasBodyProfile && accuracyPct >= 60;

  return (
    <div className="space-y-8 md:space-y-10">
      {/* ── Body DNA status card ─────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-8 shadow-soft">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10.5px] font-medium tracking-[0.22em] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} />
              BODY DNA
            </div>
            <h2 className="font-display text-[34px] md:text-[44px] leading-[1.02] mt-3 tracking-tight">
              {ready ? "Your Body DNA is ready." : "Let's build your Body DNA."}
            </h2>
            <p className="text-[13.5px] text-muted-foreground mt-3 max-w-md leading-relaxed">
              {ready
                ? `Accuracy ${accuracyPct}%. Use it to check product fit, try on items, and get smarter size recommendations.`
                : "A 60-second scan lets MYMYON model how clothes will actually fit your body."}
            </p>
          </div>

          {/* Accuracy ring */}
          <div className="hidden md:flex flex-col items-center shrink-0">
            <AccuracyRing pct={accuracyPct} />
            <span className="mt-2 text-[10px] tracking-[0.2em] text-muted-foreground">ACCURACY</span>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={onNewScan}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[13px] font-medium text-primary-foreground shadow-soft transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Scan className="h-4 w-4" strokeWidth={2} />
            {ready ? "Update Body DNA" : "Start Scan"}
            <ArrowRight className="h-3.5 w-3.5 ml-0.5 opacity-80" />
          </button>
          {ready && (
            <span className="text-[11px] tracking-[0.14em] text-muted-foreground">
              · Accuracy {accuracyPct}%
            </span>
          )}
        </div>
      </section>

      {/* ── Quick actions ────────────────────────────────── */}
      <section>
        <h3 className="font-body text-[10.5px] font-medium tracking-[0.22em] text-muted-foreground mb-3 px-1">
          QUICK ACTIONS
        </h3>
        <div className="grid grid-cols-3 gap-2.5 md:gap-3">
          <ActionTile icon={Sparkles} label="Try-On" desc="On your DNA" onClick={onTryOn} />
          <ActionTile icon={Layers}   label="Analyze" desc="Check a product" onClick={onAnalyze} />
          <ActionTile icon={History}  label="History" desc={`${recentTryOnCount} recent`} onClick={onHistory} />
        </div>
      </section>

      {/* ── Lab panels ───────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <LabPanel
          eyebrow="FIT ANALYSIS"
          title="Region-level fit map"
          body="Shoulder, chest, waist, hip and length are scored against the garment's own size chart."
        />
        <LabPanel
          eyebrow="SIZE RECOMMENDATION"
          title="Brand-aware sizing"
          body="MYMYON learns each brand's calibration so the recommended size reflects how that label actually runs."
        />
        <LabPanel
          eyebrow="FIT CONFIDENCE"
          title="Honest confidence score"
          body="If the garment data is thin, you'll see it — no fake precision."
        />
        <LabPanel
          eyebrow="FIT COMPARISON"
          title="Compare two items side-by-side"
          body="See how a tee from one brand fits versus another at the same nominal size."
        />
      </section>
    </div>
  );
};

/* ── Subcomponents ─────────────────────────────────────── */

const AccuracyRing = ({ pct }: { pct: number }) => {
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-[20px] tracking-tight">{pct}%</span>
      </div>
    </div>
  );
};

const ActionTile = ({
  icon: Icon, label, desc, onClick,
}: { icon: typeof Sparkles; label: string; desc: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-accent/40 hover:shadow-soft active:scale-[0.98]"
  >
    <span className="h-9 w-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center ring-1 ring-accent/15">
      <Icon className="h-[16px] w-[16px]" strokeWidth={1.9} />
    </span>
    <span className="block text-[13px] font-semibold leading-tight text-foreground">{label}</span>
    <span className="block text-[11px] text-muted-foreground leading-tight">{desc}</span>
  </button>
);

const LabPanel = ({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <div className="text-[10px] font-medium tracking-[0.22em] text-muted-foreground">{eyebrow}</div>
    <h4 className="font-display text-[18px] md:text-[20px] mt-2 tracking-tight leading-tight">{title}</h4>
    <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed">{body}</p>
  </div>
);

export default FitLabDashboard;
