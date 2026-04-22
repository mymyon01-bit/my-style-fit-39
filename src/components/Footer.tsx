/**
 * Footer — minimal premium PND INC mark.
 */
import Brandmark from "@/components/Brandmark";

const Footer = () => {
  return (
    <footer className="hidden md:block border-t border-border/30 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1 px-6 py-3 text-[10px] text-foreground/55 md:flex-row md:gap-4">
        <Brandmark variant="inline" className="text-[14px]" />
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
