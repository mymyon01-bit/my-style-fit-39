// ─── SHOP LINK RESOLVER ─────────────────────────────────────────────────────
// Product links coming from discovery are frequently Google redirect wrappers
// (google.com/url?q=, /aclk?adurl=, shopping/product/...). Those refuse to load
// inside an app frame ("google.com refused to connect") and sometimes reject
// the click entirely. We unwrap them to the real merchant URL and always open
// the result as a genuine top-level tab (or the system browser on native).

const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;
const REDIRECT_PARAMS = ["adurl", "url", "q", "imgrefurl", "u", "dest"];

/** Unwrap Google/Bing style redirect wrappers down to the merchant URL. */
export function resolveShopUrl(raw?: string | null): string | null {
  let current = raw?.trim();
  if (!current || current === "#") return null;
  if (!/^https?:\/\//i.test(current)) {
    if (/^\/\//.test(current)) current = `https:${current}`;
    else if (/^[\w-]+\.[\w.-]+\//.test(current)) current = `https://${current}`;
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
      // A plain Google page (shopping product, search). It cannot be embedded,
      // but opening it as a real top-level tab works fine.
      return url.toString();
    }
    current = next;
  }
  return current;
}

/**
 * Open a shop link safely from anywhere in the app (preview frame, PWA, or
 * native wrapper). Never navigates the current view.
 */
export async function openShopUrl(raw?: string | null): Promise<boolean> {
  const url = resolveShopUrl(raw);
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

  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) return true;
  } catch {
    /* popup blocked */
  }

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
