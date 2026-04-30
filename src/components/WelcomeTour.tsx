/**
 * WelcomeTour — full-screen 3-slide intro for first-time visitors.
 *
 * Shown on web AND native, gated by localStorage so it appears exactly
 * once per device. Each slide explains one of our three pillars
 * (Discover / Fit / OOTD) with a clear icon, headline, body and a
 * Skip / Next / Get Started action row. Layered above everything except
 * the splash + permissions sheet.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Ruler, Camera, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "wardrobe:welcome-tour:v1";

const WelcomeTour = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Show after splash (~1.6s) so we don't fight for the first frame.
    const t = setTimeout(() => setOpen(true), 1700);
    return () => clearTimeout(t);
  }, []);

  const slides = useMemo(
    () => [
      {
        icon: Compass,
        kicker: t("tourKicker1"),
        title: t("tourTitle1"),
        body: t("tourBody1"),
        accent: "from-accent/30 via-accent/10 to-transparent",
      },
      {
        icon: Ruler,
        kicker: t("tourKicker2"),
        title: t("tourTitle2"),
        body: t("tourBody2"),
        accent: "from-fuchsia-500/25 via-accent/10 to-transparent",
      },
      {
        icon: Camera,
        kicker: t("tourKicker3"),
        title: t("tourTitle3"),
        body: t("tourBody3"),
        accent: "from-amber-400/25 via-accent/10 to-transparent",
      },
    ],
    [t],
  );

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "completed");
    setOpen(false);
  };

  const next = () => {
    if (index >= slides.length - 1) close();
    else setIndex((i) => i + 1);
  };

  if (!open) return null;
  const slide = slides[index];
  const Icon = slide.icon;
  const isLast = index === slides.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        className="fixed inset-0 z-[70] flex flex-col bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Layered accent gradient — refreshes per slide */}
        <motion.div
          key={`bg-${index}`}
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${slide.accent}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Top bar — Skip + dots */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top,0px),20px)] sm:px-8">
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"
                }`}
              />
            ))}
          </div>
          <button
            onClick={close}
            className="text-[10px] font-semibold tracking-[0.25em] text-foreground/55 transition-colors hover:text-foreground"
          >
            {t("tourSkip")}
          </button>
        </div>

        {/* Body — single centered column */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full max-w-sm flex-col items-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-foreground/10 bg-foreground/[0.04] text-accent shadow-[0_12px_40px_-12px_hsl(var(--accent)/0.35)] backdrop-blur-sm">
                <Icon className="h-9 w-9" strokeWidth={1.5} />
              </div>

              <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.32em] text-accent">
                {slide.kicker}
              </p>

              <h2 className="mt-3 font-display text-[34px] font-medium italic leading-[1.05] tracking-tight text-foreground sm:text-[40px]">
                {slide.title}
              </h2>

              <p className="mt-5 max-w-[320px] text-[14px] leading-relaxed text-foreground/70">
                {slide.body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer — Next / Get Started */}
        <div className="relative z-10 px-6 pb-[max(env(safe-area-inset-bottom,0px),28px)] pt-6 sm:px-8">
          <button
            onClick={next}
            className="group mx-auto flex w-full max-w-sm items-center justify-center gap-3 rounded-full bg-accent px-7 py-4 text-[12px] font-bold tracking-[0.25em] text-accent-foreground transition-opacity hover:opacity-90"
          >
            {isLast ? t("tourGetStarted") : t("tourNext")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeTour;
