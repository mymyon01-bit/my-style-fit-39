/**
 * LegalDocViewer — modal that displays a single legal document with
 * KR / EN / IT toggle. Used from the consent checkbox links.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLegalDocs } from "@/lib/legal/useLegalDocs";
import type { LegalKey, LegalLang } from "@/lib/legal/content";
import { useI18n } from "@/lib/i18n";

interface Props {
  docKey: LegalKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGS: { code: LegalLang; label: string }[] = [
  { code: "ko", label: "KR" },
  { code: "en", label: "EN" },
  { code: "it", label: "IT" },
];

const LegalDocViewer = ({ docKey, open, onOpenChange }: Props) => {
  const { lang: appLang } = useI18n();
  const initial: LegalLang = appLang === "ko" || appLang === "it" ? appLang : "en";
  const [lang, setLang] = useState<LegalLang>(initial);
  useEffect(() => { setLang(initial); }, [initial, open]);

  const { docs } = useLegalDocs(lang);
  const doc = docKey ? docs[docKey] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px] font-medium">
              {doc?.title ?? "—"}
            </DialogTitle>
            <div className="flex gap-1 mr-6">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`px-2 py-0.5 text-[10px] tracking-[0.18em] font-semibold rounded ${
                    lang === l.code
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto pr-2">
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-[1.7] text-foreground/85">
            {doc?.body ?? ""}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LegalDocViewer;
