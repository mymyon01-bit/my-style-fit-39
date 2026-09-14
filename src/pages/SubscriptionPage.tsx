import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Apple, Crown, Check, ChevronLeft, Loader2, Smartphone, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  PurchaseCancelled,
  StorePackage,
  getOfferings,
  purchasePackage,
  restorePurchases,
  syncEntitlement,
  waitForWrapper,
} from "@/lib/billing/revenuecat";
import { useEffect } from "react";

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
    price: "$3.99",
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
    price: "$29.99",
    period: "/ year",
    savings: "Save 37%",
    features: [
      "Everything in Premium",
      "2 months free",
      "Exclusive style reports",
      "VIP support",
    ],
    cta: "Best Value",
  },
];


const SubscriptionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, loading } = useSubscription();
  

  // --- Native in-app purchases (AppBuild wrapper + RevenueCat) ---------------
  const [inApp, setInApp] = useState(false);
  const [packages, setPackages] = useState<StorePackage[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const available = await waitForWrapper();
      if (cancelled) return;
      setInApp(available);
      if (!available) {
        setStoreLoading(false);
        return;
      }
      try {
        const pkgs = await getOfferings();
        if (!cancelled) setPackages(pkgs);
      } catch (e) {
        console.warn("[subscription] getOfferings failed", e);
      } finally {
        if (!cancelled) setStoreLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBuy = async (pkg: StorePackage) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBusy(pkg.identifier);
    try {
      const info = await purchasePackage(pkg);
      const premium = await syncEntitlement(user.id, info);
      if (premium) {
        toast.success("Welcome to Premium! 🎉");
        navigate("/profile");
      } else {
        toast.error("Purchase completed but no active plan was found. Try Restore.");
      }
    } catch (e) {
      if (e instanceof PurchaseCancelled) {
        // user closed the store sheet — stay quiet
      } else {
        console.error("[subscription] purchase failed", e);
        toast.error("Purchase failed. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBusy("restore");
    try {
      const info = await restorePurchases();
      const premium = await syncEntitlement(user.id, info);
      toast[premium ? "success" : "message"](
        premium ? "Your Premium plan is back." : "No previous purchases found.",
      );
    } catch (e) {
      console.error("[subscription] restore failed", e);
      toast.error("Could not restore purchases.");
    } finally {
      setBusy(null);
    }
  };


  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky-header sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/10">
        <div className="flex items-center gap-3 px-5 pb-3 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="text-foreground/75 hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-base font-light text-foreground/85">Subscription</h1>
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
        <p className="mt-3 text-[13px] leading-relaxed text-foreground/70 max-w-xs mx-auto">
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

      {/* Store plans (native app) */}
      {inApp && (
        <div className="px-6 max-w-3xl mx-auto space-y-4">
          {storeLoading && (
            <div className="flex items-center justify-center py-10 text-foreground/60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!storeLoading && packages.length === 0 && (
            <p className="rounded-xl border border-border/20 bg-foreground/[0.02] p-5 text-center text-[12px] text-foreground/70">
              Subscriptions aren't available right now. Please try again later.
            </p>
          )}
          {packages.map((pkg) => (
            <div
              key={pkg.identifier}
              className="rounded-xl border border-accent/25 bg-accent/[0.04] p-5"
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <h3 className="text-[15px] font-medium text-foreground/85">{pkg.title}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-light text-foreground/90">{pkg.priceString}</span>
                    {pkg.period && (
                      <span className="text-[11px] text-foreground/75">{pkg.period}</span>
                    )}
                  </div>
                </div>
                {subscription.isPremium && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-accent/70">
                    Active
                  </span>
                )}
              </div>
              {pkg.description && (
                <p className="mt-3 text-[12px] leading-relaxed text-foreground/70">
                  {pkg.description}
                </p>
              )}
              <button
                onClick={() => handleBuy(pkg)}
                disabled={busy !== null || subscription.isPremium}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent/80 py-3 text-[11px] font-medium tracking-wider text-white transition-all hover:bg-accent disabled:opacity-50"
              >
                {busy === pkg.identifier ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : subscription.isPremium ? (
                  "Current Plan"
                ) : (
                  `Subscribe · ${pkg.priceString}`
                )}
              </button>
            </div>
          ))}

          <button
            onClick={handleRestore}
            disabled={busy !== null}
            className="w-full py-2 text-[11px] tracking-wider text-foreground/70 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {busy === "restore" ? "Restoring…" : "Restore purchases"}
          </button>

          <p className="text-center text-[10px] leading-relaxed text-foreground/60">
            Payment is charged to your App Store / Google Play account. Subscriptions renew
            automatically unless cancelled at least 24 hours before the period ends. Manage or
            cancel anytime in your store account settings.
          </p>
        </div>
      )}

      {/* Plans (web) */}
      <div className={`px-6 max-w-3xl mx-auto space-y-4 ${inApp ? "hidden" : ""}`}>
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
                <div className="absolute -top-2.5 left-5 rounded-full bg-accent/80 px-3 py-0.5 text-[11px] font-medium tracking-wider text-white uppercase">
                  Most Popular
                </div>
              )}
              {plan.savings && (
                <div className="absolute -top-2.5 right-5 rounded-full bg-emerald-500/80 px-3 py-0.5 text-[11px] font-medium tracking-wider text-foreground uppercase">
                  {plan.savings}
                </div>
              )}

              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="text-[15px] font-medium text-foreground/85">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-light text-foreground/90">{plan.price}</span>
                    <span className="text-[11px] text-foreground/75">{plan.period}</span>
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
                  <li key={f} className="flex items-start gap-2.5 text-[12px] text-foreground/75">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-accent/60 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div
                className={`w-full rounded-lg py-3 text-center text-[11px] font-medium tracking-wider ${
                  isCurrent
                    ? "bg-foreground/[0.05] text-foreground/70"
                    : "bg-foreground/[0.04] text-foreground/65"
                }`}
              >
                {isCurrent
                  ? "Current Plan"
                  : plan.id === "free"
                  ? "Included for everyone"
                  : "Subscribe in the MYMYON app"}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* How to subscribe (web only) */}
      {!inApp && (
        <div className="px-6 pt-10 max-w-3xl mx-auto">
          <div className="rounded-xl border border-accent/25 bg-accent/[0.04] p-6">
            <h3 className="font-display text-lg font-light text-foreground/90">
              How to get Premium
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-foreground/70">
              Premium is purchased inside the MYMYON app, through the App Store or Google Play.
              Your plan is tied to your MYMYON account, so it unlocks everywhere you sign in —
              including this website.
            </p>

            <ol className="mt-5 space-y-3">
              {[
                "Install MYMYON from the App Store or Google Play.",
                "Sign in with the same account you use here.",
                "Open Profile → Subscription and choose a plan.",
                "Confirm with Face ID / your store password — that's it.",
              ].map((step, i) => (
                <li key={step} className="flex gap-3 text-[12px] text-foreground/75">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-medium text-accent/80">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 rounded-lg border border-border/20 bg-foreground/[0.02] px-4 py-3 text-[11px] text-foreground/75">
                <Apple className="h-4 w-4 text-foreground/60" />
                App Store · billed to your Apple ID
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border/20 bg-foreground/[0.02] px-4 py-3 text-[11px] text-foreground/75">
                <Smartphone className="h-4 w-4 text-foreground/60" />
                Google Play · billed to your Play account
              </div>
            </div>

            <p className="mt-5 text-[10px] leading-relaxed text-foreground/60">
              Subscriptions renew automatically unless cancelled at least 24 hours before the
              current period ends. Manage or cancel anytime in your App Store or Google Play
              account settings. Already subscribed on another device? Open the app and tap
              “Restore purchases”.
            </p>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="px-6 pt-10 max-w-3xl mx-auto">
        <h3 className="text-[10px] font-medium tracking-[0.2em] text-foreground/75 uppercase mb-4">
          Frequently Asked
        </h3>
        {[
          { q: "Can I cancel anytime?", a: "Yes, cancel anytime from your profile settings. No questions asked." },
          { q: "Is there a free trial?", a: "New users get a 3-month free trial of Premium features automatically." },
          {
            q: "How does payment work?",
            a: inApp
              ? "Payments are handled securely by the App Store or Google Play and billed to your store account."
              : "Subscriptions are purchased in the MYMYON app on iOS or Android.",
          },
        ].map((faq) => (
          <div key={faq.q} className="py-3 border-b border-border/10">
            <p className="text-[12px] font-medium text-foreground/70">{faq.q}</p>
            <p className="mt-1 text-[11px] text-foreground/75">{faq.a}</p>
          </div>
        ))}
      </div>

    </div>
  );
};

export default SubscriptionPage;
