/**
 * Build-time information injected by the CI workflow.
 *
 * The Android build job (.github/workflows/android-build.yml) overwrites
 * this file before `npm run build` so the bundled APK ships with its own
 * signing fingerprint visible inside the app (Settings → About).
 *
 * Locally / on the web build this stays at "unknown" — that's expected.
 */
export const BUILD_INFO = {
  signingSha1: "unknown",
  signingSha256: "unknown",
  buildVersionName: "dev",
  buildVersionCode: "0",
  commitSha: "local",
  builtAt: "local",
} as const;
