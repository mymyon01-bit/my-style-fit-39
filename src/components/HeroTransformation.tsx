/**
 * HeroTransformation — premium 3-frame style evolution.
 *
 * Frame 1 (basic) → Frame 2 (transitional) → Frame 3 (fully curated).
 * Slow 15s loop (5s per frame) with Ken Burns zoom + subtle parallax drift.
 * Communicates: WARDROBE = personal fashion curator, not just shopping.
 *
 * Performance:
 *  - Frame 1 is `fetchpriority="high"` + eager (LCP candidate, preloaded).
 *  - Frames 2 & 3 are lazy + decoded async — they fade in over the first
 *    frame, so the page paints instantly even on slow connections.
 *  - The block reserves height via aspect-ratio so the search section
 *    below never jumps as images load.
 *  - Respects prefers-reduced-motion (shows static frame 1).
 */
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import frame1 from "@/assets/hero-frame-1.jpg";
import frame2 from "@/assets/hero-frame-2.jpg";
import frame3 from "@/assets/hero-frame-3.jpg";

const FRAMES = [frame1, frame2, frame3];

const HeroTransformation = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <section
      aria-label="Style transformation"
      className="hero-snap relative w-full overflow-hidden bg-background"
    >
      {/* Image stack — fixed aspect prevents layout shift on slow networks */}
      <div className="relative mx-auto aspect-[4/5] w-full max-w-7xl overflow-hidden md:aspect-[16/9] lg:aspect-[21/9]">
        {FRAMES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={1280}
            height={1600}
            // First frame is the LCP — load eagerly. Others lazy.
            loading={i === 0 ? "eager" : "lazy"}
            decoding={i === 0 ? "sync" : "async"}
            // @ts-expect-error fetchpriority is valid HTML, not yet in React types
            fetchpriority={i === 0 ? "high" : "low"}
            className="absolute inset-0 h-full w-full object-cover hero-fade"
            style={{ animationDelay: `${i * 5}s` }}
          />
        ))}

        {/* Soft dark gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-background/50" />

        {/* Editorial overlay text */}
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-12 md:px-16 md:pb-20 lg:px-24 lg:pb-28">
          <div className="max-w-xl animate-[heroIn_0.9s_cubic-bezier(0.22,1,0.36,1)_both]">
            <div className="flex items-baseline gap-3">
              <span className="flex items-baseline font-display text-[18px] font-light leading-none text-foreground md:text-[20px]">
                <span className="tracking-[0.05em]">my</span>
                <span aria-hidden className="mx-[0.18em] inline-block h-[3px] w-[3px] translate-y-[-0.55em] rounded-full bg-accent/80" />
                <span className="tracking-[0.05em]">myon</span>
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.4em] text-foreground/55">
                est. 2026
              </span>
            </div>
            <h1 className="mt-5 font-display text-[28px] font-semibold leading-[1.1] text-foreground md:text-[44px] lg:text-[56px]">
              {t("heroLine1")}
              <br />
              <span className="text-foreground/85">{t("heroLine2")}</span>
            </h1>
            <p className="mt-4 max-w-md text-[13px] font-medium tracking-wide text-foreground/75 md:mt-5 md:text-[15px]">
              {t("heroSubtitle")}
            </p>
            <button
              onClick={() => navigate("/discover")}
              className="hover-burgundy mt-7 inline-flex items-center gap-2.5 rounded-lg border border-accent/25 bg-accent/[0.05] px-6 py-3 text-[11px] font-semibold tracking-[0.22em] text-foreground/85 backdrop-blur-sm transition-all hover:bg-accent/[0.1] hover:border-accent/40 md:mt-9"
            >
              {t("heroCta").toUpperCase()}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroTransformation;
