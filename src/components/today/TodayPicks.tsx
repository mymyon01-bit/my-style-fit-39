import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useWeather } from "@/hooks/useWeather";
import { useAirQuality } from "@/hooks/useAirQuality";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Cloud, Wind, RefreshCw } from "lucide-react";
import TodayQuizSheet from "./TodayQuizSheet";
import TodayLooksGrid from "./TodayLooksGrid";
import { generateTodayLooks, type TodayLook } from "@/lib/today/generateLooks";
import type { QuizAnswer } from "@/lib/today/quizOptions";

const AQI_LABEL: Record<string, string> = {
  good: "Clean air",
  moderate: "Moderate dust",
  unhealthy: "Heavy dust",
  hazardous: "Hazardous air",
};

export default function TodayPicks() {
  const { user } = useAuth();
  const weather = useWeather();
  const aq = useAirQuality();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer | null>(null);
  const [loaded, setLoaded] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // Load today's answers from DB
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("today_quiz_answers")
        .select("occasion, style, craving")
        .eq("user_id", user.id)
        .eq("quiz_date", today)
        .maybeSingle();
      if (data) setAnswers({ occasion: data.occasion, style: data.style, craving: data.craving });
      setLoaded(true);
    })();
  }, [user, today]);

  const looks = useMemo<TodayLook[]>(() => {
    if (!answers || weather.loading) return [];
    return generateTodayLooks({
      temp: weather.temp,
      condition: weather.condition,
      aqiLevel: aq.level,
      answers,
    });
  }, [answers, weather.temp, weather.condition, weather.loading, aq.level]);

  const handleSubmitQuiz = async (a: QuizAnswer) => {
    setAnswers(a);
    setOpen(false);
    if (!user) return;
    await supabase.from("today_quiz_answers").upsert(
      {
        user_id: user.id,
        quiz_date: today,
        occasion: a.occasion,
        style: a.style,
        craving: a.craving,
        weather_snapshot: { temp: weather.temp, condition: weather.condition, location: weather.location },
        aqi_snapshot: { pm25: aq.pm25, pm10: aq.pm10, level: aq.level },
      },
      { onConflict: "user_id,quiz_date" }
    );
  };

  const handleShareToOOTD = (look: TodayLook) => {
    const draft = {
      caption: `${look.title} — ${look.vibe}\n${look.reason}`,
      style_tags: [look.vibe.split(" · ")[1] ?? "minimal"],
      occasion_tags: [answers?.occasion ?? "casual"],
      weather_tag: look.weatherTag,
    };
    sessionStorage.setItem("ootd:draft", JSON.stringify(draft));
    navigate("/ootd?from=today");
    toast({ title: "Look ready", description: "Add a photo to share your look." });
  };

  const handleTry = (look: TodayLook) => {
    sessionStorage.setItem("fit:look", JSON.stringify(look));
    navigate("/fit");
  };

  if (!loaded) {
    return <div className="py-10 text-center text-[11px] text-foreground/50">Loading…</div>;
  }

  return (
    <div className="space-y-6 md:space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-accent/80" />
            <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/65">TODAY'S 5 LOOKS</p>
          </div>
          <p className="font-display text-xl text-foreground/90 md:text-2xl">
            Curated for {answers ? "you" : "your day"}
          </p>
          {!weather.loading && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground/60">
              <span className="flex items-center gap-1.5"><Cloud className="h-3 w-3" /> {weather.temp}° {weather.condition}</span>
              <span className="flex items-center gap-1.5"><Wind className="h-3 w-3" /> {AQI_LABEL[aq.level]} · PM2.5 {aq.pm25}</span>
              {weather.location && <span className="text-foreground/45">{weather.location}</span>}
            </div>
          )}
        </div>
        {answers && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-foreground/50 hover:text-foreground/85"
          >
            <RefreshCw className="h-3 w-3" /> REDO
          </button>
        )}
      </div>

      {/* CTA or grid */}
      {!answers ? (
        <div className="rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-7 md:p-9 text-center">
          <p className="font-display text-lg text-foreground/85 mb-2">3 quick taps. 5 looks.</p>
          <p className="text-[12px] leading-[1.8] text-foreground/60 max-w-sm mx-auto mb-5">
            Tell us your occasion, your style, and what you're craving — we'll match it with today's weather and air quality.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[11px] font-medium tracking-[0.2em] text-background hover:bg-foreground/85 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> START QUIZ
          </button>
        </div>
      ) : (
        <TodayLooksGrid looks={looks} onShareToOOTD={handleShareToOOTD} onTry={handleTry} />
      )}

      <TodayQuizSheet
        open={open}
        onOpenChange={setOpen}
        onSubmit={handleSubmitQuiz}
        initial={answers ?? undefined}
      />
    </div>
  );
}
