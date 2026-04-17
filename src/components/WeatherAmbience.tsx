import { motion } from "framer-motion";
import { useMemo } from "react";

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

// Stable pseudo-random helper so particles don't reshuffle every render
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const WeatherAmbience = ({ condition }: { condition: string }) => {
  const bgImage = weatherMap[condition] || cloudyBg;
  const isRain = condition === "rain" || condition === "light-rain" || condition === "drizzle";
  const isSnow = condition === "snow";
  const isStorm = condition === "storm" || condition === "thunderstorm";
  const isSunny = condition === "sunny" || condition === "clear";
  const isFog = condition === "fog" || condition === "mist" || condition === "haze";
  const isCloudy =
    condition === "cloudy" || condition === "partly-cloudy" || condition === "overcast";

  // Pre-compute particle arrays (stable across rerenders for perceived realism)
  const rainDrops = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        left: rand(i + 1) * 100,
        top: -rand(i + 7) * 20,
        height: 2.5 + rand(i + 13) * 5,
        delay: rand(i + 23) * 2,
        duration: 0.7 + rand(i + 37) * 0.6,
        opacity: 0.25 + rand(i + 51) * 0.35,
        tilt: -8 - rand(i + 61) * 4,
      })),
    [],
  );

  const snowFlakes = useMemo(
    () =>
      Array.from({ length: 45 }).map((_, i) => ({
        left: rand(i + 2) * 100,
        size: 2 + rand(i + 11) * 5,
        delay: rand(i + 19) * 8,
        duration: 9 + rand(i + 29) * 9,
        sway: 20 + rand(i + 41) * 50,
        opacity: 0.4 + rand(i + 53) * 0.5,
      })),
    [],
  );

  const sunRays = useMemo(
    () =>
      Array.from({ length: 8 }).map((_, i) => ({
        rotate: i * 45 + rand(i + 3) * 8,
        delay: rand(i + 17) * 4,
      })),
    [],
  );

  const clouds = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        top: 8 + rand(i + 5) * 35,
        size: 240 + rand(i + 15) * 320,
        delay: rand(i + 25) * 25,
        duration: 70 + rand(i + 35) * 60,
        opacity: 0.18 + rand(i + 45) * 0.22,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base photographic layer */}
      <motion.div
        key={bgImage}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <img
          src={bgImage}
          alt=""
          className="h-full w-full object-cover opacity-[0.28] dark:opacity-[0.32]"
          draggable={false}
        />
      </motion.div>

      {/* Slow drifting parallax layer */}
      <motion.div
        className="absolute inset-[-8%]"
        animate={{ x: [0, 18, -12, 0], y: [0, -12, 6, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
      >
        <img
          src={bgImage}
          alt=""
          className="h-full w-full object-cover opacity-[0.10] blur-2xl dark:opacity-[0.14]"
          draggable={false}
        />
      </motion.div>

      {/* ======================== SUNNY ======================== */}
      {isSunny && (
        <>
          {/* Warm sky gradient wash */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 70% 18%, hsl(38 95% 62% / 0.32), transparent 55%), linear-gradient(180deg, hsl(35 90% 70% / 0.18) 0%, hsl(200 70% 65% / 0.10) 55%, transparent 100%)",
            }}
          />
          {/* Pulsing sun core */}
          <motion.div
            className="absolute"
            style={{
              top: "10%",
              right: "12%",
              width: 220,
              height: 220,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, hsl(48 100% 70% / 0.55) 0%, hsl(38 100% 60% / 0.25) 40%, transparent 70%)",
              filter: "blur(6px)",
            }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Rotating sun rays */}
          <motion.div
            className="absolute"
            style={{ top: "10%", right: "12%", width: 220, height: 220 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          >
            {sunRays.map((r, i) => (
              <motion.div
                key={`ray-${i}`}
                className="absolute left-1/2 top-1/2 origin-bottom"
                style={{
                  width: 2,
                  height: 320,
                  marginLeft: -1,
                  marginTop: -320,
                  transform: `rotate(${r.rotate}deg)`,
                  background:
                    "linear-gradient(to bottom, hsl(48 100% 75% / 0.0) 0%, hsl(45 100% 70% / 0.35) 60%, hsl(40 100% 65% / 0.0) 100%)",
                }}
                animate={{ opacity: [0.4, 0.85, 0.4] }}
                transition={{
                  duration: 5 + r.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: r.delay,
                }}
              />
            ))}
          </motion.div>
          {/* Lens-flare bokeh dots */}
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={`flare-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${20 + i * 12}%`,
                top: `${30 + (i % 2) * 25}%`,
                width: 14 + i * 4,
                height: 14 + i * 4,
                background: `hsl(${40 + i * 8} 100% 70% / 0.35)`,
                filter: "blur(4px)",
              }}
              animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.8, 1.1, 0.8] }}
              transition={{
                duration: 4 + i,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.6,
              }}
            />
          ))}
        </>
      )}

      {/* ======================== CLOUDY ======================== */}
      {isCloudy && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(215 25% 75% / 0.22) 0%, hsl(220 18% 60% / 0.10) 60%, transparent 100%)",
            }}
          />
          {clouds.map((c, i) => (
            <motion.div
              key={`cloud-${i}`}
              className="absolute rounded-full"
              style={{
                top: `${c.top}%`,
                width: c.size,
                height: c.size * 0.45,
                background:
                  "radial-gradient(ellipse at center, hsl(210 20% 92% / 0.5) 0%, hsl(215 25% 80% / 0.28) 50%, transparent 75%)",
                filter: "blur(20px)",
                opacity: c.opacity,
              }}
              initial={{ x: "-30%" }}
              animate={{ x: "130%" }}
              transition={{
                duration: c.duration,
                repeat: Infinity,
                ease: "linear",
                delay: c.delay,
              }}
            />
          ))}
        </>
      )}

      {/* ======================== FOG ======================== */}
      {isFog && (
        <>
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background:
                "linear-gradient(180deg, hsl(210 12% 82% / 0.32) 0%, hsl(215 8% 70% / 0.18) 50%, transparent 100%)",
            }}
          />
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`fog-${i}`}
              className="absolute h-[30%] w-[160%]"
              style={{
                top: `${15 + i * 22}%`,
                left: "-30%",
                background:
                  "radial-gradient(ellipse at center, hsl(210 15% 88% / 0.35) 0%, transparent 70%)",
                filter: "blur(30px)",
              }}
              animate={{ x: ["0%", "20%", "0%"] }}
              transition={{
                duration: 30 + i * 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 3,
              }}
            />
          ))}
        </>
      )}

      {/* ======================== RAIN ======================== */}
      {isRain && (
        <>
          {/* Cool blue atmospheric tint */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(215 45% 35% / 0.28) 0%, hsl(210 50% 25% / 0.18) 60%, hsl(220 55% 20% / 0.22) 100%)",
            }}
          />
          {/* Rain streaks - tilted, colored, varying opacity */}
          {rainDrops.map((d, i) => (
            <motion.div
              key={`rain-${i}`}
              className="absolute"
              style={{
                left: `${d.left}%`,
                top: `${d.top}%`,
                width: 1.5,
                height: `${d.height}rem`,
                transform: `rotate(${d.tilt}deg)`,
                background: `linear-gradient(to bottom, transparent 0%, hsl(200 80% 75% / ${d.opacity}) 50%, hsl(210 90% 85% / ${d.opacity}) 100%)`,
                borderRadius: 999,
              }}
              animate={{ y: ["0vh", "118vh"] }}
              transition={{
                duration: d.duration,
                repeat: Infinity,
                delay: d.delay,
                ease: "linear",
              }}
            />
          ))}
          {/* Splash ripples at bottom */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`splash-${i}`}
              className="absolute rounded-full border"
              style={{
                left: `${10 + i * 11}%`,
                bottom: `${2 + rand(i + 71) * 8}%`,
                width: 14,
                height: 4,
                borderColor: "hsl(200 70% 80% / 0.5)",
                borderWidth: 1,
              }}
              animate={{ scale: [0, 1.6, 0], opacity: [0, 0.7, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: i * 0.3 + rand(i + 91),
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}

      {/* ======================== SNOW ======================== */}
      {isSnow && (
        <>
          {/* Cool icy wash */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(210 50% 88% / 0.20) 0%, hsl(220 40% 75% / 0.10) 60%, transparent 100%)",
            }}
          />
          {snowFlakes.map((s, i) => (
            <motion.div
              key={`snow-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${s.left}%`,
                top: "-3%",
                width: s.size,
                height: s.size,
                background: `radial-gradient(circle, hsl(0 0% 100% / ${s.opacity}) 0%, hsl(210 60% 95% / ${s.opacity * 0.6}) 70%, transparent 100%)`,
                boxShadow: `0 0 ${s.size * 2}px hsl(210 80% 90% / 0.5)`,
              }}
              animate={{
                y: ["0vh", "108vh"],
                x: [0, s.sway, -s.sway, 0],
              }}
              transition={{
                duration: s.duration,
                repeat: Infinity,
                delay: s.delay,
                ease: "linear",
              }}
            />
          ))}
        </>
      )}

      {/* ======================== STORM ======================== */}
      {isStorm && (
        <>
          {/* Heavy dark wash */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(240 35% 12% / 0.45) 0%, hsl(230 40% 18% / 0.35) 50%, hsl(245 45% 10% / 0.50) 100%)",
            }}
          />
          {/* Rain (denser, faster) */}
          {Array.from({ length: 90 }).map((_, i) => {
            const left = rand(i + 100) * 100;
            const top = -rand(i + 200) * 25;
            const height = 3 + rand(i + 300) * 6;
            return (
              <motion.div
                key={`storm-rain-${i}`}
                className="absolute"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: 1.5,
                  height: `${height}rem`,
                  transform: "rotate(-12deg)",
                  background:
                    "linear-gradient(to bottom, transparent 0%, hsl(220 60% 75% / 0.5) 60%, hsl(230 80% 85% / 0.6) 100%)",
                  borderRadius: 999,
                }}
                animate={{ y: ["0vh", "120vh"] }}
                transition={{
                  duration: 0.5 + rand(i + 400) * 0.4,
                  repeat: Infinity,
                  delay: rand(i + 500) * 1.5,
                  ease: "linear",
                }}
              />
            );
          })}
          {/* Lightning flash */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 35% 25%, hsl(220 100% 90% / 0.8) 0%, hsl(240 80% 70% / 0.3) 30%, transparent 60%)",
            }}
            animate={{ opacity: [0, 0, 0, 0.9, 0, 0.4, 0, 0, 0, 0, 0.7, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          />
          {/* Lightning bolt */}
          <motion.svg
            className="absolute"
            style={{ top: "5%", left: "30%", width: 90, height: 280 }}
            viewBox="0 0 90 280"
            animate={{ opacity: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0.6, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          >
            <path
              d="M50 0 L25 130 L52 130 L20 280 L70 110 L42 110 L62 0 Z"
              fill="hsl(50 100% 75%)"
              stroke="hsl(220 100% 95%)"
              strokeWidth="1.5"
              style={{ filter: "drop-shadow(0 0 12px hsl(50 100% 70% / 0.9))" }}
            />
          </motion.svg>
        </>
      )}
    </div>
  );
};

export default WeatherAmbience;
