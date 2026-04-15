import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

const SectionHeader = ({ title, onSeeAll }: SectionHeaderProps) => (
  <div className="flex items-center justify-between px-4 pb-2 pt-5">
    <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
    {onSeeAll && (
      <button
        onClick={onSeeAll}
        className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        See all
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export default SectionHeader;
