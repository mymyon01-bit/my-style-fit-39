import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import splashImg from "/icons/splash.png?url";

/**
 * SplashScreen — pastel gradient backdrop with the hand-lettered "My" mark.
 * Matches the new app icon. Auto-dismisses ~1.6s; cached per session.
 */
const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("wardrobe-splash")) {
      onComplete();
      return;
    }
    const tExit = setTimeout(() => setExiting(true), 1400);
    const tDone = setTimeout(() => {
      sessionStorage.setItem("wardrobe-splash", "1");
      onComplete();
    }, 1900);
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
