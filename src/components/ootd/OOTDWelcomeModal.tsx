import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Palette, Users, Share2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STORAGE_KEY = "ootd:welcome:dismissed:v1";
export const OOTD_WELCOME_OPEN_EVENT = "ootd:open-welcome";

interface Slide {
  icon: React.ReactNode;
  illustration: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}

const buildSlides = (t: (k: any) => string): Slide[] => [
  {
    icon: <Star className="h-5 w-5" />,
    accent: "hsl(var(--star))",
    illustration: (
      <svg viewBox="0 0 240 140" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--star))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--star))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="240" height="140" rx="16" fill="url(#g1)" />
        {[
          { cx: 60, cy: 70, r: 22 },
          { cx: 120, cy: 70, r: 28 },
          { cx: 180, cy: 70, r: 22 },
        ].map((c, i) => (
          <g key={i}>
            <circle cx={c.cx} cy={c.cy} r={c.r} fill="hsl(var(--background))" stroke="hsl(var(--star))" strokeWidth="1.5" opacity={0.9} />
            <path
              d={`M${c.cx} ${c.cy - c.r * 0.5} l${c.r * 0.18} ${c.r * 0.55} h${c.r * 0.58} l-${c.r * 0.47} ${c.r * 0.34} l${c.r * 0.18} ${c.r * 0.55} l-${c.r * 0.47} -${c.r * 0.34} l-${c.r * 0.47} ${c.r * 0.34} l${c.r * 0.18} -${c.r * 0.55} l-${c.r * 0.47} -${c.r * 0.34} h${c.r * 0.58} z`}
              fill="hsl(var(--star))"
              opacity={i === 1 ? 1 : 0.6}
            />
          </g>
        ))}
      </svg>
    ),
    title: t("ootdWelcomeStarsTitle"),
    body: t("ootdWelcomeStarsBody"),
  },
  {
    icon: <Palette className="h-5 w-5" />,
    accent: "hsl(var(--accent))",
    illustration: (
      <svg viewBox="0 0 240 140" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="240" height="140" rx="16" fill="url(#g2)" />
        <rect x="90" y="20" width="60" height="100" rx="10" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeWidth="1.5" />
        <rect x="96" y="30" width="48" height="56" rx="6" fill="hsl(var(--accent) / 0.25)" />
        <circle cx="106" cy="100" r="5" fill="hsl(var(--star))" />
        <circle cx="120" cy="100" r="5" fill="hsl(var(--accent))" />
        <circle cx="134" cy="100" r="5" fill="hsl(var(--primary))" />
        <circle cx="55" cy="40" r="3" fill="hsl(var(--accent))" opacity="0.8" />
        <circle cx="195" cy="50" r="4" fill="hsl(var(--star))" opacity="0.8" />
        <circle cx="60" cy="100" r="3" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="190" cy="105" r="3" fill="hsl(var(--accent))" opacity="0.7" />
      </svg>
    ),
    title: t("ootdWelcomeProfileTitle"),
    body: t("ootdWelcomeProfileBody"),
  },
  {
    icon: <Users className="h-5 w-5" />,
    accent: "hsl(var(--primary))",
    illustration: (
      <svg viewBox="0 0 240 140" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="240" height="140" rx="16" fill="url(#g3)" />
        {[40, 100, 160].map((x, i) => (
          <g key={i}>
            <rect x={x} y={28 + (i % 2) * 8} width="44" height="84" rx="8" fill="hsl(var(--background))" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1.5" />
            <rect x={x + 4} y={32 + (i % 2) * 8} width="36" height="50" rx="4" fill="hsl(var(--primary) / 0.2)" />
            <rect x={x + 4} y={88 + (i % 2) * 8} width="28" height="3" rx="1.5" fill="hsl(var(--foreground) / 0.4)" />
            <rect x={x + 4} y={94 + (i % 2) * 8} width="20" height="3" rx="1.5" fill="hsl(var(--foreground) / 0.25)" />
          </g>
        ))}
      </svg>
    ),
    title: t("ootdWelcomeFeedTitle"),
    body: t("ootdWelcomeFeedBody"),
  },
  {
    icon: <Share2 className="h-5 w-5" />,
    accent: "hsl(var(--star))",
    illustration: (
      <svg viewBox="0 0 240 140" className="h-full w-full" fill="none">
        <defs>
          <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--star))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="240" height="140" rx="16" fill="url(#g4)" />
        <circle cx="60" cy="70" r="18" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeWidth="1.5" />
        <path d="M54 70 l5 -5 v3 h7 v4 h-7 v3 z" fill="hsl(var(--accent))" />
        <path d="M85 70 Q120 30 155 70" stroke="hsl(var(--star))" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
        {[110, 135, 165, 195].map((x, i) => (
          <path
            key={i}
            d={`M${x} ${60 + i * 4} l2 6 h6 l-5 4 l2 6 l-5 -4 l-5 4 l2 -6 l-5 -4 h6 z`}
            fill="hsl(var(--star))"
            opacity={1 - i * 0.15}
          />
        ))}
      </svg>
    ),
    title: t("ootdWelcomeShareTitle"),
    body: t("ootdWelcomeShareBody"),
  },
];

