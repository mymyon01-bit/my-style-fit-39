import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";

// ============================================================================
// OOTD Modal — single source of truth
// ----------------------------------------------------------------------------
// All consumers (BottomNav, DesktopNav, OOTDDiaryButton, OOTDModalHost, etc.)
// share this one Context. Internally backed by useReducer so future actions
// (e.g. "navigatedAway", "forceClose") can be added without breaking callers.
// ============================================================================

type OOTDModalState = {
  isOpen: boolean;
};

type OOTDModalAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "toggle" }
  | { type: "navigatedAway" };

const initialState: OOTDModalState = { isOpen: false };

function reducer(state: OOTDModalState, action: OOTDModalAction): OOTDModalState {
  switch (action.type) {
    case "open":
      return state.isOpen ? state : { isOpen: true };
    case "close":
      return state.isOpen ? { isOpen: false } : state;
    case "toggle":
      return { isOpen: !state.isOpen };
    case "navigatedAway":
      // Only close if currently open — avoids needless re-renders
      return state.isOpen ? { isOpen: false } : state;
    default:
      return state;
  }
}

interface OOTDModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Call when the route changes away from an OOTD-related path. */
  navigatedAway: () => void;
}

const OOTDModalContext = createContext<OOTDModalContextType | null>(null);

export const OOTDModalProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const open = useCallback(() => dispatch({ type: "open" }), []);
  const close = useCallback(() => dispatch({ type: "close" }), []);
  const toggle = useCallback(() => dispatch({ type: "toggle" }), []);
  const navigatedAway = useCallback(() => dispatch({ type: "navigatedAway" }), []);

  const value = useMemo<OOTDModalContextType>(
    () => ({ isOpen: state.isOpen, open, close, toggle, navigatedAway }),
    [state.isOpen, open, close, toggle, navigatedAway]
  );

  return <OOTDModalContext.Provider value={value}>{children}</OOTDModalContext.Provider>;
};

export const useOOTDModal = () => {
  const ctx = useContext(OOTDModalContext);
  if (!ctx) throw new Error("useOOTDModal must be used within OOTDModalProvider");
  return ctx;
};
