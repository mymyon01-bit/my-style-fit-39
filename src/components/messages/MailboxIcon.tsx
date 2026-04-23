import { forwardRef } from "react";

interface Props {
  unread?: number;
  onClick?: (anchor: { x: number; y: number }) => void;
  className?: string;
}

/**
 * Letter / envelope icon — simpler, more legible than the mailbox.
 * Drawn as inline SVG so it themes via currentColor and feels like
 * a hand-drawn note. Used as the trigger for the draggable MailboxPopup.
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
      aria-label="Open messages"
      className={`group relative inline-flex h-7 w-7 items-center justify-center text-foreground/75 hover:text-accent transition-colors ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-translate-y-[1px] group-active:scale-95"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Envelope body */}
        <rect x="3" y="6" width="18" height="13" rx="2.2" />
        {/* Flap */}
        <path d="M3.6 7.2 L12 13.2 L20.4 7.2" />
        {/* Tiny seal dot when unread */}
        {unread > 0 && (
          <circle cx="12" cy="13.2" r="0.9" fill="hsl(var(--accent))" stroke="none" />
        )}
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
