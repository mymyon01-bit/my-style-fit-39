interface Brand {
  id: string;
  name: string;
  logo: string;
  matchScore: number;
  reason: string;
}

const BrandCard = ({ brand }: { brand: Brand }) => (
  <div className="flex min-w-[130px] flex-col items-center gap-2.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:shadow-elevated hover:border-accent/20 animate-fade-up">
    <img
      src={brand.logo}
      alt={brand.name}
      className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
      loading="lazy"
    />
    <span className="text-sm font-semibold text-foreground tracking-wide">{brand.name}</span>
    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
      {brand.matchScore}%
    </span>
    <span className="text-center text-[10px] leading-tight text-muted-foreground max-w-[100px]">{brand.reason}</span>
  </div>
);

export default BrandCard;
