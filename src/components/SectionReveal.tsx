/**
 * SectionReveal — gentle fade + translateY when a section enters the
 * viewport. IntersectionObserver based, runs once per element. Honors
 * prefers-reduced-motion (component is a no-op visually in that case).
 *
 * Use as a wrapper around a section/div you want to "slide into place"
 * as the user scrolls. Keep the wrapper light — no extra DOM otherwise.
 */
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Extra classes for the wrapper (layout, spacing, etc). */
  className?: string;
  /** Optional one-shot delay in ms applied via inline style. */
  delay?: number;
}

const SectionReveal = ({ children, className = "", delay = 0 }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion: just show it, no observer.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      el.classList.add("section-revealed");
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("section-revealed");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`section-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

export default SectionReveal;
