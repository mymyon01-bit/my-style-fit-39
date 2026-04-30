/**
 * WelcomeTour — full-screen 3-slide intro for first-time visitors.
 *
 * Layered editorial layout: full-bleed hero illustration with a dark
 * gradient scrim, MYMYON brandmark in the top corner, OOTD graffiti
 * sticker on the OOTD slide, kicker + display title + body, and a
 * "Don't show again" option in the footer alongside Skip / Next.
 *
 * Gated by localStorage so it appears once per device. Layered above
 * everything except splash + permissions sheet.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Brandmark from "@/components/Brandmark";
import discoverImg from "@/assets/tour-discover.jpg";
import fitImg from "@/assets/tour-fit.jpg";
import ootdImg from "@/assets/tour-ootd.jpg";
import ootdSticker from "@/assets/ootd-sticker.png";

const STORAGE_KEY = "wardrobe:welcome-tour:v2";

const WelcomeTour = () => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [neverShow, setNeverShow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Show after splash so we don't fight for the first frame.
    const t = setTimeout(() => setOpen(true), 1700);
    return () => clearTimeout(t);
  }, []);

  const slides = useMemo(
    () => [
      {
        image: discoverImg,
        kicker: t("tourKicker1"),
        title: t("tourTitle1"),
        body: t("tourBody1"),
        scrim: "from-background via-background/85 to-background/30",
      },
      {
        image: fitImg,
        kicker: t("tourKicker2"),
        title: t("tourTitle2"),
        body: t("tourBody2"),
        scrim: "from-background via-background/80 to-background/20",
      },
      {
        image: ootdImg,
        kicker: t("tourKicker3"),
        title: t("tourTitle3"),
        body: t("tourBody3"),
        scrim: "from-background via-background/80 to-background/20",
        showOotdSticker: true,
      },
    ],
    [t],
  );

  const close = () => {
    if (neverShow) localStorage.setItem(STORAGE_KEY, "completed");
    setOpen(false);
  };

  const next = () => {
    if (index >= slides.length - 1) close();
    else setIndex((i) => i + 1);
  };

  if (!open) return null;
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "completed");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="tour-backdrop"
        className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={dismiss}
      />

      {/* Centered popup card */}
      <motion.div
        key="tour-card"
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-3xl border border-foreground/10 bg-card shadow-[0_30px_80px_-20px_hsl(var(--accent)/0.45)]"
          initial={{ scale: 0.92, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        >
          {/* Hero image */}
          <div className="relative h-56 w-full overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.img
                key={`bg-${index}`}
                src={slide.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
              <Brandmark variant="inline" size={18} />
              <button
                onClick={dismiss}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/50"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {slide.showOotdSticker && (
              <motion.img
                src={ootdSticker}
                alt="OOTD"
                className="absolute bottom-3 right-3 h-12 w-auto -rotate-6 drop-shadow-[0_4px_12px_rgba(255,61,154,0.55)]"
                initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: -6 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
              />
            )}
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`txt-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-accent">
                  {slide.kicker}
                </p>
                <h2 className="mt-2 font-display text-[24px] font-medium italic leading-[1.1] tracking-tight text-foreground">
                  {slide.title}
                </h2>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-foreground/70">
                  {slide.body}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === index ? "w-5 bg-accent" : "w-1.5 bg-foreground/25"
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={dismiss}
                className="flex-1 rounded-full border border-foreground/15 px-4 py-2.5 text-[10px] font-semibold tracking-[0.2em] text-foreground/70 transition-colors hover:bg-foreground/5"
              >
                {t("tourSkip")}
              </button>
              <button
                onClick={next}
                className="group flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[10px] font-bold tracking-[0.2em] text-accent-foreground transition-opacity hover:opacity-90"
              >
                {isLast ? t("tourGetStarted") : t("tourNext")}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>

            {/* Don't show again */}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-[10.5px] tracking-[0.1em] text-foreground/55 hover:text-foreground/85">
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border transition-colors ${
                  neverShow
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-foreground/30 bg-transparent"
                }`}
                aria-hidden
              >
                {neverShow ? (
                  <svg viewBox="0 0 12 12" className="h-2 w-2">
                    <path d="M2 6.2 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={neverShow}
                onChange={(e) => setNeverShow(e.target.checked)}
              />
              {t("tourDontShowAgain")}
            </label>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeTour;
