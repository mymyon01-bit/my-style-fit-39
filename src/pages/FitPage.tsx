import { useI18n } from "@/lib/i18n";
import { mockProducts } from "@/lib/mockData";
import { useParams, useNavigate } from "react-router-dom";
import { Link2, ImagePlus, ArrowLeft, ExternalLink } from "lucide-react";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";

const FitPage = () => {
  const { t } = useI18n();
  const { productId } = useParams();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");

  const selectedProduct = productId
    ? mockProducts.find((p) => p.id === productId)
    : null;

  if (selectedProduct) {
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
            <img
              src={selectedProduct.image}
              alt={selectedProduct.name}
              className="h-44 w-32 rounded-xl object-cover"
            />
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">{selectedProduct.brand}</p>
              <p className="text-base font-semibold text-foreground">{selectedProduct.name}</p>
              <p className="text-lg font-bold text-foreground">${selectedProduct.price}</p>

              {/* Fit Score */}
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${selectedProduct.fitScore}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-accent">{selectedProduct.fitScore}</span>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("fitScore")}
              </p>
            </div>
          </div>

          {/* Size recommendation */}
          <div className="mt-5 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {t("recommendedSize")}
            </p>
            <p className="mt-1 text-2xl font-bold font-display text-foreground">
              {selectedProduct.recommendedSize}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {selectedProduct.fitComment}
            </p>
          </div>

          {/* Why it suits you */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {t("whyThisSuitsYou")}
            </p>
            <p className="mt-2 text-sm italic leading-relaxed text-foreground">
              "{selectedProduct.reason}"
            </p>
          </div>

          {/* Virtual Fit Preview placeholder */}
          <div className="mt-4 flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/50">
            <div className="text-center">
              <span className="text-3xl">👤</span>
              <p className="mt-2 text-xs text-muted-foreground">{t("virtualFit")}</p>
              <p className="text-[10px] text-muted-foreground">AI visualization preview</p>
            </div>
          </div>

          {/* Buy button */}
          <a
            href={selectedProduct.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
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
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("pasteUrl")}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Upload image */}
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 text-muted-foreground transition-colors hover:border-accent hover:text-accent">
          <ImagePlus className="h-5 w-5" />
          <span className="text-sm font-medium">{t("uploadImage")}</span>
        </button>

        {/* Recommended products to try */}
        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("orChooseRecommended")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {mockProducts.slice(0, 6).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FitPage;
