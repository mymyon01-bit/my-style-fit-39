/**
 * HeroTransformation — kept for routes that still mount it. Now styled with
 * the vibrant brutalist system: italic display, mono tags, brutalist CTA.
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
      <div className="relative mx-auto aspect-[4/5] w-full max-w-7xl overflow-hidden md:aspect-[16/9] lg:aspect-[21/9]">
        {FRAMES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={1280}
            height={1600}
            loading={i === 0 ? "eager" : "lazy"}
            decoding={i === 0 ? "sync" : "async"}
            // @ts-expect-error fetchpriority is valid HTML, not yet in React types
            fetchpriority={i === 0 ? "high" : "low"}
            className="absolute inset-0 h-full w-full object-cover hero-fade"
            style={{ animationDelay: `${i * 5}s` }}
          />
        ))}

        {/* Tinted overlay — bottom darker for caption */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-start justify-end px-8 pb-12 md:px-16 md:pb-20 lg:px-24 lg:pb-28">
          <div className="max-w-2xl animate-[heroIn_0.9s_cubic-bezier(0.22,1,0.36,1)_both]">
            <div className="flex items-center gap-3">
              <span className="flex items-baseline font-mono text-[16px] font-medium uppercase leading-none text-foreground md:text-[18px]">
                <span className="tracking-[0.22em]">MY</span>
                <span aria-hidden className="mx-[0.28em] inline-block h-[5px] w-[5px] translate-y-[-0.45em] rounded-full bg-gradient-to-br from-primary to-accent" />
                <span className="tracking-[0.22em]">MYON</span>
              </span>
              <span className="label-mono text-foreground/65">EST. 2026</span>
            </div>

            <h1 className="mt-6 font-display text-[34px] font-medium italic leading-[0.94] tracking-[-0.05em] text-foreground md:text-[56px] lg:text-[72px]">
              {t("heroLine1")}
              <br />
              <span className="text-gradient not-italic font-semibold">{t("heroLine2")}</span>
            </h1>

            <p className="mt-5 max-w-md text-[14px] font-medium leading-relaxed text-foreground/75 md:text-[16px]">
              {t("heroSubtitle")}
            </p>

            <button
              onClick={() => navigate("/discover")}
              className="btn-brutalist mt-8"
            >
              {t("heroCta")}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroTransformation;
