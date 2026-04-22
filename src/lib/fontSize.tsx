import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type FontSize = "small" | "medium" | "large";

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType | null>(null);

const STORAGE_KEY = "wardrobe-fontsize";

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "medium";
    const saved = localStorage.getItem(STORAGE_KEY) as FontSize | null;
    return saved || "medium";
  });

  const setFontSize = useCallback((s: FontSize) => {
    setFontSizeState(s);
    try { localStorage.setItem(STORAGE_KEY, s); } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-fontsize", fontSize);
  }, [fontSize]);

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const ctx = useContext(FontSizeContext);
  if (!ctx) throw new Error("useFontSize must be used within FontSizeProvider");
  return ctx;
};