export default function OOTDWelcomeModal() {
  const { t, lang } = useI18n();
  const slides = useMemo(() => buildSlides(t), [t, lang]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Auto-show on first visit
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => {
        setOpen(true);
        // Mark as seen immediately so it auto-shows only once.
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch {/* ignore */}
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for manual open from info button
  useEffect(() => {
    const handler = () => { setIndex(0); setOpen(true); };
    window.addEventListener(OOTD_WELCOME_OPEN_EVENT, handler);
    return () => window.removeEventListener(OOTD_WELCOME_OPEN_EVENT, handler);
  }, []);

  const closeOnce = () => {
    // Just hides for this session — modal will appear again next time.
    setOpen(false);
  };

  const closeForever = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {/* ignore */}
    setOpen(false);
  };

  const next = () => {
    if (index < slides.length - 1) setIndex((i) => i + 1);
    else closeForever();
  };
  const prev = () => index > 0 && setIndex((i) => i - 1);

  if (!open) return null;
  const slide = slides[index];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        onClick={closeOnce}
      >
        {/* Floating sparkle dust around the card */}
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-accent/40"
              style={{
                left: `${10 + (i * 11) % 80}%`,
                top: `${15 + (i * 17) % 70}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.8, 0.2],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 3 + (i % 3),
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ y: 40, scale: 0.85, opacity: 0, rotate: -2 }}
          animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
          exit={{ y: 20, scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 240, mass: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md overflow-hidden rounded-[28px] border-2 border-accent/20 bg-background shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={closeOnce}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition hover:bg-foreground/20 hover:rotate-90 duration-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Illustration with floating motion */}
          <div className="relative h-56 w-full overflow-hidden bg-foreground/[0.03] px-8 pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 30, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -30, scale: 0.9 }}
                transition={{ type: "spring", damping: 22, stiffness: 220 }}
                className="h-full w-full"
              >
                <motion.div
                  className="h-full w-full"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  {slide.illustration}
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Body */}
          <div className="px-7 pb-7 pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", damping: 24, stiffness: 280 }}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <motion.span
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: `${slide.accent.slice(0, -1)} / 0.15)`, color: slide.accent }}
                    initial={{ rotate: -20, scale: 0.6 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 320, delay: 0.1 }}
                  >
                    {slide.icon}
                  </motion.span>
                  <span className="text-[10px] font-bold tracking-[0.2em] text-foreground/50">
                    {index + 1} / {slides.length}
                  </span>
                </div>
                <h3 className="mb-2.5 text-[22px] font-bold leading-tight text-foreground">{slide.title}</h3>
                <p className="text-[14px] leading-relaxed text-foreground/70 whitespace-pre-line">{slide.body}</p>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-8 bg-foreground" : "w-2 bg-foreground/25 hover:bg-foreground/40"
                  }`}
                  aria-label={`${t("ootdWelcomeSlideAria")} ${i + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-2">
              {index > 0 && (
                <button
                  onClick={prev}
                  className="flex h-12 items-center justify-center gap-1 rounded-2xl border border-foreground/15 px-4 text-[12px] font-bold tracking-[0.12em] text-foreground/70 transition hover:bg-foreground/[0.05]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("ootdWelcomePrev")}
                </button>
              )}
              <motion.button
                onClick={next}
                whileTap={{ scale: 0.96 }}
                className="ml-auto flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-foreground px-5 text-[12px] font-bold tracking-[0.12em] text-background transition hover:opacity-90"
              >
                {index === slides.length - 1 ? t("ootdWelcomeStart") : t("ootdWelcomeNext")}
                {index < slides.length - 1 && <ChevronRight className="h-4 w-4" />}
              </motion.button>
            </div>

            {/* Don't show again */}
            <button
              onClick={closeForever}
              className="mt-3 w-full text-center text-[11px] text-foreground/45 hover:text-foreground/70 transition-colors underline-offset-4 hover:underline"
            >
              {t("ootdWelcomeDontShow")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Helper to open the welcome modal from anywhere. */
export function openOOTDWelcome() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OOTD_WELCOME_OPEN_EVENT));
  }
}
