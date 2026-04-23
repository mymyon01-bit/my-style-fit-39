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

// Generate a jagged lightning bolt path
const generateBoltPath = (seed: number, height = 280) => {
  const segments = 8 + Math.floor(rand(seed) * 4);
  let x = 45 + rand(seed + 1) * 10;
  let y = 0;
  let path = `M${x} ${y}`;
  const branches: string[] = [];
  for (let i = 1; i <= segments; i++) {
    const dx = (rand(seed + i * 3) - 0.5) * 28;
    const dy = height / segments;
    x += dx;
    y += dy;
    path += ` L${x} ${y}`;
    // Occasional branch
    if (i > 2 && i < segments - 1 && rand(seed + i * 7) > 0.65) {
      const bx = x + (rand(seed + i * 11) - 0.5) * 40;
      const by = y + 30 + rand(seed + i * 13) * 40;
      branches.push(`M${x} ${y} L${bx} ${by}`);
    }
  }
  return { main: path, branches };
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
  // Layered rain — near/mid/far for parallax depth (real rain has depth)
  const rainDrops = useMemo(
    () =>
      Array.from({ length: 160 }).map((_, i) => {
        const layer = i % 3; // 0=far, 1=mid, 2=near
        const depth = layer === 0 ? 0.4 : layer === 1 ? 0.7 : 1;
        return {
          left: rand(i + 1) * 100,
          top: -rand(i + 7) * 30,
          height: (1.5 + rand(i + 13) * 4) * depth,
          width: 0.8 + depth * 1.2,
          delay: rand(i + 23) * 1.8,
          duration: (0.45 + rand(i + 37) * 0.45) / depth,
          opacity: (0.18 + rand(i + 51) * 0.4) * depth,
          tilt: -10 - rand(i + 61) * 6,
          blur: layer === 0 ? 1.2 : layer === 1 ? 0.4 : 0,
        };
      }),
    [],
  );

  // Splash points along the bottom — where drops hit
  const splashes = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
        left: rand(i + 401) * 100,
        delay: rand(i + 411) * 2,
        duration: 0.9 + rand(i + 421) * 0.6,
        size: 8 + rand(i + 431) * 14,
      })),
    [],
  );

  // Raindrops sliding/streaking down the "glass" of the screen (foreground)
  const screenDrops = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        left: rand(i + 301) * 100,
        startTop: rand(i + 311) * 100,
        size: 4 + rand(i + 321) * 8,
        trail: 30 + rand(i + 331) * 60,
        delay: rand(i + 341) * 6,
        duration: 3 + rand(i + 351) * 4,
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

  // Pre-generated lightning bolts (multiple variants for variety)
  const bolts = useMemo(
    () => [
      { ...generateBoltPath(11), top: "2%", left: "22%", scale: 1 },
      { ...generateBoltPath(29), top: "4%", left: "58%", scale: 0.85 },
      { ...generateBoltPath(47), top: "1%", left: "78%", scale: 1.1 },
    ],
    [],
  );

  return (
    // z-0 keeps ambience strictly behind page content (text uses z-10+)
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
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
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 70% 18%, hsl(38 95% 62% / 0.32), transparent 55%), linear-gradient(180deg, hsl(35 90% 70% / 0.18) 0%, hsl(200 70% 65% / 0.10) 55%, transparent 100%)",
            }}
          />
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
          {/* Falling rain streaks */}
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
          {/* Raindrops on the "glass" — beads sliding down with trails */}
          {screenDrops.map((d, i) => (
            <motion.div
              key={`screen-drop-${i}`}
              className="absolute"
              style={{
                left: `${d.left}%`,
                top: `${d.startTop}%`,
                width: d.size,
                height: d.size * 1.3,
                borderRadius: "50% 50% 55% 55% / 60% 60% 45% 45%",
                background:
                  "radial-gradient(ellipse at 35% 30%, hsl(200 90% 95% / 0.85) 0%, hsl(205 70% 80% / 0.55) 45%, hsl(210 60% 70% / 0.35) 100%)",
                boxShadow:
                  "inset -1px -1px 2px hsl(210 60% 60% / 0.4), 0 1px 2px hsl(220 80% 20% / 0.4)",
                backdropFilter: "blur(1px)",
              }}
              animate={{
                y: [0, d.trail * 4],
                opacity: [0, 0.95, 0.95, 0],
              }}
              transition={{
                duration: d.duration,
                repeat: Infinity,
                delay: d.delay,
                ease: "easeIn",
                times: [0, 0.1, 0.85, 1],
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
          {/* Heavy slanted rain */}
          {Array.from({ length: 110 }).map((_, i) => {
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
                  transform: "rotate(-14deg)",
                  background:
                    "linear-gradient(to bottom, transparent 0%, hsl(220 60% 75% / 0.5) 60%, hsl(230 80% 85% / 0.65) 100%)",
                  borderRadius: 999,
                }}
                animate={{ y: ["0vh", "120vh"] }}
                transition={{
                  duration: 0.45 + rand(i + 400) * 0.35,
                  repeat: Infinity,
                  delay: rand(i + 500) * 1.5,
                  ease: "linear",
                }}
              />
            );
          })}
          {/* Raindrops on screen during storm */}
          {screenDrops.map((d, i) => (
            <motion.div
              key={`storm-screen-drop-${i}`}
              className="absolute"
              style={{
                left: `${d.left}%`,
                top: `${d.startTop}%`,
                width: d.size,
                height: d.size * 1.3,
                borderRadius: "50% 50% 55% 55% / 60% 60% 45% 45%",
                background:
                  "radial-gradient(ellipse at 35% 30%, hsl(210 90% 92% / 0.9) 0%, hsl(215 70% 75% / 0.6) 45%, hsl(220 60% 65% / 0.4) 100%)",
                boxShadow:
                  "inset -1px -1px 2px hsl(220 60% 50% / 0.5), 0 1px 3px hsl(230 80% 15% / 0.6)",
              }}
              animate={{
                y: [0, d.trail * 5],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: d.duration * 0.8,
                repeat: Infinity,
                delay: d.delay,
                ease: "easeIn",
                times: [0, 0.08, 0.85, 1],
              }}
            />
          ))}

          {/* Sky-wide lightning flash (white/blue burst) */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 35% 20%, hsl(220 100% 96% / 0.95) 0%, hsl(230 90% 80% / 0.5) 25%, hsl(240 70% 50% / 0.15) 55%, transparent 75%)",
            }}
            // Realistic flicker pattern: main strike, sub-flash, gap, distant flash
            animate={{
              opacity: [
                0, 0, 0, 0, 0,
                0.95, 0.2, 0.85, 0,
                0, 0, 0, 0,
                0.6, 0.15, 0.4, 0,
                0, 0, 0, 0, 0, 0,
              ],
            }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          />

          {/* Lightning bolts — multiple branched, randomly flashing */}
          {bolts.map((b, idx) => (
            <motion.svg
              key={`bolt-${idx}`}
              className="absolute"
              style={{
                top: b.top,
                left: b.left,
                width: 110 * b.scale,
                height: 300 * b.scale,
                filter:
                  "drop-shadow(0 0 8px hsl(220 100% 90% / 0.95)) drop-shadow(0 0 24px hsl(230 90% 70% / 0.7))",
              }}
              viewBox="0 0 100 300"
              animate={{
                opacity:
                  idx === 0
                    ? [0, 0, 0, 0, 0, 1, 0, 0.85, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                    : idx === 1
                    ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0]
                    : [0, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0.3, 0, 0],
              }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            >
              <path
                d={b.main}
                fill="none"
                stroke="hsl(0 0% 100%)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={b.main}
                fill="none"
                stroke="hsl(220 100% 92%)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {b.branches.map((br, j) => (
                <path
                  key={`branch-${idx}-${j}`}
                  d={br}
                  fill="none"
                  stroke="hsl(220 100% 95%)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              ))}
            </motion.svg>
          ))}
        </>
      )}
    </div>
  );
};

export default WeatherAmbience;
