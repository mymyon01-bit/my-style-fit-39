import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface OutfitPiece {
  id: string;
  label: string;
  category: string;
  image: string;
  brand: string;
}

interface OutfitCompositionProps {
  pieces: OutfitPiece[];
  caption: string;
  tags?: string[];
}

const OutfitComposition = ({ pieces, caption, tags }: OutfitCompositionProps) => {
  const navigate = useNavigate();
  const [tapped, setTapped] = useState<string | null>(null);

  const handleTap = (piece: OutfitPiece) => {
    setTapped(piece.id);
    setTimeout(() => {
      navigate(`/discover?category=${piece.category}`);
    }, 300);
  };

  // Floating grid positions — asymmetric, editorial
  const positions = [
    { top: "0%", left: "5%", width: "52%", delay: 0.1 },     // Top (main piece)
    { top: "2%", left: "60%", width: "38%", delay: 0.2 },    // Outerwear/accessory
    { top: "52%", left: "8%", width: "42%", delay: 0.3 },    // Bottom
    { top: "55%", left: "54%", width: "40%", delay: 0.4 },   // Shoes
  ];

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Outfit grid */}
      <div className="relative aspect-[3/4] w-full">
        {/* Glow backdrop */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-accent/[0.03] via-transparent to-accent/[0.02]" />

        {pieces.map((piece, i) => {
          const pos = positions[i] || positions[0];
          const isActive = tapped === piece.id;

          return (
            <motion.button
              key={piece.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isActive ? 1.05 : 1,
              }}
              transition={{
                delay: pos.delay,
                duration: 0.5,
                ease: [0.23, 1, 0.32, 1],
              }}
              whileTap={{ scale: 1.06 }}
              onClick={() => handleTap(piece)}
              className="absolute overflow-hidden rounded-2xl"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
              }}
            >
              {/* Image */}
              <div className="relative overflow-hidden rounded-2xl shadow-[0_8px_30px_-8px_hsl(0_0%_0%_/_0.25)]">
                <img
                  src={piece.image}
                  alt={piece.label}
                  className="aspect-[3/4] w-full object-cover"
                />
                {/* Subtle light sweep */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 3, delay: pos.delay + 1, repeat: Infinity, repeatDelay: 8 }}
                />
                {/* Bottom label */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2.5 pt-8">
                  <p className="text-[9px] font-semibold tracking-[0.15em] text-white/70">{piece.brand}</p>
                  <p className="text-[11px] font-medium text-white/90">{piece.label}</p>
                </div>
                {/* Tap highlight */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 rounded-2xl ring-2 ring-accent/60"
                  />
                )}
              </div>
            </motion.button>
          );
        })}

        {/* Connecting lines between pieces */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-[0.06]" viewBox="0 0 100 100">
          <motion.line
            x1="30" y1="48" x2="28" y2="55"
            stroke="currentColor"
            strokeWidth="0.3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          />
          <motion.line
            x1="75" y1="45" x2="72" y2="58"
            stroke="currentColor"
            strokeWidth="0.3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
          />
        </svg>
      </div>

      {/* Caption */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-4 text-center"
      >
        <p className="font-display text-sm font-light leading-relaxed tracking-wide text-foreground/80">
          {caption}
        </p>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="mt-3 flex justify-center gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="rounded-full bg-foreground/[0.04] px-2.5 py-0.5 text-[9px] font-medium tracking-[0.1em] text-foreground/80"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OutfitComposition;
