import { motion } from "framer-motion";
import { useMemo, useRef, useEffect } from "react";

// Photo fallbacks (used while video loads, or if video fails)
import rainBg from "@/assets/weather/rain.jpg";
import snowBg from "@/assets/weather/snow.jpg";
import sunnyBg from "@/assets/weather/sunny.jpg";
import cloudyBg from "@/assets/weather/cloudy.jpg";
import stormBg from "@/assets/weather/storm.jpg";
import fogBg from "@/assets/weather/fog.jpg";

// Cinematic live videos — real footage matching each weather state.
import rainVid from "../../public/bg-videos/rain.mp4.asset.json";
import drizzleVid from "../../public/bg-videos/drizzle.mp4.asset.json";
import snowVid from "../../public/bg-videos/snow.mp4.asset.json";
import sunnyVid from "../../public/bg-videos/sunny.mp4.asset.json";
import partlySunnyVid from "../../public/bg-videos/partly-sunny.mp4.asset.json";
import partlyCloudyVid from "../../public/bg-videos/partly-cloudy.mp4.asset.json";
import cloudyVid from "../../public/bg-videos/cloudy.mp4.asset.json";
import stormVid from "../../public/bg-videos/storm.mp4.asset.json";
import fogVid from "../../public/bg-videos/fog.mp4.asset.json";
// Night-time footage — used when sun is below horizon.
import starsVid from "../../public/bg-videos/stars.mp4.asset.json";
import metropolisVid from "../../public/bg-videos/metropolis.mp4.asset.json";
import neonCityVid from "../../public/bg-videos/neon-city.mp4.asset.json";

const weatherMap: Record<string, string> = {
  rain: rainBg,
  "light-rain": rainBg,
  drizzle: rainBg,
  snow: snowBg,
  sunny: sunnyBg,
  clear: sunnyBg,
  cloudy: cloudyBg,
  "partly-cloudy": cloudyBg,
  "partly-sunny": sunnyBg,
  overcast: cloudyBg,
  storm: stormBg,
  thunderstorm: stormBg,
  fog: fogBg,
  mist: fogBg,
  haze: fogBg,
};

// Per-condition cinematic footage. Each video matches the *intensity* of the
// weather: drizzle vs heavy rain, light wisps vs thick rolling clouds, etc.
const weatherVideoMap: Record<string, string> = {
  // Sun
  sunny: sunnyVid.url,
  clear: sunnyVid.url,
  // Few clouds — sun peeking through
  "partly-sunny": partlySunnyVid.url,
  // Light wispy clouds drifting
  "partly-cloudy": partlyCloudyVid.url,
  // Heavy rolling overcast
  cloudy: cloudyVid.url,
  overcast: cloudyVid.url,
  // Light drizzle — droplets trickling on glass
  drizzle: drizzleVid.url,
  "light-rain": drizzleVid.url,
  // Heavy pouring rain streaks
  rain: rainVid.url,
  // Thunderstorm with lightning
  storm: stormVid.url,
  thunderstorm: stormVid.url,
  // Fog
  fog: fogVid.url,
  mist: fogVid.url,
  haze: fogVid.url,
};

