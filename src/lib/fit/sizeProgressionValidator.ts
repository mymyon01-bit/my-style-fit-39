// ─── SIZE PROGRESSION VALIDATOR (V3.7) ─────────────────────────────────────
// Validates that a set of try-on results across S/M/L/XL show monotonically
// increasing garment volume on the same body. Flags inversions (e.g. S wider
// than L) so the UI can mark them internally and offer a re-render.

export interface SizeSample {
  size: string;          // "S" | "M" | "L" | "XL" | "XXL"
  imageUrl: string;
}

export interface SizeProgressionReport {
  sizeProgressionScore: number;   // 0..100
  sizeOrderValid: boolean;
  issues: string[];
}

const ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
function rank(s: string) { const i = ORDER.indexOf(s.toUpperCase()); return i === -1 ? 99 : i; }

async function silhouetteVolume(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = 48, H = 64;
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(0);
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;
        // Background = corner luma median.
        const corners: number[] = [];
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
          const i = (y * W + x) * 4;
          corners.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        corners.sort((a, b) => a - b);
        const bg = corners[Math.floor(corners.length / 2)];
        let fg = 0;
        for (let i = 0; i < data.length; i += 4) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (Math.abs(l - bg) > 18) fg++;
        }
        resolve(fg / (W * H));
      } catch { resolve(0); }
    };
    img.onerror = () => resolve(0);
    img.src = url;
  });
}

export async function validateSizeProgression(samples: SizeSample[]): Promise<SizeProgressionReport> {
  const sorted = [...samples].sort((a, b) => rank(a.size) - rank(b.size));
  if (sorted.length < 2) {
    return { sizeProgressionScore: 100, sizeOrderValid: true, issues: [] };
  }
  const volumes: { size: string; v: number }[] = [];
  for (const s of sorted) volumes.push({ size: s.size, v: await silhouetteVolume(s.imageUrl) });

  const issues: string[] = [];
  let inversions = 0;
  for (let i = 1; i < volumes.length; i++) {
    const prev = volumes[i - 1], cur = volumes[i];
    if (cur.v + 0.005 < prev.v) {
      inversions++;
      issues.push(`${cur.size} appears smaller than ${prev.size}`);
    }
  }
  const score = Math.max(0, 100 - inversions * 25);
  return {
    sizeProgressionScore: score,
    sizeOrderValid: inversions === 0,
    issues,
  };
}
