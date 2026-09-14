/**
 * Measures a fixed bottom bar and publishes its real pixel height (including
 * its own safe-area padding) into a CSS variable on <html>.
 *
 * Why: hardcoded bar heights never match every phone — iPhone home-indicator
 * insets, Android gesture bars, larger system font sizes and the notch all
 * change the rendered height, so content was either clipped by the bar or
 * floated above it. Pages pad with the variable alone, so the spacing is
 * always exactly the bar height on every device.
 */
import { useEffect, useRef } from "react";

export const useBarHeightVar = <T extends HTMLElement>(
  varName: string,
  active = true,
) => {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.style.setProperty(varName, "0px");
      return () => root.style.removeProperty(varName);
    }

    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty(varName, `${h}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", apply);
      vv?.removeEventListener("resize", apply);
      root.style.removeProperty(varName);
    };
  }, [varName, active]);

  return ref;
};
