/**
 * Geolocation helper — uses Capacitor Geolocation on native (with the
 * proper Android system permission dialog) and falls back to the browser
 * `navigator.geolocation` API on the web. All calls are wrapped in
 * try/catch so a plugin failure can never crash the React tree.
 */
import { isNativeApp } from "./platform";

export type LocationPermission = "granted" | "denied" | "prompt" | "unavailable";

export interface Coords {
  lat: number;
  lon: number;
}

export const getLocationPermissionStatus = async (): Promise<LocationPermission> => {
  if (!isNativeApp()) {
    if (typeof navigator === "undefined" || !navigator.permissions) return "prompt";
    try {
      const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      return (res.state as LocationPermission) ?? "prompt";
    } catch {
      return "prompt";
    }
  }
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const res = await Geolocation.checkPermissions();
    if (res.location === "granted") return "granted";
    if (res.location === "denied") return "denied";
    return "prompt";
  } catch (e) {
    console.warn("[location] checkPermissions failed", e);
    return "unavailable";
  }
};

export const requestLocationPermission = async (): Promise<LocationPermission> => {
  if (!isNativeApp()) return "prompt"; // browser shows its own dialog on first getCurrentPosition
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const res = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (res.location === "granted") return "granted";
    if (res.location === "denied") return "denied";
    return "prompt";
  } catch (e) {
    console.warn("[location] requestPermissions failed", e);
    return "unavailable";
  }
};

export const getCurrentCoords = async (): Promise<Coords | null> => {
  if (isNativeApp()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch (e) {
      console.warn("[location] native getCurrentPosition failed", e);
      return null;
    }
  }
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false },
    );
  });
};
