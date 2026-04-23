/**
 * Footer — minimal premium PND INC mark.
 *
 * Left side also exposes a discreet "AFFILIATE / AD" entry that opens the
 * shared CONTACT US dialog (mail to mymyon.01@gmail.com is hidden from UI).
 */
import { useState } from "react";
import Brandmark from "@/components/Brandmark";
import ContactUsDialog from "@/components/ContactUsDialog";

const Footer = () => {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <footer className="hidden md:block border-t border-border/30 bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1 px-6 py-3 text-[10px] text-foreground/55 md:flex-row md:gap-4">
        <div className="flex items-center gap-3">
          <Brandmark variant="inline" className="text-[14px]" />
          <span className="text-foreground/20">·</span>
          <button
            onClick={() => setContactOpen(true)}
            className="text-[9px] font-semibold tracking-[0.22em] text-foreground/45 transition-colors hover:text-accent"
          >
            AFFILIATE / AD
          </button>
        </div>
        <p className="text-foreground/50">© 2026 PND INC.</p>
        <a
          href="mailto:mymyon.01@gmail.com"
          className="hover-burgundy transition-colors"
        >
          mymyon.01@gmail.com
        </a>
      </div>
      <ContactUsDialog open={contactOpen} onOpenChange={setContactOpen} topic="Affiliate / Ad" />
    </footer>
  );
};

export default Footer;
