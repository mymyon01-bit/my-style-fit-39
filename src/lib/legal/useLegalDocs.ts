/**
 * useLegalDocs — fetches the current legal documents from the
 * `legal_documents` table for a given language. Falls back to the static
 * bundled copy if the network is unavailable.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LEGAL_FALLBACK, type LegalKey, type LegalLang, type LegalDoc } from "./content";

export interface LegalRecord extends LegalDoc {
  doc_key: LegalKey;
  language: LegalLang;
  version: number;
}

export function useLegalDocs(language: LegalLang) {
  const [docs, setDocs] = useState<Record<LegalKey, LegalRecord>>(() => buildFallback(language));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("legal_documents")
        .select("doc_key, language, version, title, body, is_current")
        .eq("language", language)
        .eq("is_current", true);

      if (cancelled) return;
      if (!error && data && data.length > 0) {
        const map = buildFallback(language);
        for (const row of data) {
          map[row.doc_key as LegalKey] = {
            doc_key: row.doc_key as LegalKey,
            language: row.language as LegalLang,
            version: row.version,
            title: row.title,
            body: row.body,
          };
        }
        setDocs(map);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [language]);

  return { docs, loading };
}

function buildFallback(language: LegalLang): Record<LegalKey, LegalRecord> {
  const out = {} as Record<LegalKey, LegalRecord>;
  (Object.keys(LEGAL_FALLBACK) as LegalKey[]).forEach((k) => {
    out[k] = { doc_key: k, language, version: 1, ...LEGAL_FALLBACK[k][language] };
  });
  return out;
}
