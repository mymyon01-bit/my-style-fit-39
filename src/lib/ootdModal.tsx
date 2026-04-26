import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface OOTDModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const OOTDModalContext = createContext<OOTDModalContextType | null>(null);

export const OOTDModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <OOTDModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </OOTDModalContext.Provider>
  );
};

export const useOOTDModal = () => {
  const ctx = useContext(OOTDModalContext);
  if (!ctx) throw new Error("useOOTDModal must be used within OOTDModalProvider");
  return ctx;
};
