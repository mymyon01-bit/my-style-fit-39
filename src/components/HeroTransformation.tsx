/**
 * HeroTransformation — premium cross-fade hero.
 *
 * Three editorial fashion frames cross-fade on a fixed cadence to suggest
 * an "ordinary → in-between → curated" style transformation. Pure CSS
 * keyframes — no JS animation loop, no video file, no layout shift.
 *
 * Performance:
 *  - First frame is `fetchpriority="high"` (LCP candidate).
 *  - Frames 2 & 3 are lazy + decoded async. They blur up under the first
 *    frame, so the page paints instantly even on slow connections.
 *  - The block reserves height via aspect-ratio so the search section
 *    below never jumps as images load.
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
            style={{ animationDelay: `${i * 3}s` }}
          />
        ))}

        {/* Soft dark gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-background/40" />

        {/* Editorial overlay text */}
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-12 md:px-16 md:pb-20 lg:px-24 lg:pb-28">
          <div className="max-w-xl animate-[heroIn_0.9s_cubic-bezier(0.22,1,0.36,1)_both]">
            <p className="font-display text-[11px] font-semibold tracking-[0.4em] text-foreground/85">
              WARDROBE
            </p>
            <h1 className="mt-5 font-display text-[28px] font-semibold leading-[1.1] text-foreground md:text-[44px] lg:text-[56px]">
              {t("heroLine1")}
              <br />
              <span className="text-foreground/85">{t("heroLine2")}</span>
            </h1>
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
