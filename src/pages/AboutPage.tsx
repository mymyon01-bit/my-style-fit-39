import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, Sparkles, Layers, RefreshCw, Bookmark, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
});

const AboutPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const steps = [
    { icon: Sparkles, label: t("aboutStep1Label"), desc: t("aboutStep1Desc") },
    { icon: Layers, label: t("aboutStep2Label"), desc: t("aboutStep2Desc") },
    { icon: Bookmark, label: t("aboutStep3Label"), desc: t("aboutStep3Desc") },
    { icon: RefreshCw, label: t("aboutStep4Label"), desc: t("aboutStep4Desc") },
  ];

  const differentiators = [
    { title: t("aboutDiff1Title"), desc: t("aboutDiff1Desc") },
    { title: t("aboutDiff2Title"), desc: t("aboutDiff2Desc") },
    { title: t("aboutDiff3Title"), desc: t("aboutDiff3Desc") },
    { title: t("aboutDiff4Title"), desc: t("aboutDiff4Desc") },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-8 pt-10 lg:pt-28">
        <button onClick={() => navigate(-1)} className="hover-burgundy text-foreground/70">
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/65">{t("about").toUpperCase()}</span>
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <motion.div {...fade(0)} className="max-w-xl">
          <h1 className="font-display text-[28px] font-semibold leading-[1.2] text-foreground md:text-[36px] lg:text-[44px]">
            {t("aboutHeroTitle")}
          </h1>
          <p className="mt-5 text-[14px] leading-[1.8] text-foreground/70 max-w-md md:text-[15px]">
            {t("aboutHeroDesc")}
          </p>
        </motion.div>
      </section>

      <div className="mx-auto max-w-3xl px-8"><div className="h-px bg-accent/10" /></div>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-8 py-24 lg:py-32">
        <motion.p {...fade(0)} className="text-[10px] font-semibold tracking-[0.3em] text-accent/60 mb-12">
          {t("aboutHowItWorks").toUpperCase()}
        </motion.p>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-4">
          {steps.map((step, i) => (
            <motion.div key={i} {...fade(i * 0.1)} className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/[0.06] border border-accent/10 mb-5">
                <step.icon className="h-5 w-5 text-accent/60" strokeWidth={1.6} />
              </div>
              <p className="text-[13px] font-semibold text-foreground/80">{step.label}</p>
              <p className="mt-1 text-[11px] text-foreground/75">{step.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="absolute right-0 top-5 hidden h-4 w-4 text-accent/20 md:block" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-8"><div className="h-px bg-accent/10" /></div>

      {/* What makes it different */}
      <section className="mx-auto max-w-3xl px-8 py-24 lg:py-32">
        <motion.p {...fade(0)} className="text-[10px] font-semibold tracking-[0.3em] text-accent/60 mb-12">
          {t("aboutWhatMakesDiff").toUpperCase()}
        </motion.p>
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          {differentiators.map((d, i) => (
            <motion.div key={i} {...fade(i * 0.08)}>
              <p className="text-[14px] font-semibold text-foreground/80 md:text-[15px]">{d.title}</p>
              <p className="mt-1.5 text-[12px] leading-[1.7] text-foreground/75">{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-8"><div className="h-px bg-accent/10" /></div>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-8 py-24 text-center lg:py-32">
        <motion.div {...fade(0)}>
          <h2 className="font-display text-[22px] font-semibold text-foreground md:text-[28px]">
            {t("aboutCtaTitle")}
          </h2>
          <p className="mt-4 text-[13px] text-foreground/75">
            {t("aboutCtaDesc")}
          </p>
          <button
            onClick={() => navigate("/discover")}
            className="hover-burgundy mt-8 inline-flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/[0.06] px-7 py-3.5 text-[11px] font-semibold tracking-[0.15em] text-foreground/80 transition-all hover:bg-accent/[0.1] hover:border-accent/40"
          >
            {t("aboutCtaButton").toUpperCase()}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      </section>

      <div className="h-16" />
    </div>
  );
};

export default AboutPage;
