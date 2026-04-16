import { Crown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

const PremiumBanner = () => {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-accent/15 bg-accent/[0.03] px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          <Crown className="h-4 w-4 text-accent/60" />
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="text-[13px] font-medium text-foreground/70">
            {t("premiumBannerTitle")}
          </p>
          <p className="text-[11px] leading-relaxed text-foreground/75">
            {t("premiumBannerDesc")}
          </p>
        </div>
      </div>
      <button className="mt-4 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-accent/60 transition-colors hover:text-accent">
        {t("explorePremium").toUpperCase()}
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
};

export default PremiumBanner;
