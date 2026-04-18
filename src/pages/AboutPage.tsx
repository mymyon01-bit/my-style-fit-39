/**
 * About — investor-ready company introduction.
 *
 * Structure (top to bottom):
 *   1. Nav (back + chip)
 *   2. Hero — WARDROBE / Discover. Fit. Wear. + main description
 *   3. Core features list
 *   4. Vision statement
 *   5. Contact
 *   6. PND INC footer
 *
 * Motion: SectionReveal handles the gentle fade-in-on-scroll. No heavy
 * animation libraries. Hardcoded layout, only content changes.
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import SectionReveal from "@/components/SectionReveal";
import Footer from "@/components/Footer";

const FEATURES = [
  "AI-powered product discovery",
  "Real-time multi-source search",
  "Personalized style & preference learning",
  "Fit-based recommendation system",
  "OOTD social & outfit sharing",
];

const AboutPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-8 pt-10 lg:pt-16">
        <button
          onClick={() => navigate(-1)}
          className="hover-burgundy text-foreground/70"
          aria-label="Back"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/65">
          {t("about").toUpperCase()}
        </span>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <SectionReveal>
          <p className="font-display text-[12px] font-semibold tracking-[0.45em] text-accent/70">
            WARDROBE
          </p>
          <h1 className="mt-5 font-display text-[32px] font-semibold leading-[1.1] text-foreground md:text-[48px] lg:text-[60px]">
            Discover. Fit. Wear.
          </h1>
          <p className="mt-8 max-w-xl text-[14px] leading-[1.85] text-foreground/75 md:text-[15px]">
            WARDROBE is an AI-powered fashion discovery platform built to solve
            a simple problem: finding what actually fits you — not just what
            looks good.
          </p>
          <p className="mt-5 max-w-xl text-[14px] leading-[1.85] text-foreground/70 md:text-[15px]">
            We combine real-time product search, personalized style
            understanding, and fit intelligence to help users discover,
            evaluate, and wear clothes with confidence.
          </p>
          <p className="mt-5 max-w-xl text-[14px] leading-[1.85] text-foreground/70 md:text-[15px]">
            Instead of browsing endless items, WARDROBE understands intent,
            filters noise, and delivers results that match both style and body.
          </p>
          <p className="mt-8 max-w-xl text-[14px] leading-[1.85] text-foreground md:text-[15px]">
            This is not just shopping.
            <br />
            <span className="text-foreground/60">
              This is intelligent wardrobe building.
            </span>
          </p>
        </SectionReveal>
      </section>

      <div className="mx-auto max-w-3xl px-8">
        <div className="h-px bg-accent/10" />
      </div>

      {/* Core features */}
      <section className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
            CORE FEATURES
          </p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((feature, i) => (
              <li
                key={feature}
                className="flex items-start gap-5 border-b border-border/20 pb-4 last:border-b-0"
              >
                <span className="mt-1 font-display text-[11px] font-semibold tabular-nums tracking-[0.15em] text-accent/55">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[14px] leading-[1.6] text-foreground/85 md:text-[15px]">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </SectionReveal>
      </section>

      <div className="mx-auto max-w-3xl px-8">
        <div className="h-px bg-accent/10" />
      </div>

      {/* Vision */}
      <section className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
            VISION
          </p>
          <p className="mt-8 max-w-2xl font-display text-[20px] leading-[1.4] text-foreground/90 md:text-[24px] lg:text-[28px]">
            To become the intelligence layer between people and fashion —
            <span className="text-foreground/60">
              {" "}
              where every purchase is informed, relevant, and personal.
            </span>
          </p>
        </SectionReveal>
      </section>

      <div className="mx-auto max-w-3xl px-8">
        <div className="h-px bg-accent/10" />
      </div>

      {/* Contact + CTA */}
      <section className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
            CONTACT
          </p>
          <a
            href="mailto:mymyon.01@gmail.com"
            className="hover-burgundy mt-6 block text-[16px] text-foreground/85 md:text-[18px]"
          >
            mymyon.01@gmail.com
          </a>

          <button
            onClick={() => navigate("/discover")}
            className="hover-burgundy mt-12 inline-flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/[0.06] px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-foreground/85 transition-all hover:bg-accent/[0.1] hover:border-accent/40"
          >
            {t("aboutCtaButton").toUpperCase()}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </SectionReveal>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;
