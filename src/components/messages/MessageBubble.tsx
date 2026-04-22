import { useNavigate } from "react-router-dom";
import { Fragment } from "react";

interface Props {
  content: string;
  isMine: boolean;
  createdAt: string;
}

/**
 * Renders a chat bubble with @username mentions turned into clickable links
 * that navigate to the user's profile page.
 */
export default function MessageBubble({ content, isMine, createdAt }: Props) {
  const navigate = useNavigate();

  const parts = content.split(/(@[a-zA-Z0-9_.-]+)/g);

  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[13px] leading-snug shadow-soft ${
          isMine
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground border border-border/40"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {parts.map((part, i) => {
            if (part.startsWith("@") && part.length > 1) {
              const handle = part.slice(1);
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/u/${handle}`);
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
        <p
          className={`mt-1 text-[9px] tracking-wide ${
            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