// Per-condition NIGHT footage — replaces the daytime video when the sun is
// below the horizon. Clear/sunny nights show real starfield footage; cloudy
// nights show city lights through atmosphere; partly-cloudy nights blend the
// neon-city skyline with drifting clouds. Rain/snow/storm/fog keep their own
// footage but get a strong dark overlay applied below.
const weatherVideoMapNight: Record<string, string> = {
  sunny: starsVid.url,
  clear: starsVid.url,
  "partly-sunny": neonCityVid.url,
  "partly-cloudy": metropolisVid.url,
  cloudy: metropolisVid.url,
  overcast: metropolisVid.url,
  drizzle: drizzleVid.url,
  "light-rain": drizzleVid.url,
  rain: rainVid.url,
  storm: stormVid.url,
  thunderstorm: stormVid.url,
  fog: fogVid.url,
  mist: fogVid.url,
  haze: fogVid.url,
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

const WeatherAmbience = ({
  condition,
  isNight = false,
}: {
  condition: string;
  /** When true, swap to night footage and overlay starfield + moon. */
  isNight?: boolean;
}) => {
  const bgImage = weatherMap[condition] || cloudyBg;
  const bgVideo = isNight
    ? weatherVideoMapNight[condition] || metropolisVid.url
    : weatherVideoMap[condition] || cloudyVid.url;
  const isRain = condition === "rain" || condition === "light-rain" || condition === "drizzle";
  const isSnow = condition === "snow";
  const isStorm = condition === "storm" || condition === "thunderstorm";
  const isSunny = condition === "sunny" || condition === "clear";
  const isFog = condition === "fog" || condition === "mist" || condition === "haze";
  const isCloudy =
    condition === "cloudy" || condition === "partly-cloudy" || condition === "overcast";
  // Clear-sky night → show twinkling stars + moon overlay on top of footage
  const isClearNight = isNight && (isSunny || condition === "partly-sunny");
  const isCloudyNight = isNight && (isCloudy || condition === "partly-cloudy");

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

  // Twinkling stars for clear-sky nights — distributed mostly in the upper
  // 60% of the sky so they read as actual stars and not snow.
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }).map((_, i) => ({
        left: rand(i + 901) * 100,
        top: rand(i + 911) * 65,
        size: 1 + rand(i + 921) * 2.4,
        opacity: 0.45 + rand(i + 931) * 0.55,
        twinkleDelay: rand(i + 941) * 4,
        twinkleDuration: 2.4 + rand(i + 951) * 3.2,
      })),
    [],
  );

  // A handful of brighter "hero" stars with a soft glow halo.
  const brightStars = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        left: 8 + rand(i + 1001) * 84,
        top: 4 + rand(i + 1011) * 38,
        size: 3 + rand(i + 1021) * 2,
        delay: rand(i + 1031) * 5,
      })),
    [],
  );

  // Imperatively kick off playback — some browsers (Safari, in-app webviews)
  // ignore the autoPlay attribute when the element is initially mounted with
  // opacity 0 inside a motion wrapper, so we call play() on mount + on src change.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.playsInline = true;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    return () => v.removeEventListener("canplay", tryPlay);
  }, [bgVideo]);

  return (
    // z-0 keeps ambience strictly behind page content (text uses z-10+)
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Base cinematic video layer — real footage matching the live weather.
          Rendered as a plain <video> (no motion wrapper) so the element mounts
          immediately and the browser respects autoplay. */}
      <video
        ref={videoRef}
        key={bgVideo}
        src={bgVideo}
        poster={bgImage}
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        // High opacity so the real footage reads clearly; particle overlays
        // (rain droplets, snow, lightning) layer on top per condition.
        // At night we push the footage a touch brighter so the city lights /
        // starfield stay legible under the dark-sky wash applied below.
        className={`absolute inset-0 h-full w-full object-cover animate-fade-in ${
          isNight ? "opacity-[0.7] dark:opacity-[0.78]" : "opacity-[0.55] dark:opacity-[0.6]"
        }`}
        style={{ objectPosition: "center" }}
      />

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

      {/* ======================== NIGHT SKY ========================
          Applied across all conditions when the sun is down. A deep blue
          gradient washes the footage cooler/darker, then a starfield +
          moon glow for clear-sky nights only (rain/snow/storm/fog at night
          keep their existing particle layers but sit on the dark wash). */}
      {isNight && (
        <>
          {/* Dark sky wash — deep navy at top fading toward horizon */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(232 55% 6% / 0.62) 0%, hsl(228 50% 10% / 0.48) 45%, hsl(225 45% 14% / 0.36) 80%, hsl(222 40% 18% / 0.28) 100%)",
            }}
          />
          {/* Subtle horizon glow so silhouettes don't go pure black */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "radial-gradient(ellipse at 50% 110%, hsl(220 60% 35% / 0.22) 0%, transparent 60%)",
            }}
          />
        </>
      )}

      {/* Stars — only shown on clear nights (no thick clouds blocking them) */}
      {isClearNight && (
        <>
          {stars.map((s, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                background: "hsl(210 100% 96%)",
                boxShadow: `0 0 ${s.size * 2}px hsl(210 100% 90% / 0.7)`,
              }}
              animate={{ opacity: [s.opacity * 0.35, s.opacity, s.opacity * 0.35] }}
              transition={{
                duration: s.twinkleDuration,
                repeat: Infinity,
                delay: s.twinkleDelay,
                ease: "easeInOut",
              }}
            />
          ))}
          {brightStars.map((s, i) => (
            <motion.div
              key={`bright-star-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                background: "hsl(48 100% 92%)",
                boxShadow:
                  "0 0 8px hsl(48 100% 85% / 0.95), 0 0 22px hsl(45 100% 80% / 0.55)",
              }}
              animate={{ opacity: [0.55, 1, 0.55], scale: [0.9, 1.15, 0.9] }}
              transition={{
                duration: 3.5 + s.delay,
                repeat: Infinity,
                delay: s.delay,
                ease: "easeInOut",
              }}
            />
          ))}
          {/* Moon — soft luminous disc with halo */}
          <motion.div
            className="absolute"
            style={{
              top: "8%",
              right: "10%",
              width: 140,
              height: 140,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 38% 38%, hsl(48 30% 96%) 0%, hsl(45 20% 88%) 40%, hsl(220 25% 70%) 75%, transparent 100%)",
              boxShadow:
                "0 0 60px hsl(48 60% 90% / 0.45), 0 0 140px hsl(220 50% 70% / 0.25)",
            }}
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* Cloudy nights — a few faint stars peeking through the gaps */}
      {isCloudyNight && !isClearNight && (
        <>
          {stars.slice(0, 18).map((s, i) => (
            <motion.div
              key={`cloudy-night-star-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${s.left}%`,
                top: `${s.top * 0.7}%`,
                width: s.size * 0.8,
                height: s.size * 0.8,
                background: "hsl(210 80% 92%)",
                boxShadow: `0 0 ${s.size * 1.6}px hsl(210 90% 88% / 0.55)`,
              }}
              animate={{ opacity: [0, s.opacity * 0.6, 0] }}
              transition={{
                duration: s.twinkleDuration * 1.4,
                repeat: Infinity,
                delay: s.twinkleDelay,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}

      {/* ======================== SUNNY (daytime only) ======================== */}
      {isSunny && !isNight && (
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
          {/* Falling rain streaks — layered with motion blur for realism */}
          {rainDrops.map((d, i) => (
            <motion.div
              key={`rain-${i}`}
              className="absolute"
              style={{
                left: `${d.left}%`,
                top: `${d.top}%`,
                width: d.width,
                height: `${d.height}rem`,
                transform: `rotate(${d.tilt}deg)`,
                background: `linear-gradient(to bottom, transparent 0%, hsl(200 85% 80% / ${d.opacity * 0.6}) 40%, hsl(210 95% 90% / ${d.opacity}) 100%)`,
                borderRadius: 999,
                filter: d.blur ? `blur(${d.blur}px)` : undefined,
                willChange: "transform",
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
          {/* Splash crowns at bottom — drop-impact rings + tiny rebound droplets */}
          {splashes.map((s, i) => (
            <div
              key={`splash-wrap-${i}`}
              className="absolute"
              style={{ left: `${s.left}%`, bottom: "1%" }}
            >
              <motion.div
                className="rounded-full border"
                style={{
                  width: s.size,
                  height: s.size * 0.35,
                  borderColor: "hsl(200 80% 88% / 0.7)",
                  borderWidth: 1,
                }}
                animate={{ scale: [0, 1.8, 0], opacity: [0, 0.85, 0] }}
                transition={{
                  duration: s.duration,
                  repeat: Infinity,
                  delay: s.delay,
                  ease: "easeOut",
                }}
              />
              {/* Rebound mini-droplet */}
              <motion.div
                className="absolute left-1/2 top-0 rounded-full"
                style={{
                  width: 2,
                  height: 2,
                  marginLeft: -1,
                  background: "hsl(205 90% 92% / 0.9)",
                }}
                animate={{ y: [0, -s.size * 0.6, 0], opacity: [0, 1, 0] }}
                transition={{
                  duration: s.duration,
                  repeat: Infinity,
                  delay: s.delay,
                  ease: "easeOut",
                }}
              />
            </div>
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
          {/* Heavy dark wash with rolling cloud darkening */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, hsl(240 35% 10% / 0.55) 0%, hsl(230 40% 16% / 0.42) 50%, hsl(245 45% 8% / 0.58) 100%)",
            }}
            animate={{ opacity: [1, 0.78, 1, 0.85, 1] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Drifting storm clouds — heavy & dark */}
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={`storm-cloud-${i}`}
              className="absolute rounded-full"
              style={{
                top: `${2 + i * 8}%`,
                width: 420 + rand(i + 71) * 280,
                height: (420 + rand(i + 71) * 280) * 0.42,
                background:
                  "radial-gradient(ellipse at center, hsl(235 30% 18% / 0.7) 0%, hsl(240 25% 12% / 0.45) 55%, transparent 78%)",
                filter: "blur(28px)",
              }}
              initial={{ x: "-20%" }}
              animate={{ x: "120%" }}
              transition={{
                duration: 80 + i * 20,
                repeat: Infinity,
                ease: "linear",
                delay: i * 12,
              }}
            />
          ))}
          {/* Heavy slanted rain — dense + motion-blurred */}
          {Array.from({ length: 180 }).map((_, i) => {
            const left = rand(i + 100) * 100;
            const top = -rand(i + 200) * 25;
            const height = 2.5 + rand(i + 300) * 7;
            const layer = i % 3;
            const depth = layer === 0 ? 0.45 : layer === 1 ? 0.75 : 1;
            return (
              <motion.div
                key={`storm-rain-${i}`}
                className="absolute"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: 0.8 + depth * 1.4,
                  height: `${height * depth}rem`,
                  transform: "rotate(-16deg)",
                  background:
                    "linear-gradient(to bottom, transparent 0%, hsl(220 70% 80% / 0.55) 55%, hsl(230 90% 92% / 0.8) 100%)",
                  borderRadius: 999,
                  filter: layer === 0 ? "blur(1.4px)" : layer === 1 ? "blur(0.5px)" : undefined,
                  willChange: "transform",
                }}
                animate={{ y: ["0vh", "120vh"] }}
                transition={{
                  duration: (0.35 + rand(i + 400) * 0.3) / depth,
                  repeat: Infinity,
                  delay: rand(i + 500) * 1.5,
                  ease: "linear",
                }}
              />
            );
          })}
          {/* Splash crowns under heavy rain */}
          {splashes.map((s, i) => (
            <motion.div
              key={`storm-splash-${i}`}
              className="absolute rounded-full border"
              style={{
                left: `${s.left}%`,
                bottom: "1%",
                width: s.size * 1.4,
                height: s.size * 0.4,
                borderColor: "hsl(215 80% 90% / 0.85)",
                borderWidth: 1,
              }}
              animate={{ scale: [0, 2.2, 0], opacity: [0, 0.95, 0] }}
              transition={{
                duration: s.duration * 0.8,
                repeat: Infinity,
                delay: s.delay,
                ease: "easeOut",
              }}
            />
          ))}
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

          {/* Lightning bolts — multiple branched, randomly flashing with afterglow */}
          {bolts.map((b, idx) => (
            <motion.svg
              key={`bolt-${idx}`}
              className="absolute"
              style={{
                top: b.top,
                left: b.left,
                width: 130 * b.scale,
                height: 340 * b.scale,
                filter:
                  "drop-shadow(0 0 6px hsl(0 0% 100% / 1)) drop-shadow(0 0 18px hsl(220 100% 88% / 0.95)) drop-shadow(0 0 50px hsl(230 95% 65% / 0.75))",
              }}
              viewBox="0 0 100 300"
              animate={{
                opacity:
                  idx === 0
                    ? [0, 0, 0, 0, 0, 1, 0.1, 0.95, 0.05, 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                    : idx === 1
                    ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.15, 0.7, 0.05, 0.3, 0, 0, 0, 0, 0, 0]
                    : [0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0.1, 0.45, 0, 0],
              }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
            >
              {/* Outer glow halo */}
              <path
                d={b.main}
                fill="none"
                stroke="hsl(220 100% 85% / 0.6)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main bright bolt */}
              <path
                d={b.main}
                fill="none"
                stroke="hsl(0 0% 100%)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Inner hot core */}
              <path
                d={b.main}
                fill="none"
                stroke="hsl(220 100% 96%)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {b.branches.map((br, j) => (
                <g key={`branch-${idx}-${j}`}>
                  <path
                    d={br}
                    fill="none"
                    stroke="hsl(220 100% 85% / 0.5)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={br}
                    fill="none"
                    stroke="hsl(0 0% 100%)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.95}
                  />
                </g>
              ))}
            </motion.svg>
          ))}
        </>
      )}
    </div>
  );
};

export default WeatherAmbience;
