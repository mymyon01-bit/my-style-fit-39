/**
 * About — playful, fashion-themed company page.
 *
 * New: cute floating fashion icons (hangers, dresses, bags, shoes…) layered
 * behind the hero, plus a sticky chip-nav at the top that smooth-scrolls to
 * each section.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Megaphone, X,
  Shirt, ShoppingBag, Footprints, Crown, Heart, Sparkles, Star, Gem,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import SectionReveal from "@/components/SectionReveal";
import Footer from "@/components/Footer";
import HeroTransformation from "@/components/HeroTransformation";
import ContactUsDialog from "@/components/ContactUsDialog";

const FEATURES = [
  "AI-powered product discovery",
  "Real-time multi-source search",
  "Personalized style & preference learning",
  "Fit-based recommendation system",
  "OOTD social & outfit sharing",
];

const SECTIONS = [
  { id: "hero", label: "Intro" },
  { id: "features", label: "Features" },
  { id: "vision", label: "Vision" },
  { id: "affiliate", label: "Partner" },
  { id: "contact", label: "Contact" },
];

/** Floating fashion confetti behind the hero. */
const FLOATING_ICONS = [
  { Icon: Shirt,       top: "12%", left: "8%",  delay: 0,   size: 22, color: "text-accent/35", float: 6 },
  { Icon: ShoppingBag, top: "22%", left: "82%", delay: 0.3, size: 26, color: "text-primary/35", float: 8 },
  { Icon: Footprints,  top: "70%", left: "12%", delay: 0.6, size: 24, color: "text-foreground/30", float: 7 },
  { Icon: Crown,       top: "8%",  left: "55%", delay: 0.9, size: 18, color: "text-accent/40", float: 5 },
  { Icon: Heart,       top: "55%", left: "88%", delay: 1.2, size: 16, color: "text-primary/45", float: 9 },
  { Icon: Sparkles,    top: "40%", left: "5%",  delay: 1.5, size: 18, color: "text-accent/45", float: 6 },
  { Icon: Gem,         top: "85%", left: "70%", delay: 1.8, size: 18, color: "text-foreground/30", float: 7 },
  { Icon: Star,        top: "32%", left: "38%", delay: 2.1, size: 14, color: "text-primary/35", float: 5 },
  { Icon: Shirt,       top: "78%", left: "48%", delay: 2.4, size: 20, color: "text-accent/30", float: 8 },
  { Icon: ShoppingBag, top: "60%", left: "30%", delay: 2.7, size: 18, color: "text-foreground/25", float: 6 },
];

/**
 * Hand-drawn coat-hanger SVG. Lucide doesn't ship one, so a tiny inline glyph
 * gives the page its signature "wardrobe" cue.
 */
const Hanger = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 7a2 2 0 1 1-2-2" />
    <path d="M12 7v2" />
    <path d="M12 9 3 16h18l-9-7Z" />
  </svg>
);

