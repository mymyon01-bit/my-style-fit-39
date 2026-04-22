import { Share2, Link2, MessageCircle, Send, Facebook, Twitter, Instagram, Inbox } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import MessagesFullSheet from "@/components/messages/MessagesFullSheet";

interface ShareButtonProps {
  title: string;
  url?: string;
  className?: string;
}

/**
 * Share menu — supports WhatsApp, Telegram, Facebook, X (Twitter),
 * Instagram (copy-to-clipboard hint), Copy link, and "Send via OOTD message"
 * which copies the link and opens the in-app Messages inbox so the user can
 * pick a recipient and paste it into a chat.
 */
const ShareButton = ({ title, url, className = "" }: ShareButtonProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
    close();
  };

  const openLink = (base: string, useTitle = false) => {
    const text = useTitle ? `${title} — ${shareUrl}` : shareUrl;
    window.open(base + encodeURIComponent(text), "_blank", "noopener");
    close();
  };

  const shareToInstagram = async () => {
    // Instagram has no public web share intent — copy + tell user
    await navigator.clipboard.writeText(`${title} — ${shareUrl}`);
    toast.success("Copied — paste into Instagram DM or story");
    close();
  };

  const shareToOOTDMessage = async () => {
    if (!user) {
      toast.error("Sign in to send via Messages");
      close();
      return;
    }
    await navigator.clipboard.writeText(`${title} — ${shareUrl}`);
    toast.success("Link copied — pick a chat to paste it");
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

  const items: Array<{ key: string; label: string; icon: React.ReactNode; onClick: () => void }> = [
    { key: "copy", label: "Copy link", icon: <Link2 className="h-3.5 w-3.5" />, onClick: copy },
    { key: "msg", label: "Send via Messages", icon: <Inbox className="h-3.5 w-3.5" />, onClick: shareToOOTDMessage },
    { key: "wa", label: "WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" />, onClick: () => openLink("https://wa.me/?text=", true) },
    { key: "tg", label: "Telegram", icon: <Send className="h-3.5 w-3.5" />, onClick: () => openLink(`https://t.me/share/url?text=${encodeURIComponent(title)}&url=`) },
    { key: "fb", label: "Facebook", icon: <Facebook className="h-3.5 w-3.5" />, onClick: () => openLink("https://www.facebook.com/sharer/sharer.php?u=") },
    { key: "tw", label: "X / Twitter", icon: <Twitter className="h-3.5 w-3.5" />, onClick: () => openLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=`) },
    { key: "ig", label: "Instagram", icon: <Instagram className="h-3.5 w-3.5" />, onClick: shareToInstagram },
  ];

  return (
    <>
      <div ref={ref} className={`relative ${className}`}>
        <button
          onClick={handleShare}
          onDoubleClick={nativeShare}
          aria-label="Share"
          className="hover-burgundy flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all hover:bg-background/90"
        >
          <Share2 className="h-3.5 w-3.5 text-foreground/75" />
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-50 flex flex-col gap-0.5 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-2 shadow-elevated animate-fade-up min-w-[180px]">
            {items.map((it) => (
              <button
                key={it.key}
                onClick={(e) => { e.stopPropagation(); it.onClick(); }}
                className="hover-burgundy flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground/75 text-left"
              >
                {it.icon} {it.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <MessagesFullSheet open={msgOpen} onClose={() => setMsgOpen(false)} />
    </>
  );
};

export default ShareButton;
