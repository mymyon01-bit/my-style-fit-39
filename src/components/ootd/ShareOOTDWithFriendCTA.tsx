import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { claimStarAction } from "@/lib/starGrants";

/**
 * "Share #OOTD with a friend" CTA — bottom-of-page invite that copies an
 * invite link with the user's referral code (if available) or a generic
 * link. Designed to feel premium with subtle motion.
 */
const ShareOOTDWithFriendCTA = () => {
  const [hover, setHover] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || localStorage.getItem("referral_code") || "";
    setShareUrl(`${window.location.origin}/ootd${ref ? `?ref=${ref}` : ""}`);
  }, []);

  const onShare = async () => {
    const data = {
      title: "Share your #OOTD on mymyon",
      text: "Style my day with me — share your #OOTD on mymyon ✨",
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Invite link copied");
      }
      // Reward +1 star (daily, once)
      claimStarAction("share_ootd");
    } catch {
      // user cancelled — silent
    }
  };

  return (
    <motion.button
      type="button"
      onClick={onShare}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="group relative w-full overflow-hidden rounded-2xl border border-foreground/15 bg-background px-5 py-4 text-left shadow-md transition-shadow hover:shadow-xl"
    >
      {/* Animated diagonal gradient sheen */}
      <motion.span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent"
        animate={{ x: hover ? ["-110%", "110%"] : "-110%" }}
        transition={{
          duration: hover ? 1.4 : 0,
          repeat: hover ? Infinity : 0,
          ease: "easeInOut",
        }}
      />

      <div className="relative flex items-center gap-3">
        <motion.div
          animate={{ rotate: hover ? [0, -10, 10, 0] : 0 }}
          transition={{ duration: 0.6 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2.2} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-foreground/90 uppercase">
            Share <span className="italic">#OOTD</span> with a friend
          </p>
          <p className="mt-0.5 text-[10.5px] text-foreground/55">
            Invite someone to style their day with you.
          </p>
        </div>
        <motion.span
          aria-hidden
          animate={{ x: hover ? 4 : 0 }}
          className="text-foreground/55 text-[18px] leading-none"
        >
          →
        </motion.span>
      </div>
    </motion.button>
  );
};

export default ShareOOTDWithFriendCTA;
