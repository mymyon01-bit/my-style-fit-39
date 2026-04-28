/**
 * CountUp — animated counter that smoothly tweens to the target value and
 * renders using the shared formatCount helper (K / M abbreviations) so every
 * stat in the app reads consistently.
 */
import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { formatCount } from "@/lib/formatCount";

interface Props {
  value: number;
  duration?: number;
  className?: string;
  /** When true (default) abbreviate large numbers as K / M. */
  format?: boolean;
}

const CountUp = ({ value, duration = 0.6, className, format = true }: Props) => {
  const safeTarget = Math.max(0, Math.floor(Number(value) || 0));
  const [display, setDisplay] = useState(safeTarget);

  useEffect(() => {
    const controls = animate(display, safeTarget, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTarget]);

  return <span className={className}>{format ? formatCount(display) : display}</span>;
};

export default CountUp;
