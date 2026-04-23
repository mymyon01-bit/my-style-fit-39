/**
 * recordConsent — inserts user_consents rows after signup.
 * Called from the signup flow once the user has an authenticated session.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ConsentState } from "@/components/legal/ConsentCheckboxes";
import type { LegalLang } from "./content";

export async function recordSignupConsents(
  userId: string,
  consents: ConsentState,
  language: LegalLang,
): Promise<void> {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const rows = (Object.keys(consents) as (keyof ConsentState)[]).map((key) => ({
    user_id: userId,
    consent_type: key,
    granted: consents[key],
    document_version: 1,
    language,
    user_agent: userAgent,
  }));
  await supabase.from("user_consents").insert(rows);
}

export async function recordPhoneConsent(userId: string, language: LegalLang): Promise<void> {
  await supabase.from("user_consents").insert({
    user_id: userId,
    consent_type: "phone",
    granted: true,
    document_version: 1,
    language,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
}
