/**
 * Footer — minimal premium PND INC mark.
 */
import Brandmark from "@/components/Brandmark";

const Footer = () => {
  return (
    <footer className="hidden md:block border-t border-border/30 bg-background">
      <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-10 text-[10px] text-foreground/55">
        <Brandmark variant="inline" className="!h-6" />
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
