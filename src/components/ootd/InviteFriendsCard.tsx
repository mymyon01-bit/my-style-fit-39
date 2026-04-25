import { useState } from "react";
import { Gift, Star, Copy, Check, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useReferralCode } from "@/hooks/useReferralCode";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * "Invite friends to #OOTD — earn ⭐" card.
 *
 * Shows on My Page (web + mobile). Each successful referral grants the
 * inviter +5 stars (and +3 to the new user) — wired through the existing
 * `claim_referral` RPC + `referrals` table.
 */
export default function InviteFriendsCard() {
  const { user } = useAuth();
  const { code, loading } = useReferralCode();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const inviteUrl =
    code && typeof window !== "undefined"
      ? `${window.location.origin}/auth?ref=${code}`
      : null;

  const inviteText = inviteUrl
    ? `Join me on MYMYON #OOTD — share your daily looks and earn ⭐ stars: ${inviteUrl}`
    : "";

  const onCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied — share it with friends ✨");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Long-press to copy manually.");
    }
  };

  const onShare = async () => {
    if (!inviteUrl) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "Join me on MYMYON #OOTD",
          text: "Share your daily looks and earn ⭐ stars on MYMYON.",
          url: inviteUrl,
        });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    onCopy();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.08] via-card/40 to-card/40 p-4 backdrop-blur-md"
    >
      {/* Decorative shimmer */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/15 blur-2xl"
      />

      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Gift className="h-4 w-4" />
            <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--star))] text-background">
              <Star className="h-2.5 w-2.5 fill-background" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-foreground/85">
              Invite friends to #OOTD
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/60">
              Get <span className="font-semibold text-[hsl(var(--star))]">+5 ⭐</span>{" "}
              for every friend who joins. They get{" "}
              <span className="font-semibold text-foreground/80">+3 ⭐</span> too.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:shrink-0">
          <button
            type="button"
            onClick={onCopy}
            disabled={loading || !inviteUrl}
            className="group inline-flex items-center gap-1.5 rounded-full border border-foreground/20 bg-background/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/85 hover:border-accent/50 hover:text-accent disabled:opacity-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={loading || !inviteUrl}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-background hover:bg-accent hover:text-background disabled:opacity-50 transition-colors"
          >
            <Share2 className="h-3 w-3" /> Share
          </button>
        </div>
      </div>

      {code && (
        <p className="relative mt-3 text-[10px] tracking-[0.2em] uppercase text-foreground/40">
          Your code: <span className="font-mono text-foreground/70">{code}</span>
        </p>
      )}
    </motion.div>
  );
}
