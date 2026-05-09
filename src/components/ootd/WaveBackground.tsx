/**
 * Animated graphic background for waves. Renders behind content with
 * pointer-events disabled. Type controls the visual style.
 */
interface Props {
  type: string | null | undefined;
  c1?: string | null;
  c2?: string | null;
}

const DEFAULT_C1 = "hsl(330 85% 60%)";
const DEFAULT_C2 = "hsl(280 70% 55%)";

export default function WaveBackground({ type, c1, c2 }: Props) {
  const a = c1 || DEFAULT_C1;
  const b = c2 || DEFAULT_C2;
  const t = type || "none";
  if (t === "none") return null;

  return (
    <>
      <style>{`
        @keyframes wbgShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes wbgBlobA { 0%,100%{transform:translate(-10%,-10%) scale(1)} 50%{transform:translate(15%,10%) scale(1.25)} }
        @keyframes wbgBlobB { 0%,100%{transform:translate(15%,20%) scale(1.1)} 50%{transform:translate(-15%,-5%) scale(0.9)} }
        @keyframes wbgBlobC { 0%,100%{transform:translate(20%,-15%) scale(1)} 50%{transform:translate(-10%,15%) scale(1.2)} }
        @keyframes wbgRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes wbgFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-30px)} }
        .wbg-aurora { background-size: 220% 220%; animation: wbgShift 12s ease-in-out infinite; filter: blur(40px); opacity: .55; }
        .wbg-blob   { position:absolute; border-radius:9999px; filter: blur(60px); opacity:.55; will-change: transform; }
        .wbg-grid   { background-image: linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px); background-size: 40px 40px; opacity:.10; animation: wbgFloat 9s ease-in-out infinite; }
        .wbg-rays   { animation: wbgRotate 40s linear infinite; opacity:.35; }
      `}</style>

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {t === "aurora" && (
          <div className="wbg-aurora absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${a}, ${b}, ${a})` }} />
        )}

        {t === "blobs" && (
          <>
            <div className="wbg-blob" style={{ background: a, width: "55%", height: "55%", left: "-10%", top: "-10%", animation: "wbgBlobA 14s ease-in-out infinite" }} />
            <div className="wbg-blob" style={{ background: b, width: "60%", height: "60%", right: "-15%", top: "30%", animation: "wbgBlobB 18s ease-in-out infinite" }} />
            <div className="wbg-blob" style={{ background: a, width: "45%", height: "45%", left: "30%", bottom: "-20%", animation: "wbgBlobC 16s ease-in-out infinite" }} />
          </>
        )}

        {t === "rays" && (
          <div className="wbg-rays absolute inset-[-50%]"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${a} 0deg 8deg, transparent 8deg 24deg, ${b} 24deg 32deg, transparent 32deg 48deg)`,
              filter: "blur(30px)",
            }} />
        )}

        {t === "grid" && (
          <>
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${a}, ${b})`, opacity: 0.18 }} />
            <div className="wbg-grid absolute inset-0" style={{ color: a }} />
          </>
        )}

        {t === "shimmer" && (
          <div className="absolute inset-0"
            style={{
              background: `linear-gradient(120deg, ${a} 0%, ${b} 50%, ${a} 100%)`,
              backgroundSize: "300% 100%",
              animation: "wbgShift 6s ease-in-out infinite",
              opacity: 0.45,
              filter: "blur(20px)",
            }} />
        )}
      </div>
    </>
  );
}

export const WAVE_BG_OPTIONS: { id: string; label: string }[] = [
  { id: "none",    label: "None" },
  { id: "aurora",  label: "Aurora" },
  { id: "blobs",   label: "Blobs" },
  { id: "shimmer", label: "Shimmer" },
  { id: "rays",    label: "Rays" },
  { id: "grid",    label: "Grid" },
];
