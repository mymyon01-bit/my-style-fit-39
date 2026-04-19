import { useState, useEffect } from "react";

export interface AirQuality {
  pm25: number;
  pm10: number;
  level: "good" | "moderate" | "unhealthy" | "hazardous";
  loading: boolean;
}

function classify(pm25: number): AirQuality["level"] {
  if (pm25 <= 15) return "good";
  if (pm25 <= 35) return "moderate";
  if (pm25 <= 75) return "unhealthy";
  return "hazardous";
}

export function useAirQuality(lat?: number, lon?: number): AirQuality {
  const [aq, setAq] = useState<AirQuality>({ pm25: 12, pm10: 20, level: "good", loading: true });

  useEffect(() => {
    const fetchAQ = async (latitude: number, longitude: number) => {
      try {
        const res = await fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=pm2_5,pm10`
        );
        const data = await res.json();
        const pm25 = Math.round(data?.current?.pm2_5 ?? 12);
        const pm10 = Math.round(data?.current?.pm10 ?? 20);
        setAq({ pm25, pm10, level: classify(pm25), loading: false });
      } catch {
        setAq({ pm25: 12, pm10: 20, level: "good", loading: false });
      }
    };

    if (typeof lat === "number" && typeof lon === "number") {
      fetchAQ(lat, lon);
      return;
    }

    if (!navigator.geolocation) {
      setAq((a) => ({ ...a, loading: false }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchAQ(pos.coords.latitude, pos.coords.longitude),
      () => setAq((a) => ({ ...a, loading: false })),
      { timeout: 8000 }
    );
  }, [lat, lon]);

  return aq;
}
