/**
 * ConsentCheckboxes — shown in the signup form. Users must accept the two
 * required items (terms + privacy) to be allowed to submit. Marketing is
 * optional. Phone verification is NOT shown here — it's gated at OOTD time.
 *
 * Each row has a small "VIEW" link that opens the LegalDocViewer modal.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import LegalDocViewer from "./LegalDocViewer";
import type { LegalKey } from "@/lib/legal/content";

export interface ConsentState {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

interface Props {
  value: ConsentState;
  onChange: (next: ConsentState) => void;
}

const labels: Record<keyof ConsentState, { en: string; ko: string; required: boolean; docKey: LegalKey }> = {
  terms:     { en: "I agree to the Terms of Service",    ko: "서비스 이용약관 동의",        required: true,  docKey: "terms" },
  privacy:   { en: "I agree to the Privacy Policy",      ko: "개인정보 처리방침 동의",      required: true,  docKey: "privacy" },
  marketing: { en: "Marketing communications (optional)", ko: "마케팅 정보 수신 (선택)",     required: false, docKey: "marketing" },
};

const ConsentCheckboxes = ({ value, onChange }: Props) => {
  const [viewing, setViewing] = useState<LegalKey | null>(null);
  const allRequired = value.terms && value.privacy;

  const toggleAll = () => {
    const next = !allRequired || !value.marketing;
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
          value.terms && value.privacy && value.marketing
            ? "border-accent bg-accent/20"
            : "border-foreground/30"
        }`}>
          {value.terms && value.privacy && value.marketing && <Check className="h-3 w-3 text-accent" />}
        </span>
        <span className="text-[12px] font-medium text-foreground/80">
          Agree to all / 모두 동의
        </span>
      </button>

      {(Object.keys(labels) as (keyof ConsentState)[]).map((key) => {
        const meta = labels[key];
        const checked = value[key];
        return (
          <div key={key} className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...value, [key]: !checked })}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                checked ? "border-accent bg-accent/20" : "border-foreground/25"
              }`}
              aria-label={meta.en}
            >
              {checked && <Check className="h-3 w-3 text-accent" />}
            </button>
            <div className="flex-1 flex items-center justify-between gap-2">
              <label
                onClick={() => onChange({ ...value, [key]: !checked })}
                className="text-[12px] text-foreground/75 cursor-pointer leading-tight"
              >
                <span className={`text-[9px] font-bold tracking-[0.18em] mr-1.5 ${meta.required ? "text-destructive/80" : "text-foreground/40"}`}>
                  [{meta.required ? "REQUIRED" : "OPTIONAL"}]
                </span>
                {meta.en}
                <span className="text-foreground/45"> · {meta.ko}</span>
              </label>
              <button
                type="button"
                onClick={() => setViewing(meta.docKey)}
                className="text-[9px] font-semibold tracking-[0.18em] text-accent/65 hover:text-accent transition-colors shrink-0"
              >
                VIEW
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
