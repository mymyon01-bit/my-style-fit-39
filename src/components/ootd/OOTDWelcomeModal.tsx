import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Palette, Users, Share2, X, ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "ootd:welcome:dismissed:v1";

interface Slide {
  icon: React.ReactNode;
  illustration: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}

const slides: Slide[] = [
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
    title: "별점 시스템 ⭐",
    body: "마음에 드는 OOTD에 별을 보내주세요. 하루 3개의 별을 받고, 별을 모은 코디는 랭킹에 올라갑니다.",
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
        {/* phone frame */}
        <rect x="90" y="20" width="60" height="100" rx="10" fill="hsl(var(--background))" stroke="hsl(var(--accent))" strokeWidth="1.5" />
        <rect x="96" y="30" width="48" height="56" rx="6" fill="hsl(var(--accent) / 0.25)" />
        <circle cx="106" cy="100" r="5" fill="hsl(var(--star))" />
        <circle cx="120" cy="100" r="5" fill="hsl(var(--accent))" />
        <circle cx="134" cy="100" r="5" fill="hsl(var(--primary))" />
        {/* sparkles */}
        <circle cx="55" cy="40" r="3" fill="hsl(var(--accent))" opacity="0.8" />
        <circle cx="195" cy="50" r="4" fill="hsl(var(--star))" opacity="0.8" />
        <circle cx="60" cy="100" r="3" fill="hsl(var(--primary))" opacity="0.7" />
        <circle cx="190" cy="105" r="3" fill="hsl(var(--accent))" opacity="0.7" />
      </svg>
    ),
    title: "나만의 프로필 꾸미기 🎨",
    body: "배경 테마, 카드 색상, 오늘의 노래까지 — 나만의 스타일로 프로필을 꾸미세요. 친구들도 내가 설정한 모습 그대로 봅니다.",
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
        {/* feed cards */}
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
    title: "피드 & 커뮤니티 💬",
    body: "다른 유저들의 코디를 둘러보고, 트렌드 토픽으로 이야기를 나눠보세요. 인기 코디는 랭킹 탭에서 한눈에 확인할 수 있어요.",
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
        {/* share arrow + stars flow */}
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
    title: "공유하면 별 +1 ✨",
    body: "친구에게 코디를 공유할 때마다 보너스 별을 받습니다. 더 많이 나눌수록 더 많은 별로 더 많은 코디를 응원할 수 있어요.",
  },
];

export default function OOTDWelcomeModal() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // small delay so it appears after page settles
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setOpen(false);
  };

  const next = () => {
    if (index < slides.length - 1) setIndex((i) => i + 1);
    else close();
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
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={close}
      >
        <motion.div
          initial={{ y: 20, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 10, scale: 0.98, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-accent/20 bg-background shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={close}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition hover:bg-foreground/20"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Illustration */}
          <div className="relative h-44 w-full overflow-hidden bg-foreground/[0.03] px-6 pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                className="h-full w-full"
              >
                {slide.illustration}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: `${slide.accent.replace("hsl(", "hsl(").slice(0, -1)} / 0.15)`, color: slide.accent }}
                  >
                    {slide.icon}
                  </span>
                  <span className="text-[9px] font-bold tracking-[0.18em] text-foreground/50">
                    {index + 1} / {slides.length}
                  </span>
                </div>
                <h3 className="mb-2 text-[17px] font-bold leading-tight text-foreground">{slide.title}</h3>
                <p className="text-[12.5px] leading-relaxed text-foreground/65">{slide.body}</p>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="mt-5 flex items-center justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-2">
              {index > 0 ? (
                <button
                  onClick={prev}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl border border-foreground/15 px-4 text-[11px] font-bold tracking-[0.12em] text-foreground/70 transition hover:bg-foreground/[0.05]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  이전
                </button>
              ) : (
                <button
                  onClick={close}
                  className="flex h-11 items-center justify-center rounded-xl px-4 text-[11px] font-bold tracking-[0.12em] text-foreground/50 transition hover:text-foreground/80"
                >
                  건너뛰기
                </button>
              )}
              <button
                onClick={next}
                className="ml-auto flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground px-5 text-[11px] font-bold tracking-[0.12em] text-background transition hover:opacity-90"
              >
                {index === slides.length - 1 ? "시작하기" : "다음"}
                {index < slides.length - 1 && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
