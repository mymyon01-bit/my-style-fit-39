// ─── SHOP LINK RESOLVER ─────────────────────────────────────────────────────
// Product links coming from discovery are frequently Google redirect wrappers
// (google.com/url?q=, /aclk?adurl=, shopping/product/...). Those refuse to load
// inside an app frame ("google.com refused to connect") and sometimes reject
// the click entirely. We unwrap them to the real merchant URL and always open
// the result as a genuine top-level tab (or the system browser on native).

const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;
const REDIRECT_PARAMS = ["adurl", "url", "q", "imgrefurl", "u", "dest"];

export interface ShopLinkContext {
  productName?: string | null;
  merchant?: string | null;
}

const MERCHANT_DOMAINS: Record<string, string> = {
  "net-a-porter": "net-a-porter.com",
  "net-a-porter.com": "net-a-porter.com",
  nordstrom: "nordstrom.com",
  farfetch: "farfetch.com",
  ssense: "ssense.com",
  asos: "asos.com",
  ssg: "ssg.com",
  coach: "coach.com",
  fwrd: "fwrd.com",
  "keds.com": "keds.com",
  skechers: "skechers.com",
  "skechers.com": "skechers.com",
  "nunn bush shoes": "nunnbush.com",
  "pants store": "pantsstore.com",
  "penner's": "pennersinc.com",
};

function merchantSearchUrl(context?: ShopLinkContext): string | null {
  const merchant = context?.merchant?.trim().toLowerCase();
  const productName = context?.productName?.trim();
  if (!merchant || !productName) return null;

  const dotted = merchant.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const mapped = MERCHANT_DOMAINS[merchant] ?? MERCHANT_DOMAINS[merchant.replace(/\.com$/, "")];
  const domain = mapped ?? (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(dotted) ? dotted : null);
  if (!domain) return null;
  return `https://${domain}/search?q=${encodeURIComponent(productName)}`;
}

/** Unwrap Google/Bing style redirect wrappers down to the merchant URL. */
export function resolveShopUrl(raw?: string | null, context?: ShopLinkContext): string | null {
  let current = raw?.trim();
  if (!current || current === "#") return null;
  if (!/^https?:\/\//i.test(current)) {
    if (/^\/\//.test(current)) current = `https:${current}`;
    else if (/^[\w-]+\.[\w.-]+(?:\/|$)/.test(current)) current = `https://${current}`;
    else return null;
  }

  for (let hop = 0; hop < 4; hop++) {
    let url: URL;
    try {
      url = new URL(current);
    } catch {
      return null;
    }

    if (!GOOGLE_HOST.test(url.hostname)) return url.toString();

    // Redirect wrapper → follow the embedded target.
    let next: string | null = null;
    for (const key of REDIRECT_PARAMS) {
      const value = url.searchParams.get(key);
      if (value && /^https?:\/\//i.test(value)) {
        next = value;
        break;
      }
    }
    if (!next) {
      // A Google Shopping page is not a merchant destination. Never send a
      // shopper back to Google: use the merchant's own site when known, and
      // otherwise fail closed so callers can hide/disable the action.
      return merchantSearchUrl(context);
    }
    current = next;
  }
  return current;
}

/**
 * Open a shop link safely from anywhere in the app (preview frame, PWA, or
 * native wrapper). Never navigates the current view.
 */
export async function openShopUrl(raw?: string | null, context?: ShopLinkContext): Promise<boolean> {
  const url = resolveShopUrl(raw, context);
  if (!url) return false;

  // Native wrapper → system browser.
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return true;
    }
  } catch {
    /* fall through to web */
  }

  // Use a real user-initiated anchor on web. Embedded previews and app
  // wrappers handle this more reliably than window.open, which can be routed
  // back into the current iframe and trigger Google's X-Frame-Options page.
  try {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer external";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    /* fall through */
  }

  // Never load a Google page inside an embedded frame — Google sends
  // X-Frame-Options, which surfaces as "ERR_BLOCKED_BY_RESPONSE".
  const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
  if (inFrame && GOOGLE_HOST.test(new URL(url).hostname)) return false;

  // Last resort: break out of any embedding frame instead of loading the
  // merchant page inside it (that is what triggers "refused to connect").
  try {
    (window.top ?? window).location.href = url;
    return true;
  } catch {
    window.location.href = url;
    return true;
  }
}
