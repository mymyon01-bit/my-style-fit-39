import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { shouldOfferTranslate } from "@/lib/i18n/detectLanguage";

interface Props {
  text: string;
  /** Optional className for the button container. */
  className?: string;
}

const TRANSLATE_LABEL: Record<string, string> = {
  en: "Translate",
  ko: "번역하기",
  ja: "翻訳する",
  zh: "翻译",
  es: "Traducir",
  fr: "Traduire",
  de: "Übersetzen",
  it: "Traduci",
};

const ORIGINAL_LABEL: Record<string, string> = {
  en: "Show original",
  ko: "원문 보기",
  ja: "原文を表示",
  zh: "显示原文",
  es: "Ver original",
  fr: "Voir l'original",
  de: "Original anzeigen",
  it: "Mostra originale",
};

const ERROR_LABEL: Record<string, string> = {
  en: "Translation failed",
  ko: "번역 실패",
  ja: "翻訳に失敗しました",
  zh: "翻译失败",
  es: "Error de traducción",
  fr: "Échec de la traduction",
  de: "Übersetzung fehlgeschlagen",
  it: "Traduzione fallita",
};

/**
 * Inline "Translate" CTA shown beneath user-generated text (notification
 * actor names, message content, comments, etc.) when the text is in a
 * language different from the viewer's UI language. Tapping it calls our
 * `translate-text` edge function and replaces the text in place. A
 * second tap reveals the original.
 */
export default function TranslateButton({ text, className = "" }: Props) {
  const { lang } = useI18n();
  const [translation, setTranslation] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  if (!shouldOfferTranslate(text, lang)) return null;

  const onClick = async () => {
    setError(false);
    if (translation) {
      setShowing((s) => !s);
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("translate-text", {
        body: { text, target_lang: lang },
      });
      if (err || !data?.translation) throw err || new Error("empty");
      setTranslation(data.translation);
      setShowing(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {showing && translation && (
        <p className="mb-1 whitespace-pre-wrap break-words text-[11px] text-foreground/85">
          {translation}
        </p>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-accent/80 hover:text-accent transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Languages className="h-2.5 w-2.5" />}
        <span>
          {error
            ? ERROR_LABEL[lang] || ERROR_LABEL.en
            : showing
              ? ORIGINAL_LABEL[lang] || ORIGINAL_LABEL.en
              : TRANSLATE_LABEL[lang] || TRANSLATE_LABEL.en}
        </span>
      </button>
    </div>
  );
}
