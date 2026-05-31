import { Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Floating "+" action button rendered above the mobile BottomNav.
 * Opens the OOTD upload sheet via /ootd?upload=1 so the existing flow is reused.
 * Hidden on landing, auth, onboarding, and admin routes.
 */
const HIDDEN_PREFIXES = ["/", "/auth", "/onboarding", "/admin", "/oauth", "/install"];

const UploadFAB = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;
  const hidden =
    path === "/" ||
    HIDDEN_PREFIXES.some((p) => p !== "/" && path.startsWith(p));
  if (hidden) return null;

  return (
    <button
      onClick={() => navigate("/ootd?tab=mypage&upload=1")}
      aria-label="Create OOTD"
      title="Create OOTD"
      className="fixed right-4 z-[115] md:hidden
                 bottom-[calc(72px+env(safe-area-inset-bottom)+12px)]
                 h-14 w-14 rounded-full
                 bg-accent text-accent-foreground
                 shadow-[0_10px_30px_-8px_hsl(var(--accent)/0.55)]
                 ring-1 ring-accent/40
                 flex items-center justify-center
                 active:scale-95 transition-transform"
    >
      <Plus className="h-7 w-7" strokeWidth={2.4} />
    </button>
  );
};

export default UploadFAB;
