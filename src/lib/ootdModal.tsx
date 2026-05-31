import { createContext, useContext, useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// ============================================================================
// OOTD navigation — legacy "modal" shim.
// ----------------------------------------------------------------------------
// The OOTD modal/diary was removed during the IA restructure (PRODUCTS/FIT/
// FEED/MY). All consumers that used to "open the OOTD modal" now navigate to
// the standalone `/ootd` (FEED) route instead. The hook signature is kept so
// the ~30 call sites continue to work without touching every file.
// ============================================================================

interface OOTDModalContextType {
  /** Always false now — the modal no longer exists. */
  isOpen: boolean;
  /** Navigates to the FEED (/ootd) route. */
  open: () => void;
  close: () => void;
  toggle: () => void;
  navigatedAway: () => void;
}

const OOTDModalContext = createContext<OOTDModalContextType | null>(null);

export const OOTDModalProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  const open = useCallback(() => navigate("/ootd"), [navigate]);
  const close = useCallback(() => { /* no-op — kept for back-compat */ }, []);
  const toggle = useCallback(() => navigate("/ootd"), [navigate]);
  const navigatedAway = useCallback(() => { /* no-op */ }, []);

  const value = useMemo<OOTDModalContextType>(
    () => ({ isOpen: false, open, close, toggle, navigatedAway }),
    [open, close, toggle, navigatedAway]
  );

  return <OOTDModalContext.Provider value={value}>{children}</OOTDModalContext.Provider>;
};

export const useOOTDModal = () => {
  const ctx = useContext(OOTDModalContext);
  if (!ctx) throw new Error("useOOTDModal must be used within OOTDModalProvider");
  return ctx;
};
