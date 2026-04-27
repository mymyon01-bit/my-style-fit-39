/**
 * CountUp — animated integer counter using framer-motion.
 * Smoothly tweens from previous value to the new value.
 */
import { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface Props {
  value: number;
  duration?: number;
  className?: string;
}

const CountUp = ({ value, duration = 0.6, className }: Props) => {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(display, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{display}</span>;
};

export default CountUp;
