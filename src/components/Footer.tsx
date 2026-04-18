/**
 * Footer — minimal premium PND INC mark.
 *
 * Used on Homepage, About, and Settings only. Intentionally no nav links,
 * no social icons, no newsletter form — just legal mark + contact.
 */
const Footer = () => {
  return (
    <footer className="border-t border-border/30 bg-background">
      <div className="mx-auto max-w-3xl px-8 py-12 lg:py-16">
        {/* Brand mark */}
        <p className="font-display text-[11px] font-semibold tracking-[0.4em] text-foreground/80">
          WARDROBE
        </p>

        {/* Legal block */}
        <div className="mt-6 space-y-2 text-[11px] leading-[1.7] text-foreground/55">
          <p>© 2026 PND INC. All rights reserved.</p>
          <p className="max-w-md">
            WARDROBE is a proprietary product of PND INC. All intellectual
            property rights, including design, system architecture, branding,
            and technology, are owned by PND INC.
          </p>
        </div>

        {/* Contact + tagline */}
        <div className="mt-6 flex flex-col gap-2 text-[11px] text-foreground/55 md:flex-row md:items-center md:justify-between md:gap-6">
          <a
            href="mailto:mymyon.01@gmail.com"
            className="hover-burgundy w-fit transition-colors"
          >
            Contact: mymyon.01@gmail.com
          </a>
          <p className="text-[10px] tracking-[0.18em] text-foreground/40">
            Built with intelligence. Designed for real-world use.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
