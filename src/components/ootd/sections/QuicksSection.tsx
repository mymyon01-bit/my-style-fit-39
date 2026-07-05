/**
 * QuicksSection — Full-bleed short-form video feed.
 *
 * The stories rail was moved to MyPage (users manage their story from
 * their profile). Quicks is now a pure vertical video experience that
 * spans edge-to-edge and butts up against the bottom nav.
 */
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const OOTDShortsFeed = lazy(() => import("@/components/ootd/OOTDShortsFeed"));

const QuicksSection = () => (
  <div className="w-full">
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent/65" />
        </div>
      }
    >
      <OOTDShortsFeed />
    </Suspense>
  </div>
);

export default QuicksSection;
