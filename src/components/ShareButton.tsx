import { Share2, Link2, MessageCircle, Send, Inbox, Camera, Hash, Globe, MessageSquare } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import MessagesFullSheet from "@/components/messages/MessagesFullSheet";

interface ShareButtonProps {
  title: string;
  url?: string;
  className?: string;
  label?: string;
}

/**
 * Share menu — supports WhatsApp, Telegram, Facebook, X, Instagram (copy),
 * Copy link, and "Send via Messages" which opens the in-app inbox.
 *
 * The dropdown is rendered into document.body via a portal so it is never
 * clipped by parent `overflow-hidden` containers (cards, lists, sheets).
 */
const ShareButton = ({ title, url, className = "", label }: ShareButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  // Compute menu position relative to the button (portal coords are viewport-fixed)
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 200;
    const left = Math.min(rect.right - menuW, window.innerWidth - menuW - 8);
    setPos({ top: rect.bottom + 6, left: Math.max(8, left) });
  }, [open]);

  // Close on outside click / scroll / resize
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const close = () => setOpen(false);

  const copy = async () => {
    // Copy "title — url" so pasting anywhere shows the message + link, not
    // just a bare URL (which previously could expose dev/preview hosts).
    const payload = title ? `${title} ${shareUrl}` : shareUrl;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
    close();
  };

  const openLink = (base: string, useTitle = false) => {
    const text = useTitle ? `${title} — ${shareUrl}` : shareUrl;
    const win = window.open(base + encodeURIComponent(text), "_blank", "noopener,noreferrer");
    if (!win) {
      // Popup blocked — fall back to copying so the user can paste manually.
      navigator.clipboard?.writeText(`${title} — ${shareUrl}`).then(
        () => toast.success("Popup blocked — link copied instead"),
        () => toast.error("Could not open share window"),
      );
    }
    close();
  };

  const shareToInstagram = async () => {
    try {
      await navigator.clipboard.writeText(`${title} — ${shareUrl}`);
      toast.success("Copied — paste into Instagram DM or story");
    } catch {
      toast.error("Could not copy");
    }
    close();
  };

  const shareToOOTDMessage = async () => {
    if (!user) {
      toast.error("Sign in to send via Messages");
      close();
      return;
    }
    try {
      await navigator.clipboard.writeText(`${title} — ${shareUrl}`);
      toast.success("Link copied — pick a chat to paste it");
    } catch { /* keep going */ }
    close();
    setMsgOpen(true);
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, url: shareUrl });
        close();
      } catch { /* cancelled */ }
    }
  };

  const shareToKakao = async () => {
    // No JS SDK setup — copy link, then try opening KakaoTalk's web sharer.
    // On mobile this hands off to the app; on desktop it falls back to copy.
    try {
      await navigator.clipboard.writeText(`${title} — ${shareUrl}`);
    } catch { /* keep going */ }
    const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`;
    const win = window.open(kakaoUrl, "_blank", "noopener,noreferrer");
    if (!win) toast.success("Link copied — paste into KakaoTalk");
    else toast.success("Opening KakaoTalk…");
    close();
  };

  const items: Array<{ key: string; label: string; icon: React.ReactNode; onClick: () => void }> = [
    { key: "copy", label: "Copy link", icon: <Link2 className="h-3.5 w-3.5" />, onClick: copy },
    { key: "msg", label: "Send via Messages", icon: <Inbox className="h-3.5 w-3.5" />, onClick: shareToOOTDMessage },
    { key: "kakao", label: "KakaoTalk", icon: <MessageSquare className="h-3.5 w-3.5" />, onClick: shareToKakao },
    { key: "zalo", label: "Zalo", icon: <MessageSquare className="h-3.5 w-3.5" />, onClick: () => openLink("https://zalo.me/share/link?url=", false) },
    { key: "wa", label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" />, onClick: () => openLink("https://wa.me/?text=", true) },
    { key: "tg", label: "Telegram", icon: <Send className="h-3.5 w-3.5" />, onClick: () => openLink(`https://t.me/share/url?text=${encodeURIComponent(title)}&url=`) },
    { key: "fb", label: "Facebook", icon: <Globe className="h-3.5 w-3.5" />, onClick: () => openLink("https://www.facebook.com/sharer/sharer.php?u=") },
    { key: "tw", label: "X / Twitter", icon: <Hash className="h-3.5 w-3.5" />, onClick: () => openLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=`) },
    { key: "ig", label: "Instagram", icon: <Camera className="h-3.5 w-3.5" />, onClick: shareToInstagram },
  ];

  return (
    <>
      <div className={`relative ${className}`}>
        {label ? (
          <button
            ref={btnRef}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            onDoubleClick={nativeShare}
            aria-label="Share"
            className="rounded-full border border-foreground/20 px-2.5 py-1.5 text-[9px] font-semibold tracking-wide text-foreground/75 transition-all duration-200 hover:border-foreground hover:text-foreground whitespace-nowrap md:px-3 md:text-[10px]"
          >
            {label}
          </button>
        ) : (
          <button
            ref={btnRef}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            onDoubleClick={nativeShare}
            aria-label="Share"
            className="hover-burgundy flex h-6 w-6 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all hover:bg-background/90"
          >
            <Share2 className="h-3 w-3 text-foreground/75" />
          </button>
        )}
      </div>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 200 }}
          className="z-[200] flex flex-col gap-0.5 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-2 shadow-elevated animate-fade-up"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it) => (
            <button
              key={it.key}
              onClick={(e) => { e.stopPropagation(); it.onClick(); }}
              className="hover-burgundy flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground/75 text-left"
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}

      <MessagesFullSheet open={msgOpen} onClose={() => setMsgOpen(false)} />
    </>
  );
};

export default ShareButton;
