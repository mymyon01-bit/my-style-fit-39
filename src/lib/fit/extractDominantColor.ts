// Lightweight dominant-color extractor for product images.
// Runs in a small offscreen canvas, samples N pixels, returns the average.
// Returns a CSS hex string. Falls back to a neutral on any failure.

const FALLBACK = "#7d7a78";
const cache = new Map<string, string>();

export async function extractDominantColor(url: string): Promise<string> {
  if (!url) return FALLBACK;
  const cached = cache.get(url);
  if (cached) return cached;

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    const w = (canvas.width = 32);
    const h = (canvas.height = 32);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return FALLBACK;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue; // skip transparency
      const rr = data[i], gg = data[i + 1], bb = data[i + 2];
      // skip near-pure-white background pixels
      if (rr > 240 && gg > 240 && bb > 240) continue;
      r += rr; g += gg; b += bb; count++;
    }
    if (!count) return FALLBACK;
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    cache.set(url, hex);
    return hex;
  } catch {
    return FALLBACK;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
