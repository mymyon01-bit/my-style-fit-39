import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DailyPicks from "@/components/DailyPicks";
import WeeklyPlan from "@/components/WeeklyPlan";
import { motion } from "framer-motion";

interface SavedItem {
  id: string;
  product_id: string;
  created_at: string;
}

const DiscoverPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get("category");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { loadSavedItems(); }, [user]);

  const loadSavedItems = async () => {
    setIsLoading(true);
    if (user) {
      const { data } = await supabase.from("saved_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setSavedItems(data || []);
    }
    setIsLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: { type: "mood-styling", context: { mood: searchQuery, weather: { temp: 22, condition: "clear" }, location: "your city", occasion: "daily" } },
      });
      if (!error && data?.response) setAiResult(data.response);
    } catch {
      setAiResult("Could not reach the stylist. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
      {/* Header */}
      <div className="mx-auto max-w-lg px-8 pt-10 pb-2 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/30 md:text-[13px] lg:hidden">WARDROBE</span>
          <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/25 md:text-[11px]">DISCOVER</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 pt-8 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12 lg:pt-10">
        {/* Search */}
        <div className="flex items-center gap-3 pb-4">
          <Search className="h-4 w-4 text-foreground/20 md:h-5 md:w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mood, style, or occasion…"
            className="w-full bg-transparent text-[14px] font-light text-foreground outline-none placeholder:text-foreground/30 md:text-base lg:text-lg"
          />
          {searchQuery && !aiLoading && (
            <button onClick={handleSearch}>
              <Sparkles className="h-4 w-4 text-accent/40 hover:text-accent/70 transition-colors" />
            </button>
          )}
          {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-foreground/25" />}
        </div>
        <div className="h-px bg-accent/[0.10]" />

        {categoryFilter && (
          <div className="mt-6 flex items-center gap-2">
            <span className="text-[10px] tracking-[0.2em] text-foreground/30">{categoryFilter.toUpperCase()}</span>
            <button onClick={() => navigate("/discover")} className="text-[10px] text-accent/50 hover:text-accent">Clear</button>
          </div>
        )}

        {/* AI Result */}
        {aiResult && (
          <div className="mt-12 space-y-4 md:mt-14 lg:space-y-5">
            <p className="text-[10px] font-medium tracking-[0.25em] text-accent/60 md:text-[11px]">AI STYLIST</p>
            <p className="font-display text-[15px] font-light leading-[2] text-foreground/75 whitespace-pre-line md:text-base lg:text-lg lg:leading-[2.1]">
              {aiResult}
            </p>
            <div className="h-px w-10 bg-accent/[0.10]" />
          </div>
        )}

        {/* Daily + Weekly — premium content integrated into Discover */}
        <div className="mt-14 space-y-16 md:mt-16 md:space-y-20 lg:space-y-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <DailyPicks />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <WeeklyPlan />
          </motion.div>
        </div>

        {/* Content */}
        <div className="mt-14 md:mt-16 lg:mt-20">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-4 w-4 animate-spin text-foreground/15" />
            </div>
          ) : (
            <>
              {user && savedItems.length > 0 && (
                <div className="space-y-5">
                  <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/25 md:text-[11px]">SAVED</p>
                  <div className="space-y-3">
                    {savedItems.map(item => (
                      <div key={item.id} className="py-4">
                        <p className="text-[13px] text-foreground/50 md:text-sm">Product #{item.product_id}</p>
                        <p className="text-[11px] text-foreground/25 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!aiResult && savedItems.length === 0 && (
                <div className="py-20 text-center space-y-5 md:py-24 lg:py-28">
                  <Sparkles className="mx-auto h-5 w-5 text-foreground/10" />
                  <p className="font-display text-lg text-foreground/40 md:text-xl">Ask your stylist</p>
                  <p className="mx-auto max-w-[260px] text-[12px] leading-[1.8] text-foreground/25 md:max-w-xs md:text-[13px]">
                    Type a mood, occasion, or style to get personalized direction.
                  </p>
                  {!user && (
                    <button onClick={() => navigate("/auth")} className="text-[10px] font-medium tracking-[0.2em] text-foreground/30 transition-colors hover:text-foreground/45">
                      SIGN IN TO SAVE
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverPage;
