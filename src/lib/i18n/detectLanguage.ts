/**
 * Lightweight script detection — no API call. Returns the best-guess ISO
 * language for a piece of user-generated text by inspecting which Unicode
 * script ranges dominate. Used to decide when to show a "Translate" CTA.
 *
 * Limitations: cannot distinguish Spanish vs French vs English vs German
 * from Latin-only text. For those we treat it as "latin" and the caller
 * decides if a translate button is meaningful.
 */
export type DetectedLang =
  | "ko"
  | "ja"
  | "zh"
  | "ar"
  | "ru"
  | "th"
  | "hi"
  | "latin"
  | "unknown";

export function detectLanguage(text: string): DetectedLang {
  if (!text || text.trim().length < 2) return "unknown";
  const counts: Record<DetectedLang, number> = {
    ko: 0, ja: 0, zh: 0, ar: 0, ru: 0, th: 0, hi: 0, latin: 0, unknown: 0,
  };
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0xac00 && code <= 0xd7af) counts.ko++;
    else if (code >= 0x1100 && code <= 0x11ff) counts.ko++;
    else if (code >= 0x3040 && code <= 0x30ff) counts.ja++;
    else if (code >= 0x4e00 && code <= 0x9fff) counts.zh++; // CJK — also used by ja/ko but they have script signals first
    else if (code >= 0x0600 && code <= 0x06ff) counts.ar++;
    else if (code >= 0x0400 && code <= 0x04ff) counts.ru++;
    else if (code >= 0x0e00 && code <= 0x0e7f) counts.th++;
    else if (code >= 0x0900 && code <= 0x097f) counts.hi++;
    else if ((code >= 0x0041 && code <= 0x007a) || (code >= 0x00c0 && code <= 0x024f)) counts.latin++;
  }
  // If any kana present → Japanese; else if Hangul → Korean; else Han → Chinese.
  if (counts.ja > 0) return "ja";
  if (counts.ko > 0) return "ko";
  if (counts.zh > 0) return "zh";
  let best: DetectedLang = "unknown";
  let bestN = 0;
  (Object.keys(counts) as DetectedLang[]).forEach((k) => {
    if (counts[k] > bestN) { best = k; bestN = counts[k]; }
  });
  return best;
}

/**
 * True if `text` looks like it's in a different language than the user's
 * current UI language. Avoids false positives on emoji-only / numeric / very
 * short strings, and on Latin-script-only text when the UI is also Latin.
 */
export function shouldOfferTranslate(text: string, uiLang: string): boolean {
  const det = detectLanguage(text);
  if (det === "unknown") return false;
  if (det === "latin") {
    // We can't reliably tell EN vs ES vs FR; only offer if UI is non-latin.
    return ["ko", "ja", "zh"].includes(uiLang);
  }
  return det !== uiLang;
}
