import { type OutfitBundle } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";

const OutfitCard = ({ outfit }: { outfit: OutfitBundle }) => {
  const { t } = useI18n();
  return (
    <div className="min-w-[280px] rounded-xl border border-border bg-card p-3 shadow-card animate-fade-up">
      <div className="flex gap-2">
        {outfit.items.slice(0, 3).map((item) => (
          <img
            key={item.id}
            src={item.image}
            alt={item.name}
            className="h-28 w-20 rounded-lg object-cover"
            loading="lazy"
          />
        ))}
      </div>
      <div className="mt-2.5">
        <p className="text-sm font-semibold text-foreground">{outfit.name}</p>
        <p className="text-xs text-muted-foreground">{outfit.occasion}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">${outfit.totalPrice}</span>
          <button className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            {t("buyNow")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutfitCard;
