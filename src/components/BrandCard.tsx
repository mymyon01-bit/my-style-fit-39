import { type Brand } from "@/lib/mockData";

const BrandCard = ({ brand }: { brand: Brand }) => (
  <div className="flex min-w-[140px] flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card animate-fade-up">
    <img
      src={brand.logo}
      alt={brand.name}
      className="h-12 w-12 rounded-full object-cover"
      loading="lazy"
    />
    <span className="text-sm font-semibold text-foreground">{brand.name}</span>
    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
      {brand.matchScore}% match
    </span>
    <span className="text-center text-[10px] leading-tight text-muted-foreground">{brand.reason}</span>
  </div>
);

export default BrandCard;
