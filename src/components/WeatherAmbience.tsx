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

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base image layer — very low opacity for atmosphere */}
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
          className="h-full w-full object-cover opacity-[0.12] dark:opacity-[0.18]"
          draggable={false}
        />
      </motion.div>

      {/* Slow drift movement on the image */}
      <motion.div
        className="absolute inset-[-10%]"
        animate={{ x: [0, 15, -10, 0], y: [0, -10, 5, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <img
          src={bgImage}
          alt=""
          className="h-full w-full object-cover opacity-[0.05] blur-xl dark:opacity-[0.08]"
          draggable={false}
        />
      </motion.div>

      {/* Rain streaks overlay */}
      {isRain &&
        Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={`rain-${i}`}
            className="absolute h-16 w-px bg-foreground/[0.04]"
            style={{ left: `${Math.random() * 100}%`, top: `-${Math.random() * 15}%` }}
            animate={{ y: ["0vh", "115vh"] }}
            transition={{
              duration: 1.2 + Math.random() * 0.8,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear",
            }}
          />
        ))}

      {/* Snow particles overlay */}
      {isSnow &&
        Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`snow-${i}`}
            className="absolute h-1 w-1 rounded-full bg-foreground/[0.06]"
            style={{ left: `${Math.random() * 100}%`, top: `-3%` }}
            animate={{ y: ["0vh", "105vh"], x: [0, Math.sin(i) * 25] }}
            transition={{
              duration: 10 + Math.random() * 8,
              repeat: Infinity,
              delay: Math.random() * 6,
              ease: "linear",
            }}
          />
        ))}

      {/* Storm flash overlay */}
      {isStorm && (
        <motion.div
          className="absolute inset-0 bg-white/[0.02]"
          animate={{ opacity: [0, 0, 0.08, 0, 0, 0, 0.04, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
};

export default WeatherAmbience;
