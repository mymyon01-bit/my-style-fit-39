import { motion } from "framer-motion";

import rainBg from "@/assets/weather/rain.jpg";
import snowBg from "@/assets/weather/snow.jpg";
import sunnyBg from "@/assets/weather/sunny.jpg";
import cloudyBg from "@/assets/weather/cloudy.jpg";
import stormBg from "@/assets/weather/storm.jpg";
import fogBg from "@/assets/weather/fog.jpg";

const weatherMap: Record<string, string> = {
  rain: rainBg,
  "light-rain": rainBg,
  drizzle: rainBg,
  snow: snowBg,
  sunny: sunnyBg,
  clear: sunnyBg,
  cloudy: cloudyBg,
  "partly-cloudy": cloudyBg,
  overcast: cloudyBg,
  storm: stormBg,
  thunderstorm: stormBg,
  fog: fogBg,
  mist: fogBg,
  haze: fogBg,
};

const WeatherAmbience = ({ condition }: { condition: string }) => {
  const bgImage = weatherMap[condition] || cloudyBg;
  const isRain = condition === "rain" || condition === "light-rain" || condition === "drizzle";
  const isSnow = condition === "snow";
  const isStorm = condition === "storm" || condition === "thunderstorm";
  const isSunny = condition === "sunny" || condition === "clear";
  const isFog = condition === "fog" || condition === "mist" || condition === "haze";

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base image layer — slightly more visible */}
      <motion.div
        key={bgImage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <img
          src={bgImage}
          alt=""
          className="h-full w-full object-cover opacity-[0.18] dark:opacity-[0.22]"
          draggable={false}
        />
      </motion.div>

      {/* Slow drift movement */}
      <motion.div
        className="absolute inset-[-10%]"
        animate={{ x: [0, 15, -10, 0], y: [0, -10, 5, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <img
          src={bgImage}
          alt=""
          className="h-full w-full object-cover opacity-[0.07] blur-xl dark:opacity-[0.10]"
          draggable={false}
        />
      </motion.div>

      {/* Warm glow for sunny/clear */}
      {isSunny && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.03, 0.06, 0.03] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(ellipse at 60% 30%, hsl(40 80% 60% / 0.12), transparent 70%)",
          }}
        />
      )}

      {/* Fog pulse */}
      {isFog && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.04, 0.10, 0.04] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "linear-gradient(180deg, hsl(210 10% 80% / 0.08) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Rain streaks — more visible */}
      {isRain &&
        Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={`rain-${i}`}
            className="absolute w-px bg-foreground/[0.06]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 15}%`,
              height: `${3 + Math.random() * 5}rem`,
            }}
            animate={{ y: ["0vh", "115vh"] }}
            transition={{
              duration: 1 + Math.random() * 0.8,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear",
            }}
          />
        ))}

      {/* Snow particles — more visible */}
      {isSnow &&
        Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={`snow-${i}`}
            className="absolute rounded-full bg-foreground/[0.08]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-3%`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
            }}
            animate={{ y: ["0vh", "105vh"], x: [0, Math.sin(i) * 30] }}
            transition={{
              duration: 8 + Math.random() * 8,
              repeat: Infinity,
              delay: Math.random() * 6,
              ease: "linear",
            }}
          />
        ))}

      {/* Storm flash */}
      {isStorm && (
        <motion.div
          className="absolute inset-0 bg-white/[0.03]"
          animate={{ opacity: [0, 0, 0.12, 0, 0, 0, 0.06, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
};

export default WeatherAmbience;
