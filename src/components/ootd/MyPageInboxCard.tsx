import { Bell, MessageCircle, ChevronRight } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

interface Props {
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
}

/**
 * Compact card on OOTD My Page that opens the full Messages sheet and the
 * Notifications sheet. Each row shows an unread badge.
 */
export default function MyPageInboxCard({ onOpenMessages, onOpenNotifications }: Props) {
  const { msgUnread, notifUnread } = useNotifications();

  const Row = ({
    icon: Icon,
    label,
    sub,
    count,
    onClick,
  }: {
    icon: any;
    label: string;
    sub: string;
    count: number;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/5"
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-foreground/85">{label}</p>
        <p className="truncate text-[10px] text-foreground/50">{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-foreground/30 transition-transform group-hover:translate-x-0.5" />
    </button>
  );

  return (
    <div className="space-y-1 rounded-2xl border border-border/30 bg-card/40 p-2">
      <Row
        icon={MessageCircle}
        label="Messages"
        sub={msgUnread > 0 ? `${msgUnread} unread` : "Inbox"}
        count={msgUnread}
        onClick={onOpenMessages}
      />
      <Row
        icon={Bell}
        label="Notifications"
        sub={notifUnread > 0 ? `${notifUnread} new` : "Stars, comments, follows"}
        count={notifUnread}
        onClick={onOpenNotifications}
      />
    </div>
  );
}
