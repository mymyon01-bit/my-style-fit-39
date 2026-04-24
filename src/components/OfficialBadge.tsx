import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline OFFICIAL badge shown next to MYMYON official account names.
 * Gold accent — uses inline color since this is a branded accent (not themable).
 */
export const OfficialBadge = ({ className, compact = false }: { className?: string; compact?: boolean }) => (
  <span
    className={cn(
      "inline-flex items-center gap-0.5 align-middle font-semibold uppercase tracking-[0.18em] text-[#C9A227]",
      compact ? "text-[8px]" : "text-[9px]",
      className,
    )}
    title="Official MYMYON account"
    aria-label="Official account"
  >
    <BadgeCheck className={cn("fill-[#C9A227]/15 stroke-[#C9A227]", compact ? "h-2.5 w-2.5" : "h-3 w-3")} strokeWidth={2.2} />
    <span>OFFICIAL</span>
  </span>
);

/**
 * Wrap any avatar (img/div) to add a gold ring for official accounts.
 * Renders children as-is when not official.
 */
export const OfficialAvatarRing = ({
  isOfficial,
  children,
  className,
}: {
  isOfficial?: boolean | null;
  children: React.ReactNode;
  className?: string;
}) => {
  if (!isOfficial) return <>{children}</>;
  return (
    <span
      className={cn("relative inline-block rounded-full p-[2px]", className)}
      style={{
        background: "linear-gradient(135deg, #F5D77A 0%, #C9A227 50%, #8C6A12 100%)",
        boxShadow: "0 0 0 1px rgba(201,162,39,0.25), 0 2px 8px rgba(201,162,39,0.25)",
      }}
    >
      <span className="block overflow-hidden rounded-full bg-background">{children}</span>
    </span>
  );
};

export default OfficialBadge;
