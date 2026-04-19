import { motion } from "framer-motion";

interface Props {
  active?: boolean;
  unseen?: boolean;
  /** Extra outset of the ring beyond the avatar in px. Default 2. */
  inset?: number;
}

/** Reusable gradient + ripple ring used around story avatars. */
const StoryRippleRing = ({ active, unseen, inset = 2 }: Props) => {
  if (!active) return null;
  const offset = `calc(100% + ${inset * 2}px)`;
  const pos = -inset;
  return (
    <>
      <div
        className={`absolute inset-0 rounded-full p-[2px] pointer-events-none ${
          unseen
            ? "bg-gradient-to-tr from-accent via-pink-400 to-amber-300"
            : "bg-foreground/15"
        }`}
        style={{ height: offset, width: offset, top: pos, left: pos }}
      />
      {unseen && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-accent/40 pointer-events-none"
            style={{ height: offset, width: offset, top: pos, left: pos }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="absolute inset-0 rounded-full border border-pink-300/30 pointer-events-none"
            style={{ height: offset, width: offset, top: pos, left: pos }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.55, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
          />
        </>
      )}
    </>
  );
};

export default StoryRippleRing;
