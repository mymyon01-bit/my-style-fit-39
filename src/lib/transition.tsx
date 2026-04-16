import React, { createContext, useContext, useState, useCallback } from "react";

export type TransitionStyle = "none" | "vertical" | "fade" | "split";

interface TransitionContextType {
  transition: TransitionStyle;
  setTransition: (t: TransitionStyle) => void;
  transitionClass: string;
}

const TransitionContext = createContext<TransitionContextType | null>(null);

const classMap: Record<TransitionStyle, string> = {
  none: "",
  vertical: "page-enter-vertical",
  fade: "page-enter-fade",
  split: "page-enter-split",
};

export const TransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transition, setTransitionState] = useState<TransitionStyle>(() => {
    const saved = localStorage.getItem("wardrobe-transition");
    return (saved as TransitionStyle) || "none";
  });

  const setTransition = useCallback((t: TransitionStyle) => {
    setTransitionState(t);
    localStorage.setItem("wardrobe-transition", t);
  }, []);

  const transitionClass = classMap[transition];

  return (
    <TransitionContext.Provider value={{ transition, setTransition, transitionClass }}>
      {children}
    </TransitionContext.Provider>
  );
};

export const useTransition = () => {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error("useTransition must be used within TransitionProvider");
  return ctx;
};
