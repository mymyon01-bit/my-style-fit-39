import { useI18n } from "@/lib/i18n";
import { mockProducts } from "@/lib/mockData";
import { useParams, useNavigate } from "react-router-dom";
import { Link2, ImagePlus, ArrowLeft, ExternalLink, User } from "lucide-react";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";

const FitBreakdownBar = ({ label, value, status }: { label: string; value: number; status: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-[10px] font-semibold ${
        status === "perfect" ? "text-green-500" : status === "tight" ? "text-orange-500" : "text-blue-500"
      }`}>{status}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div
        className={`h-full rounded-full transition-all ${
          status === "perfect" ? "bg-green-500" : status === "tight" ? "bg-orange-500" : "bg-blue-500"
        }`}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const FitPage = () => {
  const { t } = useI18n();
  const { productId } = useParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");

  const selectedProduct = productId ? mockProducts.find(p => p.id === productId) : null;

  if (selectedProduct) {
    const fitBreakdown = [
      { label: t("shoulderFit"), value: 85, status: t("perfect") },
      { label: t("lengthFit"), value: 70, status: t("loose") },
      { label: t("waistFit"), value: 90, status: t("perfect") },
    ];

    return (
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
            <button onClick={() => navigate("/fit")} className="text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-lg font-semibold text-foreground">{t("fitResult")}</h1>
          </div>
        </header>

        <div className="mx-auto max-w-lg px-4 pt-4">
          {/* Product image + info */}
          <div className="flex gap-4">
            <img src={selectedProduct.image} alt={selectedProduct.name}
              className="h-44 w-32 rounded-xl object-cover" />
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">{selectedProduct.brand}</p>
              <p className="text-base font-semibold text-foreground">{selectedProduct.name}</p>
              <p className="text-lg font-bold text-foreground">${selectedProduct.price}</p>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${selectedProduct.fitScore}%` }} />
                </div>
                <span className="text-sm font-bold text-accent">{selectedProduct.fitScore}</span>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("fitScore")}</p>
            </div>
          </div>

          {/* Avatar Preview */}
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">{t("avatarPreview")}</p>
            </div>
            <div className="flex h-64 items-center justify-center bg-secondary/30">
              <div className="text-center">
                <div className="mx-auto flex h-32 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-accent/30">
                  <User className="h-12 w-12 text-accent/40" />
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">AI avatar visualization</p>
              </div>
            </div>
          </div>

          {/* Fit Breakdown */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">{t("fitBreakdown")}</p>
            <div className="mt-3 space-y-3">
              {fitBreakdown.map(item => (
                <FitBreakdownBar key={item.label} {...item} />
              ))}
            </div>
          </div>

          {/* Size recommendation */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">{t("recommendedSize")}</p>
            <p className="mt-1 text-2xl font-bold font-display text-foreground">{selectedProduct.recommendedSize}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selectedProduct.fitComment}</p>
          </div>

          {/* Size Comparison */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("sizeComparison")}</p>
            <div className="mt-3 flex gap-2">
              {["S", "M", "L", "XL"].map(size => (
                <div key={size} className={`flex-1 rounded-lg border py-3 text-center text-sm font-semibold transition-all ${
                  size === selectedProduct.recommendedSize
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground"
                }`}>
                  {size}
                </div>
              ))}
            </div>
          </div>

          {/* Why it suits you */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">{t("whyThisSuitsYou")}</p>
            <p className="mt-2 text-sm italic leading-relaxed text-foreground">"{selectedProduct.reason}"</p>
          </div>

          {/* Buy button */}
          <a href={selectedProduct.url} target="_blank" rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            {t("buyNow")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-3">
          <h1 className="font-display text-xl font-bold text-foreground">{t("virtualFit")}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* URL input */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder={t("pasteUrl")}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>

        {/* Upload image */}
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-muted-foreground transition-colors hover:border-accent hover:text-accent">
          <ImagePlus className="h-5 w-5" />
          <span className="text-sm font-medium">{t("uploadImage")}</span>
        </button>

        {/* AI Stylist TPO Section */}
        <TPOSection />

        {/* Recommended products */}
        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("orChooseRecommended")}</p>
        <div className="grid grid-cols-2 gap-3">
          {mockProducts.slice(0, 6).map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

// TPO-based AI Stylist section
const TPOSection = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [generatedLooks, setGeneratedLooks] = useState(false);

  const times = [
    { key: "dayTime", emoji: "☀️" },
    { key: "nightTime", emoji: "🌙" },
  ];
  const places = [
    { key: "office", emoji: "🏢" },
    { key: "casual2", emoji: "🏠" },
    { key: "travel", emoji: "✈️" },
    { key: "date", emoji: "🍷" },
  ];
  const occasions2 = [
    { key: "daily", emoji: "👤" },
    { key: "meeting", emoji: "💼" },
    { key: "party", emoji: "🎉" },
    { key: "event", emoji: "🎭" },
  ];

  const chipBtn = (key: string, emoji: string, selected: string | null, setSelected: (v: string | null) => void) => (
    <button key={key} onClick={() => setSelected(selected === key ? null : key)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all ${
        selected === key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
      }`}>
      <span>{emoji}</span>
      {t(key as any)}
    </button>
  );

  return (
    <div className="rounded-xl border border-accent/20 bg-card p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{t("aiStylist")}</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">{t("premiumFeature")}</span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("time")}</p>
          <div className="mt-1.5 flex gap-2">
            {times.map(i => chipBtn(i.key, i.emoji, selectedTime, setSelectedTime))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("place")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {places.map(i => chipBtn(i.key, i.emoji, selectedPlace, setSelectedPlace))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("occasion")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {occasions2.map(i => chipBtn(i.key, i.emoji, selectedOccasion, setSelectedOccasion))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setGeneratedLooks(true)}
        disabled={!selectedTime || !selectedPlace}
        className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {t("generateLooks")}
      </button>

      {generatedLooks && (
        <div className="mt-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">{t("lookGenerated")}</p>
          {mockProducts.slice(0, 3).map((p, i) => (
            <div key={p.id} onClick={() => navigate(`/fit/${p.id}`)}
              className="flex cursor-pointer items-center gap-3 rounded-lg bg-secondary/50 p-2.5 transition-colors hover:bg-secondary">
              <img src={p.image} alt={p.name} className="h-16 w-12 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.brand} · ${p.price}</p>
                <p className="mt-0.5 text-[10px] italic text-accent">"{p.reason}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FitPage;
