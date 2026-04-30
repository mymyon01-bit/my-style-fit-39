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

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        className="fixed inset-0 z-[70] flex flex-col bg-background overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Full-bleed hero illustration */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${index}`}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src={slide.image}
              alt=""
              className="h-full w-full object-cover object-center"
              draggable={false}
            />
            {/* Bottom-up scrim for legibility */}
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${slide.scrim}`}
            />
            {/* Subtle top scrim so brand bar reads */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/85 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Top bar — Brandmark + dots + Skip */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-[max(env(safe-area-inset-top,0px),20px)] sm:px-8">
          <Brandmark variant="inline" size={22} />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/30"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                localStorage.setItem(STORAGE_KEY, "completed");
                setOpen(false);
              }}
              className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70 transition-colors hover:text-foreground"
            >
              {t("tourSkip")}
            </button>
          </div>
        </div>

        {/* Spacer to let hero breathe in upper area */}
        <div className="relative z-10 flex-1" />

        {/* Bottom content card */}
        <div className="relative z-10 px-6 pb-[max(env(safe-area-inset-bottom,0px),24px)] sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`txt-${index}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-md"
            >
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-accent">
                  {slide.kicker}
                </p>
                {slide.showOotdSticker && (
                  <motion.img
                    src={ootdSticker}
                    alt="OOTD"
                    className="h-7 w-auto -rotate-6 drop-shadow-[0_4px_10px_rgba(255,61,154,0.45)]"
                    initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: -6 }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 16,
                      delay: 0.15,
                    }}
                  />
                )}
              </div>

              <h2 className="mt-3 font-display text-[34px] font-medium italic leading-[1.05] tracking-tight text-foreground sm:text-[40px]">
                {slide.title}
              </h2>

              <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-foreground/75">
                {slide.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* CTA */}
          <button
            onClick={next}
            className="group mx-auto mt-7 flex w-full max-w-md items-center justify-center gap-3 rounded-full bg-accent px-7 py-4 text-[12px] font-bold tracking-[0.25em] text-accent-foreground shadow-[0_18px_50px_-12px_hsl(var(--accent)/0.55)] transition-opacity hover:opacity-90"
          >
            {isLast ? t("tourGetStarted") : t("tourNext")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          {/* Don't show again */}
          <label className="mx-auto mt-4 flex w-full max-w-md cursor-pointer items-center justify-center gap-2.5 text-[11px] tracking-[0.12em] text-foreground/60 hover:text-foreground/85">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
                neverShow
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-foreground/30 bg-transparent"
              }`}
              aria-hidden
            >
              {neverShow ? (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                  <path
                    d="M2 6.2 L5 9 L10 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
    </AnimatePresence>
  );
};

export default WelcomeTour;
