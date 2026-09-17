/**
 * PostShareRow — direct share actions for one OOTD post.
 *
 * Four one-tap social targets (X / Instagram / Facebook / KakaoTalk) plus a
 * "send to chat" action that opens the existing ShareToOOTDDialog on its
 * MESSAGE tab so the link lands inside a real conversation.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Camera, MessageSquare, Send } from "lucide-react";
import ShareToOOTDDialog from "@/components/ShareToOOTDDialog";

interface PostLite {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
}

interface Props {
  post: PostLite;
  author?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  className?: string;
}

const XIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M18.244 3H21l-6.52 7.45L22 21h-5.97l-4.68-6.12L5.96 21H3.2l6.97-7.96L2.5 3h6.12l4.23 5.6L18.244 3zm-2.09 16.2h1.64L7.92 4.7H6.16l9.994 14.5z" />
  </svg>
);

const FacebookIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2C16.4 4.1 15.4 4 14.3 4 12 4 10.5 5.4 10.5 8v2.8H8V14h2.5v8h3z" />
  </svg>
);

export default function PostShareRow({ post, author, className = "" }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/ootd?section=feed&post=${post.id}`
    : "";
  const title = post.caption?.trim() || "Check out this #OOTD on mymyon";

  const openWindow = (target: string) => {
    const win = window.open(target, "_blank", "noopener,noreferrer");
    if (!win) {
      navigator.clipboard?.writeText(`${title} ${url}`).then(
        () => toast.success("창이 막혀 링크를 복사했어요"),
        () => toast.error("공유 창을 열 수 없어요"),
      );
    }
  };

  const shareX = () =>
    openWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`);

  const shareFacebook = () =>
    openWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);

  const shareKakao = async () => {
    try { await navigator.clipboard.writeText(`${title} ${url}`); } catch { /* ignore */ }
    openWindow(
      `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    );
  };

  const shareInstagram = async () => {
    // Instagram has no public web share target — copy so it can be pasted
    // into a DM or story sticker, then open the DM composer.
    try {
      await navigator.clipboard.writeText(`${title} ${url}`);
      toast.success("링크를 복사했어요 — 인스타그램에 붙여넣으세요");
    } catch {
      toast.error("링크를 복사하지 못했어요");
    }
    openWindow("https://www.instagram.com/direct/inbox/");
  };

  const btn =
    "flex h-7 w-7 items-center justify-center rounded-full border border-foreground/15 text-foreground/65 transition hover:border-foreground hover:text-foreground";

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={shareX} aria-label="X로 공유" title="X" className={btn}>
          <XIcon className="h-3 w-3" />
        </button>
        <button type="button" onClick={shareInstagram} aria-label="인스타그램으로 공유" title="Instagram" className={btn}>
          <Camera className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
        <button type="button" onClick={shareFacebook} aria-label="페이스북으로 공유" title="Facebook" className={btn}>
          <FacebookIcon className="h-3 w-3" />
        </button>
        <button type="button" onClick={shareKakao} aria-label="카카오톡으로 공유" title="KakaoTalk" className={btn}>
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="메시지로 보내기"
          title="메시지로 보내기"
          className={`${btn} border-foreground/30`}
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      </div>

      <ShareToOOTDDialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        post={post}
        author={author ?? null}
      />
    </>
  );
}
