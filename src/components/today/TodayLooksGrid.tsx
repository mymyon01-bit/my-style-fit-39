import { motion } from "framer-motion";
import type { TodayLook } from "@/lib/today/generateLooks";
import { Share2, Sparkles } from "lucide-react";

interface Props {
  looks: TodayLook[];
  onShareToOOTD: (look: TodayLook) => void;
  onTry: (look: TodayLook) => void;
}

export default function TodayLooksGrid({ looks, onShareToOOTD, onTry }: Props) {
  return (
    <div className="space-y-4">
      {looks.map((look, i) => (
        <motion.article
          key={look.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-5 md:p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-accent/80 mb-1.5">LOOK {i + 1}</p>
              <h3 className="font-display text-lg text-foreground/90 md:text-xl">{look.title}</h3>
              <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/55 mt-1">{look.vibe}</p>
            </div>
            <div className="flex gap-1.5">
              {look.pieces.slice(0, 4).map((p, idx) => (
                <div
                  key={idx}
                  className="h-7 w-7 rounded-full border border-foreground/10"
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {look.pieces.map((p) => (
              <div key={p.category} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-[12.5px] text-foreground/75">{p.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-foreground/45">{p.category}</span>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] leading-[1.8] text-foreground/65 mb-5">{look.reason}</p>

          <div className="flex gap-5 pt-2 border-t border-foreground/5">
            <button
              onClick={() => onTry(look)}
              className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.2em] text-foreground/55 hover:text-foreground/90 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> TRY LOOK
            </button>
            <button
              onClick={() => onShareToOOTD(look)}
              className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.2em] text-foreground/55 hover:text-accent transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> SHARE TO OOTD
            </button>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
