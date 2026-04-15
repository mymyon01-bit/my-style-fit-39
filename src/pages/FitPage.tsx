import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { mockProducts } from "@/lib/mockData";
import { useParams, useNavigate } from "react-router-dom";
import { Link2, ArrowLeft, ExternalLink, User } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import NavDropdown from "@/components/NavDropdown";

const FitBreakdownBar = ({ label, value, status }: { label: string; value: number; status: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-xs text-foreground/40">{label}</span>
      <span className={`text-[10px] font-semibold ${
        status === "perfect" ? "text-green-500" : status === "tight" ? "text-orange-500" : "text-blue-500"
      }`}>{status}</span>
    </div>
    <div className="h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
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
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-6 py-4">
            <button onClick={() => navigate("/fit")} className="text-foreground/40 hover:text-foreground/70">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">FIT RESULT</span>
          </div>
        </header>

        <div className="mx-auto max-w-lg space-y-5 px-6 pt-2 pb-12">
          {/* Product */}
          <div className="flex gap-4">
            <img src={selectedProduct.image} alt={selectedProduct.name}
              className="h-40 w-28 rounded-xl object-cover" />
            <div className="flex-1 space-y-2">
              <p className="text-[10px] tracking-[0.1em] text-foreground/30">{selectedProduct.brand}</p>
              <p className="font-display text-base font-medium text-foreground">{selectedProduct.name}</p>
              <p className="text-lg font-bold text-foreground">${selectedProduct.price}</p>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${selectedProduct.fitScore}%` }} />
                </div>
                <span className="text-sm font-bold text-accent">{selectedProduct.fitScore}</span>
              </div>
            </div>
          </div>

          {/* Avatar Preview */}
          <div className="rounded-xl border border-foreground/[0.04] bg-card/50 backdrop-blur-sm">
            <div className="flex h-52 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-28 w-16 items-center justify-center rounded-xl border border-dashed border-foreground/10">
                  <User className="h-10 w-10 text-foreground/10" />
                </div>
                <p className="mt-2 text-[10px] text-foreground/20">AI avatar visualization</p>
              </div>
            </div>
          </div>

          {/* Fit Breakdown */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/25">FIT BREAKDOWN</p>
            {fitBreakdown.map(item => <FitBreakdownBar key={item.label} {...item} />)}
          </div>

          {/* Size */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/25">RECOMMENDED SIZE</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{selectedProduct.recommendedSize}</p>
            <p className="mt-1 text-sm font-light leading-relaxed text-foreground/50">{selectedProduct.fitComment}</p>
          </div>

          {/* Why */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/25">WHY THIS WORKS</p>
            <p className="mt-1 text-sm font-light italic leading-relaxed text-foreground/60">"{selectedProduct.reason}"</p>
          </div>

          {/* Buy */}
          <AuthGate action="purchase items">
            <a href={selectedProduct.url} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90">
              {t("buyNow")}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </AuthGate>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <NavDropdown />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">FIT</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-6 pt-2 pb-12">
        {/* URL input */}
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/25">PASTE A PRODUCT LINK</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-card/60 px-4 py-3 backdrop-blur-sm">
            <Link2 className="h-4 w-4 text-foreground/20" />
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder={t("pasteUrl")}
              className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/20" />
          </div>
        </div>

        {/* Quick try */}
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/25">OR TRY THESE</p>
          <div className="mt-3 space-y-2">
            {mockProducts.slice(0, 3).map(product => (
              <button
                key={product.id}
                onClick={() => navigate(`/fit/${product.id}`)}
                className="flex w-full items-center gap-3 rounded-xl bg-card/40 p-3 text-left transition-colors hover:bg-card/70"
              >
                <img src={product.image} alt={product.name} className="h-14 w-10 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{product.name}</p>
                  <p className="text-[10px] text-foreground/30">{product.brand} · ${product.price}</p>
                </div>
                <span className="text-xs font-bold text-accent">{product.fitScore}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FitPage;
