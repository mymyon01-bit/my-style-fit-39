import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "wardrobe_daily_notice";

const shouldShow = (): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const { dismissed, count = 0, lastDate } = JSON.parse(raw);
    if (dismissed && count >= 3) return false; // permanently hidden after 3 dismissals
    const today = new Date().toISOString().split("T")[0];
    if (lastDate === today) return false; // once per day
    return true;
  } catch { return true; }
};

const recordDismiss = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw ? JSON.parse(raw) : { count: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      dismissed: true,
      count: (prev.count || 0) + 1,
      lastDate: new Date().toISOString().split("T")[0],
    }));
  } catch {}
};

const recordView = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
      lastDate: new Date().toISOString().split("T")[0],
    }));
  } catch {}
};

const MESSAGES = [
  "Today's picks are ready for you",
  "Your daily style recommendations are available",
  "See what fits your style today",
];

const DailyPicksNotice = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);

  useEffect(() => {
    if (!shouldShow()) return;

    // Check if user has strong activity — hide for power users
    if (user) {
      supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .then(({ count }) => {
          if ((count ?? 0) > 30) {
            setHasActivity(true);
            return;
          }
          setVisible(true);
          recordView();
        });
    } else {
      // Guest user — show after short delay
      const t = setTimeout(() => { setVisible(true); recordView(); }, 2000);
      return () => clearTimeout(t);
    }
  }, [user]);

  const dismiss = () => {
    setVisible(false);
    recordDismiss();
  };

  const handleAction = () => {
    dismiss();
    if (!user) {
      navigate("/auth");
    } else if (subscription.isPremium) {
      // Scroll to daily picks on profile or navigate
      navigate("/profile");
    } else {
      navigate("/profile");
    }
  };

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  if (hasActivity) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed left-0 right-0 top-0 z-50"
        >
          <div className="relative flex items-center justify-between gap-3 overflow-hidden bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-yellow-900/70 px-4 py-2.5 backdrop-blur-md md:px-6">
            {/* shimmer sweep */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-amber-300/10 to-transparent" />

            <div className="relative flex items-center gap-2.5 min-w-0">
              <Sparkles className="h-3 w-3 shrink-0 text-amber-400/90" />
              <p className="truncate text-[11px] font-medium text-amber-100/90 md:text-[12px]">
                {msg}
              </p>
            </div>
            <div className="relative flex items-center gap-2 shrink-0">
              <button
                onClick={handleAction}
                className="rounded-md bg-amber-400/20 px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-amber-300 transition-colors hover:bg-amber-400/30 border border-amber-400/20"
              >
                VIEW
              </button>
              <button
                onClick={dismiss}
                className="flex h-5 w-5 items-center justify-center rounded-full text-amber-200/40 transition-colors hover:text-amber-100/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DailyPicksNotice;
