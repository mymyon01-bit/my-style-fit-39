// ── SELECTED PRODUCT CARD ──────────────────────────────────────────────────
// Premium "this is the exact item being fitted" card. Reused in CHECK and
// RESULTS so the user feels carried-through from Discover.
//
// Layout:
//   [ thumbnail 96x120 ]   BRAND
//                          Product title
//                          category · subcategory
//                          $price
//                          [ source pill ]   [ change → ]

import { ArrowLeftRight, ExternalLink, ShieldCheck } from "lucide-react";
import SafeImage from "@/components/SafeImage";

interface SelectedProductCardProps {
  brand: string;
  name: string;
  price?: number | null;
  image?: string | null;
  url?: string | null;
  category?: string | null;
  subcategory?: string | null;
  source?: string | null;          // e.g. "musinsa.com" or "DEMO"
  dataQuality?: number | null;     // 0..100
  onChange?: () => void;           // "Change product"
  changeLabel?: string;            // override "Change"
  className?: string;
  compact?: boolean;               // tighter for RESULTS top
}

function hostFromUrl(url?: string | null): string | null {
  if (!url || url === "#") return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export default function SelectedProductCard({
  brand, name, price, image, url, category, subcategory,
  source, dataQuality, onChange, changeLabel = "Change", className, compact,
}: SelectedProductCardProps) {
  const host = source ?? hostFromUrl(url);
  const thumbH = compact ? "h-24" : "h-28";
  const thumbW = compact ? "w-[76px]" : "w-[88px]";

  return (
    <div className={`group rounded-2xl border border-foreground/[0.07] bg-card/50 p-4 transition-colors hover:border-foreground/[0.14] ${className ?? ""}`}>
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className={`relative ${thumbH} ${thumbW} shrink-0 overflow-hidden rounded-xl bg-foreground/[0.04] ring-1 ring-foreground/[0.05]`}>
          {image ? (
            <SafeImage
              src={image}
              alt={name}
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full flex items-center justify-center text-foreground/40 font-display text-2xl"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-2xl text-foreground/40">
              {name.charAt(0)}
            </div>
          )}
        </div>

        {/* Text block */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55 uppercase truncate">
            {brand || "—"}
          </p>
          <h3 className="mt-1 font-display text-[15px] font-semibold leading-snug text-foreground line-clamp-2">
            {name}
          </h3>

          {(category || subcategory) && (
            <p className="mt-1 text-[11px] text-foreground/55 truncate">
              {[category, subcategory].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            {Number.isFinite(price as number) && (price as number) > 0 && (
              <span className="font-display text-base font-semibold text-foreground">
                ${price}
              </span>
            )}
            {host && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] font-medium tracking-wide text-foreground/65">
                {host}
              </span>
            )}
            {typeof dataQuality === "number" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground/45">
                <ShieldCheck className="h-2.5 w-2.5" />{dataQuality}/100
              </span>
            )}
          </div>

          {/* Action row */}
          {(onChange || (url && url !== "#")) && (
            <div className="mt-3 flex items-center gap-3">
              {onChange && (
                <button
                  type="button"
                  onClick={onChange}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/12 bg-background/60 px-3 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-foreground/80 transition-colors hover:border-foreground/30"
                >
                  <ArrowLeftRight className="h-3 w-3" /> {changeLabel.toUpperCase()}
                </button>
              )}
              {url && url !== "#" && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-foreground/55 hover:text-foreground/85"
                >
                  View <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
