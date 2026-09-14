/**
 * WelcomeTour — first-launch intro, MYMYON editorial style.
 *
 * 3 slides: #OOTD / DISCOVER / FIT with shortcut button per slide.
 * Mobile: full-screen, Tinder-like horizontal swipe (drag) to paginate.
 * Desktop: centered card, click NEXT / dots.
 *
 * Auto-shows once (localStorage gate). Re-open any time via
 *   window.dispatchEvent(new Event("mymyon:open-tour"))
 *
 * "Don't show again" persists dismissal until manually reopened.
 *
 * Brand aesthetic:
 *  - Deep navy backdrop with soft gold halo
 *  - Playfair Display italic headline with gold underline
 *  - Gold gradient accents, rose-gold sheen, quiet luxury
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

const STORAGE_KEY = "wardrobe:welcome-tour:v6-editorial";
const SWIPE_THRESHOLD = 70;

const GOLD = "#d9b36a";
const GOLD_SOFT = "#e8cf9a";
const NAVY = "#0d1a2d";
const NAVY_DEEP = "#0a1424";

type Slide = {
  image: string;
  kicker: string;
  title: string;
  body: string;
  href: string;
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
      },
      {
        image: discoverImg,
        kicker: t("tourKicker1"),
        title: t("tourTitle1"),
        body: t("tourBody1"),
        href: "/discover",
      },
      {
        image: fitImg,
        kicker: t("tourKicker2"),
        title: t("tourTitle2"),
        body: t("tourBody2"),
        href: "/fit",
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
  const cardRotate = useTransform(dragX, [-200, 0, 200], [-4, 0, 4]);
  const leftHint = useTransform(dragX, [-160, -20, 0], [1, 0, 0]);
  const rightHint = useTransform(dragX, [0, 20, 160], [0, 0, 1]);

  if (!open) return null;
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <AnimatePresence>
      {/* Backdrop — deep navy + gold halo */}
      <motion.div
        key="tour-backdrop"
        className="fixed inset-0 z-[70]"
        style={{
          background: `radial-gradient(120% 100% at 50% 0%, #12233d 0%, ${NAVY_DEEP} 60%, #060d18 100%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={dismiss}
      >
        {/* fine gold grain */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.10] mix-blend-screen">
          <filter id="tour-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
            <feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.70  0 0 0 0 0.42  0 0 0 0.5 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#tour-noise)" />
        </svg>
        {/* gold halos */}
        <div
          className="pointer-events-none absolute -left-1/4 top-1/4 h-[60vmin] w-[60vmin] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(217,179,106,0.28), transparent)" }}
        />
        <div
          className="pointer-events-none absolute -right-1/4 -bottom-1/4 h-[60vmin] w-[60vmin] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(190,150,190,0.20), transparent)" }}
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
          className="pointer-events-auto relative flex h-auto w-full max-w-[340px] sm:w-[420px] sm:max-w-[92vw] flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-white/10"
          style={{
            x: dragX,
            rotate: cardRotate,
            background: `linear-gradient(180deg, #14263f 0%, ${NAVY} 100%)`,
            boxShadow:
              "0 30px 90px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(217,179,106,0.12), 0 12px 40px -18px rgba(217,179,106,0.35)",
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
          {/* thin gold top hairline */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${GOLD}80, transparent)` }}
          />

          {/* Swipe direction hints */}
          <motion.div
            style={{ opacity: leftHint }}
            className="pointer-events-none absolute top-6 right-6 z-30 rounded-full border border-[rgba(217,179,106,0.6)] bg-[rgba(13,26,45,0.8)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-[#e8cf9a] backdrop-blur"
          >
            {t("tourNext")} →
          </motion.div>
          <motion.div
            style={{ opacity: rightHint }}
            className="pointer-events-none absolute top-6 left-6 z-30 rounded-full border border-white/20 bg-[rgba(13,26,45,0.8)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-white/70 backdrop-blur"
          >
            ← BACK
          </motion.div>

          {/* Top bar */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-4 pb-2">
            <span
              className="font-display text-[17px] italic font-semibold lowercase tracking-tight"
              style={{
                background: `linear-gradient(120deg, ${GOLD_SOFT}, ${GOLD} 55%, #b98f4a)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              my'myon
            </span>
            <button
              onClick={dismiss}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-all hover:border-[rgba(217,179,106,0.5)] hover:text-[#e8cf9a] active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* Hero image — editorial frame */}
          <div className="relative mx-4 overflow-hidden rounded-2xl border border-white/10">
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
            {/* cinematic vignette */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(6,13,24,0.15) 0%, transparent 35%, rgba(6,13,24,0.55) 100%)",
              }}
            />
            {/* kicker — gold eyebrow tag */}
            <div
              className="absolute left-4 top-4 select-none rounded-full border border-[rgba(217,179,106,0.45)] bg-[rgba(10,20,36,0.72)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-[#e8cf9a] backdrop-blur"
            >
              {slide.kicker}
            </div>
            {/* bottom gold hairline */}
            <div
              className="pointer-events-none absolute inset-x-6 bottom-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${GOLD}90, transparent)` }}
            />
          </div>

          {/* Body */}
          <div className="relative flex-1 px-6 pb-2 pt-4">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`txt-${index}`}
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={{ duration: 0.28 }}
              >
                <h2 className="font-display text-[22px] sm:text-[27px] font-semibold italic leading-[1.1] tracking-tight text-white">
                  {slide.title}
                </h2>
                {/* gold underline */}
                <div
                  className="mt-2 h-[2px] w-16 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }}
                />

                <p className="mt-3 text-[12px] sm:text-[13.5px] leading-relaxed text-white/65">
                  {slide.body}
                </p>

                <button
                  onClick={goShortcut}
                  className="group mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(217,179,106,0.5)] px-4 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.24em] text-[#e8cf9a] transition-all hover:bg-[rgba(217,179,106,0.12)] active:scale-95"
                >
                  {t("tourGo")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer / dots / actions */}
          <div className="relative z-10 px-6 pb-5 pt-3">
            <div className="mb-4 flex items-center justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Slide ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === index ? 26 : 6,
                    background:
                      i === index
                        ? `linear-gradient(90deg, ${GOLD_SOFT}, ${GOLD})`
                        : "rgba(255,255,255,0.22)",
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={dismiss}
                className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.22em] text-white/70 transition-all hover:border-white/30 hover:text-white active:scale-95"
              >
                {t("tourSkip")}
              </button>
              <button
                onClick={next}
                className="group flex flex-[1.5] items-center justify-center gap-2 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0a1424] transition-all active:scale-95"
                style={{
                  background: `linear-gradient(120deg, ${GOLD_SOFT}, ${GOLD} 55%, #c39a55)`,
                  boxShadow: "0 8px 24px -8px rgba(217,179,106,0.55)",
                }}
              >
                {isLast ? t("tourGetStarted") : t("tourNext")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>

            <label className="mt-3.5 flex cursor-pointer items-center justify-center gap-2 text-[10.5px] tracking-[0.08em] text-white/45 transition-colors hover:text-white/70">
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-colors ${
                  neverShow
                    ? "border-[rgba(217,179,106,0.7)] bg-[rgba(217,179,106,0.9)] text-[#0a1424]"
                    : "border-white/25 bg-transparent"
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
            <p className="mt-2 text-center text-[9px] uppercase tracking-[0.3em] text-white/30 sm:hidden">
              ← swipe →
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WelcomeTour;
