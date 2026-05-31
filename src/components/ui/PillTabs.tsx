export interface PillTab<T extends string = string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  tabs: PillTab<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

/**
 * PillTabs — compact in-page filter, NEVER global navigation.
 * Visual: thin underline + active pill, no icons, no big chrome.
 */
export default function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: Props<T>) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 overflow-x-auto border-b border-border/60 scrollbar-hide ${className}`}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`relative shrink-0 px-3 py-2.5 text-[13px] tracking-tight transition-colors md:text-[14px] ${
              active
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground/80 font-normal"
            }`}
          >
            {t.label}
            <span
              className={`pointer-events-none absolute -bottom-px left-2 right-2 h-px bg-foreground transition-opacity ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
