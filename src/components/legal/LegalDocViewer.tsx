/**
 * LegalDocViewer — modal that displays a single legal document with a
 * language switcher across all 8 supported app languages.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLegalDocs } from "@/lib/legal/useLegalDocs";
import { LEGAL_LANGUAGES, LEGAL_LANG_LABEL, toLegalLang, type LegalKey, type LegalLang } from "@/lib/legal/content";
import { useI18n } from "@/lib/i18n";

interface Props {
  docKey: LegalKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LegalDocViewer = ({ docKey, open, onOpenChange }: Props) => {
  const { lang: appLang } = useI18n();
  const initial: LegalLang = toLegalLang(appLang);
  const [lang, setLang] = useState<LegalLang>(initial);
  useEffect(() => { setLang(initial); }, [initial, open]);

  const { docs } = useLegalDocs(lang);
  const doc = docKey ? docs[docKey] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-[15px] font-medium flex-1 pr-6">
              {doc?.title ?? "—"}
            </DialogTitle>
          </div>
          <div className="flex flex-wrap gap-1 pt-2">
            {LEGAL_LANGUAGES.map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`px-2 py-0.5 text-[10px] tracking-[0.14em] font-semibold rounded ${
                  lang === code
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/50 hover:text-foreground/80"
                }`}
              >
                {LEGAL_LANG_LABEL[code]}
              </button>
            ))}
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