const HANGERS = [
  { top: "18%", left: "20%", delay: 0.4, size: 28, color: "text-accent/30" },
  { top: "65%", left: "78%", delay: 1.0, size: 32, color: "text-primary/25" },
  { top: "45%", left: "62%", delay: 1.6, size: 24, color: "text-foreground/20" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
}

const AboutPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Premium hero transformation */}
      <HeroTransformation />

      {/* Top nav row */}
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
        <button
          onClick={() => navigate("/")}
          aria-label="Close"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-foreground/20 bg-background/80 text-foreground/80 backdrop-blur-md transition-all hover:border-foreground hover:text-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sticky chip nav — quick-jump to each section */}
      <div className="sticky-header sticky top-0 z-40 mt-6 border-b border-accent/10 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto px-8 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s.id}
              onClick={() => scrollToId(s.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.3 }}
              className="shrink-0 rounded-full border border-accent/20 bg-accent/[0.04] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/70 transition-colors hover:border-accent/40 hover:bg-accent/[0.1] hover:text-foreground"
            >
              {s.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Hero section with floating fashion icons */}
      <section
        id="hero"
        className="relative mx-auto max-w-3xl overflow-hidden px-8 pt-16 pb-20 lg:pt-24 lg:pb-28"
      >
        {/* Floating icon layer */}
        <div className="pointer-events-none absolute inset-0">
          {FLOATING_ICONS.map(({ Icon, top, left, delay, size, color, float }, i) => (
            <motion.div
              key={i}
              className={`absolute ${color}`}
              style={{ top, left }}
              initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
              animate={{
                opacity: 1,
                scale: 1,
                rotate: [-6, 6, -6],
                y: [0, -float, 0],
              }}
              transition={{
                opacity: { delay, duration: 0.6 },
                scale: { delay, duration: 0.6, type: "spring", stiffness: 180 },
                rotate: { delay, duration: 5 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                y:      { delay, duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <Icon size={size} strokeWidth={1.4} />
            </motion.div>
          ))}
          {HANGERS.map((h, i) => (
            <motion.div
              key={`hanger-${i}`}
              className={`absolute ${h.color}`}
              style={{ top: h.top, left: h.left }}
              initial={{ opacity: 0, y: -20, rotate: -20 }}
              animate={{
                opacity: 1, y: 0,
                rotate: [-8, 8, -8],
              }}
              transition={{
                opacity: { delay: h.delay, duration: 0.7 },
                y: { delay: h.delay, duration: 0.6, type: "spring" },
                rotate: { delay: h.delay, duration: 6 + i, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <Hanger size={h.size} />
            </motion.div>
          ))}
        </div>

        <SectionReveal>
          <div className="relative">
            <div className="flex items-baseline gap-4">
              <span className="flex items-baseline font-display text-[20px] font-light leading-none text-foreground md:text-[22px]">
                <span className="tracking-[0.04em]">my</span>
                <span aria-hidden className="mx-[0.18em] inline-block h-[3px] w-[3px] translate-y-[-0.55em] rounded-full bg-accent/75" />
                <span className="tracking-[0.04em]">myon</span>
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.4em] text-foreground/50">
                est. 2026
              </span>
            </div>
            <h1 className="mt-5 font-display text-[32px] font-semibold leading-[1.1] text-foreground md:text-[48px] lg:text-[60px]">
              Discover. Fit. Wear.
            </h1>
            <p className="mt-8 max-w-xl text-[14px] leading-[1.85] text-foreground/75 md:text-[15px]">
              mymyon is an AI-powered fashion discovery platform built to solve
              a simple problem: finding what actually fits you — not just what
              looks good.
            </p>
            <p className="mt-5 max-w-xl text-[14px] leading-[1.85] text-foreground/70 md:text-[15px]">
              We combine real-time product search, personalized style
              understanding, and fit intelligence to help users discover,
              evaluate, and wear clothes with confidence.
            </p>
            <p className="mt-5 max-w-xl text-[14px] leading-[1.85] text-foreground/70 md:text-[15px]">
              Instead of browsing endless items, mymyon understands intent,
              filters noise, and delivers results that match both style and body.
            </p>
            <p className="mt-8 max-w-xl text-[14px] leading-[1.85] text-foreground md:text-[15px]">
              This is not just shopping.
              <br />
              <span className="text-foreground/60">
                This is intelligent wardrobe building.
              </span>
            </p>
          </div>
        </SectionReveal>
      </section>

      <div className="mx-auto max-w-3xl px-8">
        <div className="h-px bg-accent/10" />
      </div>

      {/* Core features */}
      <section id="features" className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="text-accent/70"
            >
              <Hanger size={18} />
            </motion.div>
            <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
              CORE FEATURES
            </p>
          </div>
          <ul className="mt-10 space-y-4">
            {FEATURES.map((feature, i) => (
              <motion.li
                key={feature}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-start gap-5 border-b border-border/20 pb-4 last:border-b-0"
              >
                <span className="mt-1 font-display text-[11px] font-semibold tabular-nums tracking-[0.15em] text-accent/55">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[14px] leading-[1.6] text-foreground/85 md:text-[15px]">
                  {feature}
                </span>
              </motion.li>
            ))}
          </ul>
        </SectionReveal>
      </section>

      <div className="mx-auto max-w-3xl px-8">
        <div className="h-px bg-accent/10" />
      </div>

      {/* Vision */}
      <section id="vision" className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="text-primary/70"
            >
              <Sparkles size={16} />
            </motion.div>
            <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
              VISION
            </p>
          </div>
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

      {/* Affiliate / Ad */}
      <section id="affiliate" className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-accent/70"
            >
              <ShoppingBag size={16} />
            </motion.div>
            <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
              AFFILIATE / AD
            </p>
          </div>
          <p className="mt-8 max-w-xl text-[14px] leading-[1.85] text-foreground/75 md:text-[15px]">
            Partner with mymyon to reach a style-forward, intent-driven
            audience. We work with brands, boutiques and creators on
            affiliate placements and curated ad slots inside our discovery
            and OOTD surfaces.
          </p>
          <ul className="mt-6 space-y-2 text-[13px] text-foreground/70 md:text-[14px]">
            <li>— Brand affiliate partnerships</li>
            <li>— Native ad placement (FOR YOU / discovery feed)</li>
            <li>— Creator & boutique collaborations</li>
          </ul>
          <button
            onClick={() => setContactOpen(true)}
            className="hover-burgundy mt-10 inline-flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/[0.06] px-7 py-3.5 text-[11px] font-semibold tracking-[0.18em] text-foreground/85 transition-all hover:bg-accent/[0.1] hover:border-accent/40"
          >
            <Megaphone className="h-3.5 w-3.5" />
            CONTACT US
          </button>
        </SectionReveal>
      </section>

      <div className="mx-auto max-w-3xl px-8">
        <div className="h-px bg-accent/10" />
      </div>

      {/* Contact */}
      <section id="contact" className="mx-auto max-w-3xl px-8 py-20 lg:py-28">
        <SectionReveal>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="text-primary/75"
            >
              <Heart size={14} fill="currentColor" />
            </motion.div>
            <p className="text-[10px] font-semibold tracking-[0.3em] text-accent/60">
              CONTACT
            </p>
          </div>
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
      <ContactUsDialog open={contactOpen} onOpenChange={setContactOpen} topic="Affiliate / Ad" />
    </div>
  );
};

export default AboutPage;
