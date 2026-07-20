/**
 * ConsentCheckboxes — bilingual-aware consent block for the signup form
 * and the post-OAuth ConsentGate. Labels adapt to the current app language
 * (all 8 supported languages).
 */
import { useState } from "react";
import { Check } from "lucide-react";
import LegalDocViewer from "./LegalDocViewer";
import { CONSENT_UI, toLegalLang, type LegalKey } from "@/lib/legal/content";
import { useI18n } from "@/lib/i18n";

export interface ConsentState {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

interface Props {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
}

const ROWS: { key: keyof ConsentState; required: boolean; docKey: LegalKey }[] = [
  { key: "terms",     required: true,  docKey: "terms" },
  { key: "privacy",   required: true,  docKey: "privacy" },
  { key: "marketing", required: false, docKey: "marketing" },
];

const ConsentCheckboxes = ({ value, onChange }: Props) => {
  const { lang } = useI18n();
  const ui = CONSENT_UI[toLegalLang(lang)];
  const [viewing, setViewing] = useState<LegalKey | null>(null);
  const allChecked = value.terms && value.privacy && value.marketing;

  const toggleAll = () => {
    const next = !allChecked;
    onChange({ terms: next, privacy: next, marketing: next });
  };

  return (
    <div className="space-y-3 pt-2">
      <button
        type="button"
        onClick={toggleAll}
        className="flex w-full items-center gap-3 border-b border-foreground/[0.08] pb-3 text-left"
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded border ${
          allChecked ? "border-accent bg-accent/20" : "border-foreground/30"
        }`}>
          {allChecked && <Check className="h-3 w-3 text-accent" />}
        </span>
        <span className="text-[12px] font-medium text-foreground/80">{ui.agreeAll}</span>
      </button>

      {ROWS.map(({ key, required, docKey }) => {
        const checked = value[key];
        const label = ui[key];
        return (
          <div key={key} className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...value, [key]: !checked })}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                checked ? "border-accent bg-accent/20" : "border-foreground/25"
              }`}
              aria-label={label}
            >
              {checked && <Check className="h-3 w-3 text-accent" />}
            </button>
            <div className="flex-1 flex items-center justify-between gap-2">
              <label
                onClick={() => onChange({ ...value, [key]: !checked })}
                className="text-[12px] text-foreground/75 cursor-pointer leading-tight"
              >
                <span className={`text-[9px] font-bold tracking-[0.18em] mr-1.5 ${required ? "text-destructive/80" : "text-foreground/40"}`}>
                  [{required ? ui.required : ui.optional}]
                </span>
                {label}
              </label>
              <button
                type="button"
                onClick={() => setViewing(docKey)}
                className="text-[9px] font-semibold tracking-[0.18em] text-accent/65 hover:text-accent transition-colors shrink-0"
              >
                {ui.view}
              </button>
            </div>
          </div>
        );
      })}

      <LegalDocViewer
        docKey={viewing}
        open={viewing !== null}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
      />
    </div>
  );
};

export default ConsentCheckboxes;
