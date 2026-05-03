import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link as LinkIcon, Loader2, Sparkles, Star, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface SubmitProductDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SubmittedProduct {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  source_url: string | null;
  category: string | null;
  fit: string | null;
  price: string | null;
}

const SubmitProductDialog = ({ open, onClose }: SubmitProductDialogProps) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ product: SubmittedProduct; awardedStars: number; deduped: boolean } | null>(null);

  const reset = () => {
    setUrl("");
    setResult(null);
    setLoading(false);
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t("submitProductLoginRequired"));
      return;
    }
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error(t("submitProductUrlRequired"));
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      toast.error(t("submitProductInvalidUrl"));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-product-url", {
        body: { url: trimmed },
      });
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.message || data?.error || t("submitProductFailed"));
      }
      setResult({
        product: data.product,
        awardedStars: data.awardedStars ?? 0,
        deduped: !!data.deduped,
      });
      if (data.awardedStars > 0) {
        toast.success(t("submitProductBonusToast").replace("{n}", String(data.awardedStars)));
      } else if (data.deduped) {
        toast.info(t("submitProductDuplicate"));
      }
    } catch (e: any) {
      const msg = e?.message || t("submitProductGenericError");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToFit = () => {
    if (!result?.product) return;
    const p = result.product;
    const parsedPrice = p.price ? parseFloat(String(p.price).replace(/[^0-9.]/g, "")) : NaN;
    const payload = {
      id: p.id,
      name: p.name,
      brand: p.brand || "",
      price: Number.isFinite(parsedPrice) ? parsedPrice : null,
      image: p.image_url || "",
      url: p.source_url || "#",
      category: (p.category || "tops").toLowerCase().includes("bottom") ? "bottoms" : "tops",
      fitType: p.fit || "regular",
      dataQuality: 50,
      source: "user_submission" as const,
    };
    try {
      sessionStorage.setItem(`fit:product:${p.id}`, JSON.stringify(payload));
    } catch { /* ignore */ }
    handleClose();
    navigate(`/fit/${encodeURIComponent(p.id)}`);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm "
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-t-3xl border-t border-accent/20 bg-background sm:rounded-3xl sm:border"
        >
          <button
            onClick={handleClose}
            disabled={loading}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition hover:bg-foreground/20 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="px-6 pb-6 pt-7">
            {!result ? (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <LinkIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold leading-tight text-foreground">{t("submitProductTitle")}</h3>
                    <p className="text-[10.5px] text-foreground/55">{t("submitProductSubtitle")}</p>
                  </div>
                </div>

                <label className="mb-4 block">
                  <span className="mb-1.5 block text-[10px] font-bold tracking-[0.14em] text-foreground/55">
                    {t("submitProductUrlLabel")}
                  </span>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
                    disabled={loading}
                    placeholder="https://www.musinsa.com/app/goods/..."
                    className="w-full rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3 text-[13px] text-foreground outline-none transition placeholder:text-foreground/35 focus:border-accent/60 focus:bg-foreground/[0.05]"
                  />
                </label>

                <div className="mb-5 rounded-xl bg-foreground/[0.04] px-4 py-3">
                  <p className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-foreground/55">{t("submitProductHowTitle")}</p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-foreground/65">
                    <li>{t("submitProductHow1")}</li>
                    <li>{t("submitProductHow2")}</li>
                    <li>{t("submitProductHow3")}</li>
                    <li>{t("submitProductHow4")}</li>
                  </ul>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading || !url.trim()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-[11px] font-bold tracking-[0.14em] text-background transition hover:opacity-90 disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("submitProductAnalyzing")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t("submitProductAnalyze")}
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--star))]/15 text-[hsl(var(--star))]">
                    <Check className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-bold leading-tight text-foreground">
                      {result.deduped ? t("submitProductDuplicateTitle") : t("submitProductDoneTitle")}
                    </h3>
                    {result.awardedStars > 0 && (
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--star))]">
                        <Star className="h-3 w-3 fill-current" />
                        {t("submitProductBonusGiven").replace("{n}", String(result.awardedStars))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-5 flex items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
                  {result.product.image_url ? (
                    <img
                      src={result.product.image_url}
                      alt={result.product.name}
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-lg bg-foreground/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55">
                      {result.product.brand || "—"}
                    </p>
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                      {result.product.name}
                    </p>
                    <p className="mt-1 text-[11px] text-foreground/65">{result.product.price || ""}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={reset}
                    className="flex h-12 flex-1 items-center justify-center rounded-xl border border-foreground/15 text-[11px] font-bold tracking-[0.14em] text-foreground/75 transition hover:bg-foreground/[0.05]"
                  >
                    {t("submitProductAddAnother")}
                  </button>
                  <button
                    onClick={handleSendToFit}
                    className="flex h-12 flex-[1.5] items-center justify-center gap-1.5 rounded-xl bg-accent text-[11px] font-bold tracking-[0.14em] text-accent-foreground transition hover:opacity-90"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t("submitProductSendToFit")}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SubmitProductDialog;
