import { Share2, Link2, MessageCircle, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  url?: string;
  className?: string;
}

const ShareButton = ({ title, url, className = "" }: ShareButtonProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shareUrl = url || window.location.href;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      setOpen(!open);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
    setOpen(false);
  };

  const openLink = (base: string) => {
    window.open(base + encodeURIComponent(shareUrl), "_blank", "noopener");
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={handleShare}
        className="hover-burgundy flex h-8 w-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-md transition-all hover:bg-background/90"
      >
        <Share2 className="h-3.5 w-3.5 text-foreground/60" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 flex flex-col gap-1 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-2 shadow-elevated animate-fade-up min-w-[140px]">
          <button onClick={copy} className="hover-burgundy flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground/60">
            <Link2 className="h-3.5 w-3.5" /> Copy link
          </button>
          <button onClick={() => openLink("https://wa.me/?text=")} className="hover-burgundy flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground/60">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button onClick={() => openLink("https://t.me/share/url?url=")} className="hover-burgundy flex items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] font-medium text-foreground/60">
            <Send className="h-3.5 w-3.5" /> Telegram
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareButton;
