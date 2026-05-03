import { useState, forwardRef } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { Lock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthGateProps {
  children: React.ReactNode;
  action?: string; // e.g. "save items", "give stars", "use AI Stylist"
}

/**
 * Wraps interactive elements. If user is guest, shows sign-up prompt instead of performing the action.
 * Usage: <AuthGate action="save items"><button onClick={...}>Save</button></AuthGate>
 */
export const AuthGate = forwardRef<HTMLDivElement, AuthGateProps>(({ children, action }, ref) => {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const navigate = useNavigate();

  if (user) return <div ref={ref}>{children}</div>;

  return (
    <>
      <div ref={ref} onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowPrompt(true); }} className="cursor-pointer">
        {children}
      </div>
      <AnimatePresence>
        {showPrompt && (
          <SignUpPrompt
            action={action}
            onClose={() => setShowPrompt(false)}
            onSignUp={() => navigate("/auth")}
          />
        )}
      </AnimatePresence>
    </>
  );
});

AuthGate.displayName = "AuthGate";

/**
 * Full-screen overlay prompt to sign up
 */
export const SignUpPrompt = ({
  action,
  onClose,
  onSignUp,
}: {
  action?: string;
  onClose: () => void;
  onSignUp: () => void;
}) => {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-card border border-border p-6 pb-10 shadow-elevated sm:my-6 sm:max-h-[90vh] sm:overflow-y-auto"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <Lock className="h-6 w-6 text-accent" />
          </div>
          <h3 className="mt-4 font-display text-xl font-bold text-foreground">
            Join WARDROBE
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-[280px]">
            {action
              ? `Sign up to ${action} and unlock your personalized AI stylist experience.`
              : "Create a free account to unlock all features and get personalized recommendations."}
          </p>

          <button
            onClick={onSignUp}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign Up Free
          </button>
          <button
            onClick={onSignUp}
            className="mt-2 w-full rounded-xl border border-border py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Already have an account? Sign In
          </button>
          <button
            onClick={onClose}
            className="mt-3 text-xs text-muted-foreground"
          >
            Continue browsing
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
