import { useNavigate } from "react-router-dom";
import { Fragment, useEffect, useRef, useState } from "react";
import { Paperclip, Sparkles, UserCircle2, ShoppingBag, Camera, ThumbsUp, ThumbsDown, Trash2, Zap } from "lucide-react";

export interface ChatAttachment {
  /**
   * Attachment kinds:
   *  - "image" / "file" — uploaded media (legacy)
   *  - "ootd_post"     — a re-shared OOTD post (renders a preview card)
   *  - "namecard"      — a sender/other-user namecard
   *  - "product"       — an in-app product share (renders a tappable card)
   */
  url: string;
  type: "image" | "file" | "ootd_post" | "namecard" | "product" | "story";
  name?: string;
  size?: number;
  /** Extra metadata used by ootd_post / namecard / product renderers. */
  meta?: {
    post_id?: string;
    user_id?: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    caption?: string | null;
    // product
    product_id?: string;
    brand?: string | null;
    name?: string | null;
    image_url?: string | null;
    source_url?: string | null;
    // story
    story_id?: string;
    media_type?: "image" | "video";
  };
}

interface Props {
  id?: string;
  content: string;
  isMine: boolean;
  createdAt: string;
  readAt?: string | null;
  attachments?: ChatAttachment[];
  /** Externally triggered shake (e.g. nudge from other user). */
  shake?: boolean;
  /** Sender unsends own message. */
  onUnsend?: () => void;
  /** Sender nudges this message — wiggle on the recipient side. */
  onNudge?: () => void;
}

type Reaction = "like" | "dislike" | null;

function readReaction(id: string | undefined): Reaction {
  if (!id || typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(`msg-react:${id}`);
    return v === "like" || v === "dislike" ? v : null;
  } catch { return null; }
}

function writeReaction(id: string | undefined, r: Reaction) {
  if (!id || typeof window === "undefined") return;
  try {
    if (r) localStorage.setItem(`msg-react:${id}`, r);
    else localStorage.removeItem(`msg-react:${id}`);
  } catch { /* ignore */ }
}

/**
 * Chat bubble: @mentions become profile links, image attachments render
 * inline, file attachments show as a download chip. Shows a tiny "Read"
 * status under the user's own bubbles.
 *
 * Two new rich attachment types are also supported:
 *   - ootd_post  → preview card that deep-links to the OOTD post
 *   - namecard   → avatar + name pill that deep-links to the user profile
 *
 * Mobile reactions: a like/dislike row appears below each bubble. The
 * choice is persisted locally per-message so the user gets instant feedback
 * without waiting on backend infra.
 */
