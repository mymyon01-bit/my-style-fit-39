/**
 * Footer — minimal premium PND INC mark.
 *
 * Used on Homepage, About, and Settings only. Intentionally no nav links,
 * no social icons, no newsletter form — just legal mark + contact.
 */
const Footer = () => {
  return (
    <footer className="border-t border-border/30 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1 px-6 py-3 text-[10px] text-foreground/55 md:flex-row md:gap-4">
        <p className="font-display font-semibold tracking-[0.3em] text-foreground/75">
          WARDROBE
        </p>
        <p className="text-foreground/50">© 2026 PND INC.</p>
        <a
          href="mailto:mymyon.01@gmail.com"
          className="hover-burgundy transition-colors"
        >
          mymyon.01@gmail.com
        </a>
      </div>
    </footer>
  );
};

export default Footer;
