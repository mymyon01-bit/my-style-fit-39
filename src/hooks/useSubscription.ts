import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Subscription {
  plan: "free" | "premium_trial" | "premium";
  status: "active" | "expired" | "cancelled";
  trialEndDate: Date | null;
  daysRemaining: number | null;
  isPremium: boolean;
}

const FREE_SUB: Subscription = {
  plan: "free",
  status: "active",
  trialEndDate: null,
  daysRemaining: null,
  isPremium: false,
};

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription>(FREE_SUB);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(FREE_SUB);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) {
        setSubscription(FREE_SUB);
        setLoading(false);
        return;
      }

      const trialEnd = data.trial_end_date ? new Date(data.trial_end_date) : null;
      const now = new Date();
      const isTrialExpired = trialEnd && trialEnd < now;
      const plan = data.plan as Subscription["plan"];
      const isPremium = (plan === "premium_trial" || plan === "premium") && 
        data.status === "active" && !isTrialExpired;

      const daysRemaining = trialEnd && !isTrialExpired
        ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      setSubscription({
        plan: isTrialExpired && plan === "premium_trial" ? "free" : plan,
        status: isTrialExpired ? "expired" : (data.status as Subscription["status"]),
        trialEndDate: trialEnd,
        daysRemaining,
        isPremium,
      });
      setLoading(false);
    };

    load();
  }, [user]);

  return { subscription, loading };
}
