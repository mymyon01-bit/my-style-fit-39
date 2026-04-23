import { forwardRef } from "react";

interface Props {
  unread?: number;
  onClick?: (anchor: { x: number; y: number }) => void;
  className?: string;
}

/**
 * Cute on-brand mailbox icon — a little wood/postbox with a tiny envelope tab.
 * Drawn with inline SVG so it themes via currentColor. Used as the trigger
 * for the draggable MailboxPopup in the OOTD top bar.
 */
const MailboxIcon = forwardRef<HTMLButtonElement, Props>(({ unread = 0, onClick, className = "" }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onClick?.({ x: rect.right, y: rect.bottom });
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      aria-label="Open mailbox"
      className={`group relative inline-flex h-7 w-7 items-center justify-center text-foreground/75 hover:text-accent transition-colors ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-rotate-3 group-active:scale-95"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Mailbox body (rounded top) */}
        <path d="M4 11.5a4 4 0 0 1 4-4h7a4 4 0 0 1 4 4V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6.5Z" />
        {/* Slot */}
        <path d="M8 11h4" strokeWidth="1.4" />
        {/* Flag (waving when unread) */}
        <path
          d={unread > 0
            ? "M19 7.5h2.2a.6.6 0 0 1 .5.95l-1 1.4 1 1.4a.6.6 0 0 1-.5.95H19"
            : "M19 8.5h2"}
          className={unread > 0 ? "text-accent" : ""}
          stroke={unread > 0 ? "hsl(var(--accent))" : "currentColor"}
        />
        <path d="M19 7.5v6" />
        {/* Post (leg) */}
        <path d="M11.5 19v3" />
      </svg>

      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-accent-foreground leading-none shadow-soft">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
});

MailboxIcon.displayName = "MailboxIcon";

export default MailboxIcon;
