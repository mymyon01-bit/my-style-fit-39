import { type ReactNode } from "react";

/**
 * PageHeader — quiet editorial title block used at the top of every page.
 * Replaces the old neon banner / graffiti / second-menu header style.
 */
export default function PageHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-start justify-between gap-4 pt-8 pb-5 md:pt-12 md:pb-7 ${className}`}>
      <div className="min-w-0">
        <h1
          className="font-display text-[26px] leading-[1.1] tracking-tight text-foreground md:text-[34px]"
          style={{ fontWeight: 500 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13px] text-muted-foreground md:text-[14px]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
