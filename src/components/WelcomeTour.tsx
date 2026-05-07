/**
 * WelcomeTour — graffiti-style first-launch intro.
 *
 * 3 slides: PRODUCTS / FIT / #OOTD with shortcut button per slide.
 * Mobile: full-screen, Tinder-like horizontal swipe (drag) to paginate.
 * Desktop: centered card, click NEXT / dots.
 *
 * Auto-shows once (localStorage gate). Re-open any time via
 *   window.dispatchEvent(new Event("mymyon:open-tour"))
 * which is wired to the (i) Info button next to STYLE ME on the home page.
 *
 * "Don't show again" persists dismissal until manually reopened.
 *
 * Graffiti aesthetic:
 *  - Spray-paint noise + halftone dot grid backdrop
 *  - Hand-tagged display title with rough underline
 *  - Bold uppercase mono kicker on tape strip
 *  - Pink + black + paper-white palette, rotated stickers, drips
 */
import { useEffect, useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import discoverImg from "@/assets/tour-discover.jpg";
import fitImg from "@/assets/tour-fit.jpg";
import ootdImg from "@/assets/tour-ootd.jpg";

const STORAGE_KEY = "wardrobe:welcome-tour:v5-graffiti";
const SWIPE_THRESHOLD = 70;

type Slide = {
  image: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
  /** Hex accent stripe color for tape + tag */
  tape: string;
  rotate: number;
};

const WelcomeTour = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [neverShow, setNeverShow] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      const tm = setTimeout(() => setOpen(true), 1700);
      return () => clearTimeout(tm);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIndex(0);
      setDirection(1);
      setNeverShow(false);
      setOpen(true);
    };
    window.addEventListener("mymyon:open-tour", handler);
    return () => window.removeEventListener("mymyon:open-tour", handler);
  }, []);

  const slides: Slide[] = useMemo(
    () => [
      {
        image: ootdImg,
        kicker: t("tourKicker3"),
        title: t("tourTitle3"),
        body: t("tourBody3"),
        href: "/ootd",
        tape: "#FF3D9A",
        rotate: -0.6,
      },
      {
        image: discoverImg,
        kicker: t("tourKicker1"),
        title: t("tourTitle1"),
        body: t("tourBody1"),
        href: "/discover",
        tape: "#FF3D9A",
        rotate: -1.2,
      },
      {
        image: fitImg,
        kicker: t("tourKicker2"),
        title: t("tourTitle2"),
        body: t("tourBody2"),
        href: "/fit",
        tape: "#FFD400",
        rotate: 0.8,
      },
    ],
    [t],
  );

  const persistDismiss = () => {
    if (neverShow) localStorage.setItem(STORAGE_KEY, "completed");
  };
  const dismiss = () => {
    persistDismiss();
    setOpen(false);
  };
  const goShortcut = () => {
    const href = slides[index].href;
    persistDismiss();
    setOpen(false);
    if (href) navigate(href);
  };
  const goTo = (i: number) => {
    setDirection(i > index ? 1 : -1);
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  };
  const next = () => {
    if (index >= slides.length - 1) dismiss();
    else goTo(index + 1);
  };
  const prev = () => {
    if (index > 0) goTo(index - 1);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -500) next();
    else if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 500) prev();
  };

  // X→rotate/opacity feedback while dragging (Tinder feel) — must run every render
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-200, 0, 200], [-8, 0, 8]);
  const leftHint = useTransform(dragX, [-160, -20, 0], [1, 0, 0]);
  const rightHint = useTransform(dragX, [0, 20, 160], [0, 0, 1]);

  if (!open) return null;
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <AnimatePresence>
      {/* Backdrop — paper + halftone */}
      <motion.div
        key="tour-backdrop"
        className="fixed inset-0 z-[70] bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={dismiss}
      >
        {/* halftone dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(hsl(0 0% 100% / 0.7) 1px, transparent 1.4px)",
            backgroundSize: "14px 14px",
          }}
        />
        {/* spray noise */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22] mix-blend-screen">
          <filter id="tour-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 0.24  0 0 0 0 0.6  0 0 0 0.55 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#tour-noise)" />
        </svg>
        {/* pink halo */}
        <div
          className="pointer-events-none absolute -left-1/4 top-1/3 h-[60vmin] w-[60vmin] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(255,61,154,0.55), transparent)" }}
        />
        <div
          className="pointer-events-none absolute -right-1/4 -bottom-1/4 h-[60vmin] w-[60vmin] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(255,212,0,0.35), transparent)" }}
        />
      </motion.div>

      {/* Card stage */}
      <motion.div
        key="tour-stage"
        className="fixed inset-0 z-[71] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="pointer-events-auto relative flex h-auto w-full max-w-[340px] sm:w-[420px] sm:max-w-[92vw] flex-col overflow-hidden rounded-[24px] bg-[#f4ece0] text-[#0a0a0a] sm:rounded-[28px]"
          style={{
            x: dragX,
            rotate: cardRotate,
            boxShadow: "0 30px 80px -20px rgba(255,61,154,0.55), 14px 14px 0 0 #0a0a0a",
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.35}
          onDragEnd={onDragEnd}
          initial={{ scale: 0.94, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          {/* Swipe direction hints (Tinder vibe) */}
          <motion.div
            style={{ opacity: leftHint }}
            className="pointer-events-none absolute top-6 right-6 z-30 -rotate-12 rounded-md border-[3px] border-[#0a0a0a] bg-[#FFD400] px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-[#0a0a0a]"
          >
            {t("tourNext")} →
          </motion.div>
          <motion.div
            style={{ opacity: rightHint }}
            className="pointer-events-none absolute top-6 left-6 z-30 rotate-12 rounded-md border-[3px] border-[#0a0a0a] bg-[#FF3D9A] px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-white"
          >
            ← BACK
          </motion.div>

          {/* Top bar */}
          <div className="relative z-20 flex items-center justify-between px-4 pt-3 pb-2">
            <span className="font-display text-[15px] italic font-semibold lowercase tracking-tight text-[#0a0a0a]">
              my'myon
            </span>
            <button
              onClick={dismiss}
              className="flex h-8 w-8 items-center justify-center rounded-full border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] transition-transform hover:scale-105 active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Hero image — graffiti tag overlay */}
          <div className="relative mx-4 overflow-hidden rounded-2xl border-[3px] border-[#0a0a0a]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.img
                key={`bg-${index}`}
                src={slide.image}
                alt=""
                className="block h-36 sm:h-56 w-full object-cover"
                draggable={false}
                initial={{ opacity: 0, x: direction * 60, scale: 1.05 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </AnimatePresence>
            {/* taped kicker — diagonal */}
            <div
              className="absolute -left-3 top-3 select-none px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.28em] shadow-[3px_3px_0_#0a0a0a]"
              style={{
                background: slide.tape,
                color: slide.tape === "#FFD400" ? "#0a0a0a" : "#fff",
                transform: `rotate(${slide.rotate - 3}deg)`,
              }}
            >
              {slide.kicker}
            </div>
            {/* paint drips */}
            <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full">
              <path
                d="M0 0 L40 0 L42 18 L48 0 L120 0 L122 14 L128 0 L240 0 L242 22 L250 0 L380 0 L382 12 L388 0 L500 0 L500 24 L0 24 Z"
                fill={slide.tape}
              />
            </svg>
          </div>

          {/* Body */}
          <div className="relative flex-1 px-6 pb-4 pt-5">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`txt-${index}`}
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={{ duration: 0.28 }}
              >
                <h2
                  className="font-display text-[20px] sm:text-[26px] font-bold italic leading-[1.05] tracking-tight text-[#0a0a0a]"
                  style={{ textShadow: "2px 2px 0 rgba(255,61,154,0.35)" }}
                >
                  {slide.title}
                </h2>
                {/* hand-tag underline */}
                <svg className="-mt-1 h-2 w-24 sm:w-28" viewBox="0 0 120 8" preserveAspectRatio="none">
                  <path d="M2 5 C 22 1, 50 7, 78 3 S 116 6, 118 4" stroke="#FF3D9A" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>

                <p className="mt-2 sm:mt-3 text-[11.5px] sm:text-[13px] leading-relaxed text-[#0a0a0a]/75">
                  {slide.body}
                </p>

                <button
                  onClick={goShortcut}
                  className="group mt-4 inline-flex items-center gap-2 rounded-full border-[2.5px] border-[#0a0a0a] bg-white px-3.5 py-1.5 font-mono text-[10.5px] font-black uppercase tracking-[0.22em] text-[#0a0a0a] shadow-[3px_3px_0_#0a0a0a] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  {t("tourGo")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer / dots / actions */}
          <div className="relative z-10 px-5 pb-4 pt-2">
            <div className="mb-4 flex items-center justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2 rounded-full border-[1.5px] border-[#0a0a0a] transition-all ${
                    i === index ? "w-7 bg-[#FF3D9A]" : "w-2 bg-white"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={dismiss}
                className="flex-1 rounded-full border-[2.5px] border-[#0a0a0a] bg-white px-4 py-3 font-mono text-[11px] font-black uppercase tracking-[0.22em] text-[#0a0a0a] transition-transform active:scale-95"
              >
                {t("tourSkip")}
              </button>
              <button
                onClick={next}
                className="group flex flex-[1.5] items-center justify-center gap-2 rounded-full border-[2.5px] border-[#0a0a0a] bg-[#FF3D9A] px-4 py-3 font-mono text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-[4px_4px_0_#0a0a0a] transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              >
                {isLast ? t("tourGetStarted") : t("tourNext")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>

            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-[10.5px] tracking-[0.1em] text-[#0a0a0a]/70 hover:text-[#0a0a0a]">
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border-[1.5px] transition-colors ${
                  neverShow
                    ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                    : "border-[#0a0a0a]/40 bg-transparent"
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

            {/* swipe hint — mobile only */}
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-[#0a0a0a]/40 sm:hidden">
              ← swipe →
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeTour;
