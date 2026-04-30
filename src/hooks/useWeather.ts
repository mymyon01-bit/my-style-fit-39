import { useState, useEffect } from "react";

interface WeatherData {
  temp: number;
  condition: string;
  location: string;
  loading: boolean;
  error: string | null;
}

const WMO_TO_CONDITION: Record<number, string> = {
  0: "clear",
  1: "partly-sunny",
  2: "partly-cloudy",
  3: "cloudy",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "drizzle",
  57: "drizzle",
  61: "light-rain",
  63: "rain",
  65: "rain",
  66: "rain",
  67: "rain",
  71: "snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "light-rain",
  81: "rain",
  82: "rain",
  85: "snow",
  86: "snow",
  95: "thunderstorm",
  96: "thunderstorm",
  99: "thunderstorm",
};

const CACHE_KEY = "wardrobe_weather_cache_v2";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — real-time enough, avoids hammering APIs

interface CachedWeather {
  temp: number;
  condition: string;
  location: string;
  ts: number;
}

function readCache(): CachedWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedWeather;
    if (Date.now() - c.ts > CACHE_TTL_MS) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(c: CachedWeather) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { "User-Agent": "WARDROBE-App/1.0" } }
    );
    const data = await res.json();
    return (
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      "Your Location"
    );
  } catch {
    return "Your Location";
  }
}

/**
 * IP-based geolocation fallback. Free, no key, ~city accuracy. Used when the
 * browser's geolocation is denied/unavailable so we still show real weather
 * for the user's region instead of the hard-coded "partly-cloudy" default.
 */
async function ipGeolocate(): Promise<{ lat: number; lon: number; city: string } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return null;
    return {
      lat: d.latitude,
      lon: d.longitude,
      city: d.city || d.region || "Your Location",
    };
  } catch {
    return null;
  }
}

async function fetchWeather(lat: number, lon: number): Promise<{ temp: number; condition: string } | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
    );
    if (!r.ok) return null;
    const j = await r.json();
    const code: number = j.current?.weather_code ?? -1;
    const condition = WMO_TO_CONDITION[code];
    if (!condition) return null;
    const temp = Math.round(j.current?.temperature_2m ?? 0);
    return { temp, condition };
  } catch {
    return null;
  }
}

// Cross-platform position fetch — uses Capacitor Geolocation on the native
// APK (so the proper Android system permission dialog fires) and the browser
// API everywhere else. Always returns null instead of throwing.
async function getPosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    const { getCurrentCoords } = await import("@/lib/native/location");
    return await getCurrentCoords();
  } catch {
    return null;
  }
}

export function useWeather(): WeatherData {
  // Seed from cache if fresh; otherwise show "Locating…" (no fake sun).
  const cached = typeof window !== "undefined" ? readCache() : null;
  const [weather, setWeather] = useState<WeatherData>(() =>
    cached
      ? { temp: cached.temp, condition: cached.condition, location: cached.location, loading: false, error: null }
      : { temp: 0, condition: "loading", location: "Locating…", loading: true, error: null },
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // 1. Try precise device geolocation (native Capacitor or browser).
      const pos = await getPosition();
      let lat: number | null = null;
      let lon: number | null = null;
      let city: string | null = null;

      if (pos) {
        lat = pos.lat;
        lon = pos.lon;
      } else {
        // 2. Fallback to IP geolocation so users who deny GPS still get
        //    real weather instead of the seeded "partly-cloudy" default.
        const ip = await ipGeolocate();
        if (ip) { lat = ip.lat; lon = ip.lon; city = ip.city; }
      }

      if (lat == null || lon == null) {
        if (!cancelled && !cached) {
          setWeather((w) => ({ ...w, loading: false, error: "Location unavailable" }));
        }
        return;
      }

      const [w, namedCity] = await Promise.all([
        fetchWeather(lat, lon),
        city ? Promise.resolve(city) : reverseGeocode(lat, lon),
      ]);

      if (cancelled) return;
      if (!w) {
        setWeather((prev) => ({ ...prev, loading: false, error: "Weather fetch failed" }));
        return;
      }
      const next: WeatherData = {
        temp: w.temp,
        condition: w.condition,
        location: namedCity,
        loading: false,
        error: null,
      };
      setWeather(next);
      writeCache({ temp: w.temp, condition: w.condition, location: namedCity, ts: Date.now() });
    };
    void run();
    // Re-run when the user grants location after launch (PermissionsPrompt
    // dispatches this event so the home screen updates without a reload).
    const onGranted = () => { void run(); };
    window.addEventListener("wardrobe:location-granted", onGranted);
    return () => {
      cancelled = true;
      window.removeEventListener("wardrobe:location-granted", onGranted);
    };
  }, []);

  return weather;
}
