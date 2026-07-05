import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import splashImg from "/icons/splash-mymyon.jpg?url";
import { isNativeApp } from "@/lib/native/platform";

/**
 * SplashScreen — dark navy satin backdrop with the gold "my" script mark.
 * Matches the new luxury app icon. Auto-dismisses ~1.6s; cached per session.
 *
 * On native (Capacitor) we ALSO hide the native Android/iOS splash here so
 * there's no white flash between the native splash and this web splash.
 */
const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Hand off from native splash → web splash without a white frame.
    if (isNativeApp()) {
      import("@capacitor/splash-screen")
        .then(({ SplashScreen: NativeSplash }) => NativeSplash.hide({ fadeOutDuration: 200 }))
        .catch(() => { /* not available — ignore */ });
    }

    // Bumped key (v3) so users see the new navy/gold splash once
    if (sessionStorage.getItem("wardrobe-splash-v3")) {
      onComplete();
      return;
    }
    const tExit = setTimeout(() => setExiting(true), 1600);
    const tDone = setTimeout(() => {
      sessionStorage.setItem("wardrobe-splash-v3", "1");
      onComplete();
    }, 2100);
    return () => {
      clearTimeout(tExit);
      clearTimeout(tDone);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <motion.img
        src={splashImg}
        alt="my'myon"
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ scale: 1.04 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        draggable={false}
      />
    </motion.div>
  );
};

export default SplashScreen;
