import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

const SectionHeader = ({ title, subtitle, onSeeAll }: SectionHeaderProps) => {
  const { t } = useI18n();
  return (
    <div className="flex items-end justify-between px-4 pb-2.5 pt-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-xs font-medium text-accent transition-colors hover:text-accent/80"
        >
          See all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default SectionHeader;
