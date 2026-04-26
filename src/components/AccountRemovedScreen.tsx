/**
 * AccountRemovedScreen — shown when a user attempts to sign in with an email
 * whose account was removed for community-guideline violations.
 *
 * Styled in the OOTD graffiti aesthetic: pink spray-paint title with black
 * stroke, slight rotation, animated paint-stroke entry.
 *
 * Re-signup is allowed: the user can tap "Create a new account" to start fresh
 * with the same email (the underlying auth user has been deleted).
 */
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

interface Props {
  email: string;
  reason?: string | null;
  onCreateNew: () => void;
  onContact: () => void;
  onBack: () => void;
}

export default function AccountRemovedScreen({
  email,
  reason,
  onCreateNew,
  onContact,
  onBack,
}: Props) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex w-full max-w-md flex-col items-center gap-6 px-6 py-10 text-center"
    >
      {/* Spray-painted title */}
      <div className="relative">
        <motion.h1
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.5, ease: "backOut" }}
          className="font-display text-[44px] font-black italic leading-[0.95] tracking-tight"
          style={{
            color: "hsl(330 95% 60%)",
            WebkitTextStroke: "2px hsl(var(--foreground))",
            textShadow:
              "3px 3px 0 hsl(var(--foreground) / 0.85), 0 0 24px hsl(330 95% 60% / 0.35)",
            transform: "rotate(-3deg)",
          }}
        >
          REMOVED.
        </motion.h1>
        {/* Paint drips */}
        <motion.span
          aria-hidden
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.55, duration: 0.7, ease: "easeOut" }}
          className="absolute left-[18%] top-[88%] h-3 w-[3px] origin-top rounded-full"
          style={{ background: "hsl(330 95% 60%)" }}
        />
        <motion.span
          aria-hidden
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.7, duration: 0.9, ease: "easeOut" }}
          className="absolute right-[12%] top-[92%] h-5 w-[3px] origin-top rounded-full"
          style={{ background: "hsl(330 95% 60%)" }}
        />
      </div>

      {/* Yellow caution tag */}
      <motion.div
        initial={{ opacity: 0, rotate: -8 }}
        animate={{ opacity: 1, rotate: -4 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-sm border-[1.5px] border-foreground bg-[hsl(48_100%_60%)] px-3 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-foreground"
      >
        ✕ ACCOUNT TERMINATED
      </motion.div>

      {/* Body copy */}
      <div className="space-y-3 text-foreground/80">
        <p className="text-[15px] leading-relaxed">
          이 계정은 커뮤니티 가이드라인 위반으로 인해
          <br />
          <span className="font-semibold text-foreground">my'myon</span> 에서 영구적으로 삭제되었습니다.
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/60">
          This account was permanently removed for violating our community
          guidelines or posting content that does not fit our community.
        </p>

        {reason && (
          <div className="mt-3 rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-left text-[12px] text-foreground/70">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              Reason
            </span>
            <p className="mt-1">{reason}</p>
          </div>
        )}

        <p className="mt-2 break-all font-mono text-[11px] text-foreground/40">{email}</p>
      </div>

      {/* Re-signup CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        onClick={onCreateNew}
        className="group relative mt-2 w-full overflow-hidden rounded-full bg-foreground px-6 py-3.5 font-mono text-[12px] font-bold tracking-[0.2em] text-background transition-all hover:bg-primary hover:text-primary-foreground"
      >
        <span className="relative z-10">CREATE A NEW ACCOUNT →</span>
      </motion.button>

      <button
        onClick={onContact}
        className="text-[12px] font-medium text-foreground/55 underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Appeal this decision
      </button>

      <button
        onClick={onBack}
        className="font-mono text-[10px] font-semibold tracking-[0.22em] text-foreground/40 transition-colors hover:text-foreground/70"
      >
        ← BACK TO SIGN IN
      </button>
    </motion.div>
  );
}
