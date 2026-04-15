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
  1: "clear",
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

export function useWeather(): WeatherData {
  const [weather, setWeather] = useState<WeatherData>({
    temp: 22,
    condition: "partly-cloudy",
    location: "Locating…",
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather((w) => ({ ...w, loading: false, error: "Geolocation not supported" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const [weatherRes, city] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
            ).then((r) => r.json()),
            reverseGeocode(lat, lon),
          ]);

          const current = weatherRes.current;
          const code: number = current?.weather_code ?? 2;
          const condition = WMO_TO_CONDITION[code] || "cloudy";
          const temp = Math.round(current?.temperature_2m ?? 22);

          setWeather({ temp, condition, location: city, loading: false, error: null });
        } catch {
          setWeather((w) => ({ ...w, loading: false, error: "Weather fetch failed" }));
        }
      },
      () => {
        setWeather((w) => ({ ...w, loading: false, error: "Location denied" }));
      },
      { timeout: 8000 }
    );
  }, []);

  return weather;
}
