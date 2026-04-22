import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "scheduler",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // IMPORTANT: keep React + scheduler in a single chunk that loads BEFORE
        // any other vendor chunk. The previous matcher used substring `.includes("react")`
        // which matched packages like `react-easy-crop`, `react-day-picker`,
        // `@hookform/resolvers`, etc. and also pulled half of node_modules with
        // "react" in the path into `react-vendor`, leaving consumer libs in
        // `vendor` that referenced React before it was initialized
        // (Cannot read properties of undefined (reading 'createContext')).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // React core — must be its own chunk and resolved first.
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id)
          ) {
            return "react-vendor";
          }

          // Let everything else fall into Rollup's default chunk graph so
          // import-order and shared dependencies stay correct. We deliberately
          // avoid further manual splits — they were the source of the
          // production runtime crash.
          return undefined;
        },
      },
    },
  },
}));
