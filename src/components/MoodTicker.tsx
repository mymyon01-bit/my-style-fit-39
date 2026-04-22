import { useEffect, useRef, useState } from "react";

/**
 * MoodTicker — animated headline word.
 *
 * Three states:
 *   • idle  → fast "clock tick" (snap to next word every ~700ms, no easing)
 *   • hover → slow continuous roulette spin (smooth ease)
 *   • click → locks the currently visible word and fires onPick(word)
 *
 * Implementation notes:
 *   - We render two adjacent words at a time inside a fixed-height window and
 *     animate `translateY` between -100% (next) and 0% (current). After each
 *     transition we swap state (no layout thrash) so the loop continues
 *     forever without remounting.
 *   - The track is purely CSS-transformed; no framer-motion needed for the
 *     micro-animation, which keeps it lightweight inside the hero.
 */

export const MOOD_WORDS = [
  "mood",
  "weather",
  "moment",
  "story",
  "rhythm",
  "vibe",
  "season",
  "spark",
  "drama",
  "calm",
  "edge",
  "glow",
];

interface Props {
  onPick: (word: string) => void;
  className?: string;
}

const TICK_MS = 700;        // clock-tick cadence when idle
const ROULETTE_MS = 220;    // smooth ease step when hovered
const HOVER_DELAY = 80;     // tiny debounce before switching modes

export default function MoodTicker({ onPick, className }: Props) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [translating, setTranslating] = useState(false); // are we mid-tween?
  const timer = useRef<number | null>(null);

  const current = MOOD_WORDS[index % MOOD_WORDS.length];
  const next = MOOD_WORDS[(index + 1) % MOOD_WORDS.length];

  // Compute longest word — used so the surrounding box never reflows.
  const longest = MOOD_WORDS.reduce((a, b) => (b.length > a.length ? b : a));

  useEffect(() => {
    const stepMs = hover ? ROULETTE_MS : TICK_MS;
    const tick = () => {
      // Start the slide
      setTranslating(true);
      // After the slide finishes, swap to next word and reset position
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % MOOD_WORDS.length);
        setTranslating(false);
      }, hover ? ROULETTE_MS : 120); // idle uses a fast 120ms snap
    };
    timer.current = window.setInterval(tick, stepMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [hover]);

  // Transition style differs by mode:
  //   idle  → very short linear "snap" (clock tick feel)
  //   hover → longer ease-in-out (roulette spin)
  const trackStyle: React.CSSProperties = translating
    ? {
        transform: "translateY(-50%)",
        transition: hover
          ? `transform ${ROULETTE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
          : "transform 120ms steps(2, end)",
      }
    : {
        transform: "translateY(0)",
        transition: "none",
      };

  return (
    <button
      type="button"
      onMouseEnter={() => window.setTimeout(() => setHover(true), HOVER_DELAY)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onPick(current)}
      aria-label={`Pick mood: ${current}. Cycles through ${MOOD_WORDS.join(", ")}.`}
      className={`group relative inline-flex h-[1em] items-start overflow-hidden align-bottom outline-none cursor-pointer ${
        className || ""
      }`}
      style={{
        // ch units keep the slot wide enough for the longest word
        width: `${longest.length + 0.5}ch`,
      }}
    >
      <span
        className="flex flex-col text-gradient will-change-transform"
        style={trackStyle}
      >
        <span className="block leading-[1em]">{current}</span>
        <span className="block leading-[1em]">{next}</span>
      </span>

      {/* Hover hint underline — subtle, only on hover */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -bottom-1 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-primary via-accent to-primary transition-transform duration-300 ${
          hover ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </button>
  );
}
