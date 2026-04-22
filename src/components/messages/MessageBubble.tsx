import { useNavigate } from "react-router-dom";
import { Fragment } from "react";
import { Paperclip } from "lucide-react";

export interface ChatAttachment {
  url: string;
  type: "image" | "file";
  name?: string;
  size?: number;
}

interface Props {
  content: string;
  isMine: boolean;
  createdAt: string;
  readAt?: string | null;
  attachments?: ChatAttachment[];
}

/**
 * Chat bubble: @mentions become profile links, image attachments render
 * inline, file attachments show as a download chip. Shows a tiny "Read"
 * status under the user's own bubbles.
 */
export default function MessageBubble({ content, isMine, createdAt, readAt, attachments = [] }: Props) {
  const navigate = useNavigate();
  const parts = content.split(/(@[a-zA-Z0-9_.-]+)/g);
  const time = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug shadow-soft ${
          isMine
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border border-border/40"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            {attachments.map((a, idx) =>
              a.type === "image" ? (
                <a key={idx} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                  <img src={a.url} alt={a.name || "attachment"} className="max-h-64 w-full object-cover" />
                </a>
              ) : (
                <a
                  key={idx}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                    isMine ? "bg-primary-foreground/15" : "bg-foreground/[0.06]"
                  }`}
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="truncate">{a.name || "Download file"}</span>
                </a>
              ),
            )}
          </div>
        )}

        {content && (
          <p className="whitespace-pre-wrap break-words">
            {parts.map((part, i) => {
              if (part.startsWith("@") && part.length > 1) {
                const handle = part.slice(1);
                return (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${handle}`);
                    }}
                    className={`font-semibold underline-offset-2 hover:underline ${
                      isMine ? "text-primary-foreground" : "text-accent"
                    }`}
                  >
                    @{handle}
                  </button>
                );
              }
              return <Fragment key={i}>{part}</Fragment>;
            })}
          </p>
        )}

        <p className={`mt-1 flex items-center justify-end gap-1.5 text-[9px] tracking-wide ${
          isMine ? "text-primary-foreground/70" : "text-muted-foreground"
        }`}>
          <span>{time}</span>
          {isMine && (
            <span className="opacity-80">{readAt ? "· Read" : "· Sent"}</span>
          )}
        </p>
      </div>
    </div>
  );
}
