import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Crown, Check, ChevronLeft, CreditCard, Loader2, Shield, Sparkles, Star, Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Basic style recommendations",
      "Browse Discover feed",
      "Save up to 20 items",
      "1 OOTD post per week",
    ],
    cta: "Current Plan",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$9.99",
    period: "/ month",
    features: [
      "AI daily outfit picks",
      "Weekly style plans",
      "Unlimited saves & folders",
      "Unlimited OOTD posts",
      "Advanced body scan",
      "Priority recommendations",
      "Early access to new features",
    ],
    cta: "Upgrade to Premium",
    popular: true,
  },
  {
    id: "premium_yearly",
    name: "Premium Yearly",
    price: "$79.99",
    period: "/ year",
    savings: "Save 33%",
    features: [
      "Everything in Premium",
      "2 months free",
      "Exclusive style reports",
      "VIP support",
    ],
    cta: "Best Value",
  },
];

const FakePaymentModal = ({
  plan,
  onClose,
  onSuccess,
}: {
  plan: (typeof plans)[number];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);

  const formatCard = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };

  const handleSubmit = async () => {
    if (cardNumber.replace(/\s/g, "").length < 16) {
      toast.error("Please enter a valid card number");
      return;
    }
    if (expiry.length < 5) {
      toast.error("Please enter a valid expiry date");
      return;
    }
    if (cvc.length < 3) {
      toast.error("Please enter a valid CVC");
      return;
    }
    setProcessing(true);
    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 2000));
    setProcessing(false);
    onSuccess();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card border border-border/30 p-6 pb-10 sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-light text-foreground/90">
            Payment Details
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] text-foreground/40">
            <Shield className="h-3 w-3" />
            Secure (MVP Demo)
          </div>
        </div>

        <div className="mb-5 rounded-lg bg-foreground/[0.03] border border-border/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-foreground/60">{plan.name}</span>
            <span className="text-[14px] font-medium text-foreground/90">
              {plan.price} {plan.period}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
              Cardholder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="mt-1.5 w-full rounded-lg bg-foreground/[0.04] border border-border/20 px-4 py-3 text-[13px] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
              Card Number
            </label>
            <div className="relative mt-1.5">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/25" />
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                placeholder="4242 4242 4242 4242"
                className="w-full rounded-lg bg-foreground/[0.04] border border-border/20 pl-10 pr-4 py-3 text-[13px] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent/30 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                Expiry
              </label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                className="mt-1.5 w-full rounded-lg bg-foreground/[0.04] border border-border/20 px-4 py-3 text-[13px] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent/30 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider">
                CVC
              </label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                className="mt-1.5 w-full rounded-lg bg-foreground/[0.04] border border-border/20 px-4 py-3 text-[13px] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent/30 transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={processing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/80 py-3.5 text-[12px] font-medium tracking-wider text-white transition-all hover:bg-accent disabled:opacity-50"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>Pay {plan.price}</>
          )}
        </button>

        <p className="mt-3 text-center text-[9px] text-foreground/30">
          This is a demo payment. No real charges will be made.
        </p>
      </motion.div>
    </motion.div>
  );
};

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, loading } = useSubscription();
  const [showPayment, setShowPayment] = useState<(typeof plans)[number] | null>(null);

  const handleSelectPlan = (plan: (typeof plans)[number]) => {
    if (plan.id === "free") return;
    if (!user) {
      navigate("/auth");
      return;
    }
    setShowPayment(plan);
  };

  const handlePaymentSuccess = async () => {
    if (!user) return;
    // Update subscription in DB
    await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: "premium" as any,
        status: "active" as any,
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      { onConflict: "user_id" }
    );
    setShowPayment(null);
    toast.success("Welcome to Premium! 🎉");
    navigate("/profile");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/10">
        <div className="flex items-center gap-3 px-6 py-4 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-foreground/60 hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-light text-foreground/85">Subscription</h1>
        </div>
      </div>

      {/* Hero */}
      <div className="px-6 pt-10 pb-8 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-accent/10 mb-5">
          <Crown className="h-8 w-8 text-accent/70" />
        </div>
        <h2 className="font-display text-2xl font-light text-foreground/90">
          Unlock Your Full Style
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-foreground/50 max-w-xs mx-auto">
          Get AI-powered daily outfits, unlimited saves, and advanced body scan features.
        </p>
        {subscription.isPremium && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-1.5 text-[11px] text-accent/80">
            <Sparkles className="h-3 w-3" />
            You're on Premium
            {subscription.daysRemaining && ` · ${subscription.daysRemaining} days left`}
          </div>
        )}
      </div>

      {/* Plans */}
      <div className="px-6 max-w-3xl mx-auto space-y-4">
        {plans.map((plan) => {
          const isCurrent =
            (plan.id === "free" && !subscription.isPremium) ||
            (plan.id === "premium" && subscription.isPremium);

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative rounded-xl border p-5 transition-all ${
                plan.popular
                  ? "border-accent/30 bg-accent/[0.04]"
                  : "border-border/20 bg-foreground/[0.02]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-5 rounded-full bg-accent/80 px-3 py-0.5 text-[9px] font-medium tracking-wider text-white uppercase">
                  Most Popular
                </div>
              )}
              {plan.savings && (
                <div className="absolute -top-2.5 right-5 rounded-full bg-emerald-500/80 px-3 py-0.5 text-[9px] font-medium tracking-wider text-foreground uppercase">
                  {plan.savings}
                </div>
              )}

              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="text-[15px] font-medium text-foreground/85">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-light text-foreground/90">{plan.price}</span>
                    <span className="text-[11px] text-foreground/40">{plan.period}</span>
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-[10px] text-accent/70 font-medium uppercase tracking-wider">
                    Current
                  </span>
                )}
              </div>

              <ul className="space-y-2.5 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[12px] text-foreground/60">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-accent/60 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={isCurrent || plan.id === "free"}
                className={`w-full rounded-lg py-3 text-[11px] font-medium tracking-wider transition-all ${
                  plan.popular && !isCurrent
                    ? "bg-accent/80 text-white hover:bg-accent"
                    : isCurrent
                    ? "bg-foreground/[0.05] text-foreground/30 cursor-default"
                    : "bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/10"
                }`}
              >
                {isCurrent ? "Current Plan" : plan.cta}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="px-6 pt-10 max-w-3xl mx-auto">
        <h3 className="text-[10px] font-medium tracking-[0.2em] text-foreground/40 uppercase mb-4">
          Frequently Asked
        </h3>
        {[
          { q: "Can I cancel anytime?", a: "Yes, cancel anytime from your profile settings. No questions asked." },
          { q: "Is there a free trial?", a: "New users get a 3-month free trial of Premium features automatically." },
          { q: "How does payment work?", a: "This is an MVP demo. No real payments are processed." },
        ].map((faq) => (
          <div key={faq.q} className="py-3 border-b border-border/10">
            <p className="text-[12px] font-medium text-foreground/70">{faq.q}</p>
            <p className="mt-1 text-[11px] text-foreground/40">{faq.a}</p>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && (
          <FakePaymentModal
            plan={showPayment}
            onClose={() => setShowPayment(null)}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionPage;
