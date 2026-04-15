interface OutfitBundle {
  id: string;
  name: string;
  items: { id: string; image: string; name: string }[];
  occasion: string;
  totalPrice: number;
}
import { useI18n } from "@/lib/i18n";
import { ShoppingBag } from "lucide-react";

const OutfitCard = ({ outfit }: { outfit: OutfitBundle }) => {
  const { t } = useI18n();
  return (
    <div className="min-w-[280px] overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:shadow-elevated animate-fade-up">
      <div className="flex gap-0.5">
        {outfit.items.slice(0, 3).map((item) => (
          <img
            key={item.id}
            src={item.image}
            alt={item.name}
            className="h-32 flex-1 object-cover first:rounded-tl-2xl last:rounded-tr-2xl"
            loading="lazy"
          />
        ))}
      </div>
      <div className="p-3.5">
        <p className="text-sm font-semibold text-foreground">{outfit.name}</p>
        <p className="text-[11px] text-muted-foreground">{outfit.occasion} · {outfit.items.length} items</p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">${outfit.totalPrice}</span>
          <button className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <ShoppingBag className="h-3.5 w-3.5" />
            {t("buyNow")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutfitCard;
