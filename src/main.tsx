import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time purge of locally cached fit/cutout/try-on images so previously
// generated photos don't reappear after the server-side reset.
try {
  const PURGE_KEY = "fit-cache-purge::v2";
  if (typeof window !== "undefined" && !localStorage.getItem(PURGE_KEY)) {
    const prefixes = ["fit-cutout::", "fit-tryon::", "fit-canvas::", "fit-result::"];
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(PURGE_KEY, String(Date.now()));
  }
} catch {
  // ignore
}

createRoot(document.getElementById("root")!).render(<App />);