export default function MessageBubble({ id, content, isMine, createdAt, readAt, attachments = [] }: Props) {
  const navigate = useNavigate();
  const [reaction, setReaction] = useState<Reaction>(() => readReaction(id));
  useEffect(() => { setReaction(readReaction(id)); }, [id]);
  const toggle = (r: Exclude<Reaction, null>) => {
    const next: Reaction = reaction === r ? null : r;
    setReaction(next);
    writeReaction(id, next);
  };
  const parts = content.split(/(@[a-zA-Z0-9_.-]+)/g);
  const time = new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[12px] leading-snug shadow-soft ${
          isMine
            ? "bg-primary text-primary-foreground"
            : "bg-card/85 backdrop-blur-sm text-card-foreground border border-border/25"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            {attachments.map((a, idx) => {
              if (a.type === "ootd_post") {
                const targetUser = a.meta?.user_id || "";
                const postId = a.meta?.post_id || "";
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (targetUser) navigate(`/user/${targetUser}?post=${postId}`);
                    }}
                    className={`flex w-full items-stretch gap-2 overflow-hidden rounded-xl border text-left transition-colors ${
                      isMine
                        ? "border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15"
                        : "border-border/40 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
                    }`}
                  >
                    {a.url ? (
                      <img src={a.url} alt={a.name || "OOTD"} className="h-20 w-20 flex-shrink-0 object-cover" />
                    ) : (
                      <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center ${isMine ? "bg-primary-foreground/10" : "bg-muted"}`}>
                        <Sparkles className="h-4 w-4 opacity-60" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
                      <p className={`text-[9px] font-semibold tracking-[0.18em] ${isMine ? "text-primary-foreground/70" : "text-foreground/55"}`}>
                        SHARED OOTD
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] font-medium">
                        {a.meta?.caption || a.name || "View this look"}
                      </p>
                      {(a.meta?.display_name || a.meta?.username) && (
                        <p className={`mt-0.5 truncate text-[10px] ${isMine ? "text-primary-foreground/65" : "text-muted-foreground"}`}>
                          @{a.meta?.username || a.meta?.display_name}
                        </p>
                      )}
                    </div>
                  </button>
                );
              }

              if (a.type === "product") {
                const productId = a.meta?.product_id || "";
                const sourceUrl = a.meta?.source_url || "";
                const img = a.meta?.image_url || a.url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Prefer in-app deep link via Discover (?p=id); fall back to source.
                      if (productId) navigate(`/discover?p=${productId}`);
                      else if (sourceUrl) window.open(sourceUrl, "_blank", "noopener,noreferrer");
                    }}
                    className={`flex w-full items-stretch gap-2 overflow-hidden rounded-xl border text-left transition-colors ${
                      isMine
                        ? "border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15"
                        : "border-border/40 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
                    }`}
                  >
                    {img ? (
                      <img src={img} alt={a.meta?.name || a.name || "Product"} className="h-20 w-20 flex-shrink-0 object-cover" />
                    ) : (
                      <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center ${isMine ? "bg-primary-foreground/10" : "bg-muted"}`}>
                        <ShoppingBag className="h-4 w-4 opacity-60" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
                      <p className={`text-[9px] font-semibold tracking-[0.18em] ${isMine ? "text-primary-foreground/70" : "text-foreground/55"}`}>
                        SHARED PRODUCT
                      </p>
                      {a.meta?.brand && (
                        <p className={`mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.14em] ${isMine ? "text-primary-foreground/80" : "text-foreground/65"}`}>
                          {a.meta.brand}
                        </p>
                      )}
                      <p className="line-clamp-2 text-[11.5px] font-medium">
                        {a.meta?.name || a.name || "View product"}
                      </p>
                    </div>
                  </button>
                );
              }

              if (a.type === "namecard") {
                const targetUser = a.meta?.user_id || "";
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (targetUser) navigate(`/user/${targetUser}`);
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                      isMine
                        ? "border-primary-foreground/20 bg-primary-foreground/10 hover:bg-primary-foreground/15"
                        : "border-border/40 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
                    }`}
                  >
                    <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                      {a.meta?.avatar_url ? (
                        <img src={a.meta.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <UserCircle2 className="h-5 w-5 opacity-60" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[9px] font-semibold tracking-[0.18em] ${isMine ? "text-primary-foreground/70" : "text-foreground/55"}`}>
                        NAMECARD
                      </p>
                      <p className="truncate text-[12px] font-semibold">
                        {a.meta?.display_name || a.meta?.username || "View profile"}
                      </p>
                      {a.meta?.username && (
                        <p className={`truncate text-[10px] ${isMine ? "text-primary-foreground/65" : "text-muted-foreground"}`}>
                          @{a.meta.username}
                        </p>
                      )}
                    </div>
                  </button>
                );
              }

              if (a.type === "story") {
                const img = a.url || a.meta?.image_url;
                return (
                  <div
                    key={idx}
                    className={`flex w-full items-stretch gap-2 overflow-hidden rounded-xl border ${
                      isMine
                        ? "border-primary-foreground/20 bg-primary-foreground/10"
                        : "border-border/40 bg-foreground/[0.03]"
                    }`}
                  >
                    {img ? (
                      <img src={img} alt="story" className="h-20 w-16 flex-shrink-0 object-cover" />
                    ) : (
                      <div className={`flex h-20 w-16 flex-shrink-0 items-center justify-center ${isMine ? "bg-primary-foreground/10" : "bg-muted"}`}>
                        <Camera className="h-4 w-4 opacity-60" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
                      <p className={`text-[9px] font-semibold tracking-[0.18em] ${isMine ? "text-primary-foreground/70" : "text-foreground/55"}`}>
                        REPLIED TO STORY
                      </p>
                      {(a.meta?.display_name || a.meta?.username) && (
                        <p className={`mt-0.5 truncate text-[10.5px] ${isMine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          @{a.meta?.username || a.meta?.display_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              if (a.type === "image") {
                return (
                  <a key={idx} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                    <img src={a.url} alt={a.name || "attachment"} className="max-h-64 w-full object-cover" />
                  </a>
                );
              }

              return (
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
              );
            })}
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

      {/* Mobile-friendly reactions row */}
      <div className={`mt-1 flex items-center gap-1 ${isMine ? "pr-1" : "pl-1"}`}>
        <button
          type="button"
          onClick={() => toggle("like")}
          aria-label="Like message"
          aria-pressed={reaction === "like"}
          className={`flex h-7 min-w-[34px] items-center justify-center gap-1 rounded-full border px-2 text-[11px] transition-all active:scale-95 ${
            reaction === "like"
              ? "border-accent bg-accent/15 text-accent"
              : "border-border/40 bg-background/60 text-foreground/55 hover:bg-foreground/[0.04]"
          }`}
        >
          <ThumbsUp className="h-3 w-3" strokeWidth={reaction === "like" ? 2.6 : 2} />
          {reaction === "like" && <span className="text-[10px] font-bold">1</span>}
        </button>
        <button
          type="button"
          onClick={() => toggle("dislike")}
          aria-label="Dislike message"
          aria-pressed={reaction === "dislike"}
          className={`flex h-7 min-w-[34px] items-center justify-center gap-1 rounded-full border px-2 text-[11px] transition-all active:scale-95 ${
            reaction === "dislike"
              ? "border-destructive/60 bg-destructive/10 text-destructive"
              : "border-border/40 bg-background/60 text-foreground/55 hover:bg-foreground/[0.04]"
          }`}
        >
          <ThumbsDown className="h-3 w-3" strokeWidth={reaction === "dislike" ? 2.6 : 2} />
          {reaction === "dislike" && <span className="text-[10px] font-bold">1</span>}
        </button>
      </div>
    </div>
  );
}
