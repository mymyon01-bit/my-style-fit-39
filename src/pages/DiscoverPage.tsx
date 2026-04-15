import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

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

  useEffect(() => {
    loadSavedItems();
  }, [user]);

  const loadSavedItems = async () => {
    setIsLoading(true);
    if (user) {
      const { data } = await supabase
        .from("saved_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
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
        body: {
          type: "mood-styling",
          context: {
            mood: searchQuery,
            weather: { temp: 22, condition: "clear" },
            location: "your city",
            occasion: "daily",
          },
        },
      });
      if (!error && data?.response) setAiResult(data.response);
    } catch {
      setAiResult("Could not reach the stylist. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="mx-auto max-w-lg px-8 pt-8 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[11px] font-medium tracking-[0.35em] text-foreground/25">WARDROBE</span>
          <span className="text-[9px] font-medium tracking-[0.25em] text-foreground/20">DISCOVER</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-8 pt-6">
        {/* Search — minimal line input */}
        <div className="flex items-center gap-3 pb-3">
          <Search className="h-4 w-4 text-foreground/15" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mood, style, or occasion…"
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/20"
          />
          {searchQuery && !aiLoading && (
            <button onClick={handleSearch}>
              <Sparkles className="h-4 w-4 text-accent/40 hover:text-accent/70 transition-colors" />
            </button>
          )}
          {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-foreground/20" />}
        </div>
        <div className="h-px bg-foreground/[0.05]" />

        {categoryFilter && (
          <div className="mt-5 flex items-center gap-2">
            <span className="text-[9px] tracking-[0.2em] text-foreground/25">
              {categoryFilter.toUpperCase()}
            </span>
            <button onClick={() => navigate("/discover")} className="text-[9px] text-accent/50 hover:text-accent">
              Clear
            </button>
          </div>
        )}

        {/* AI Result */}
        {aiResult && (
          <div className="mt-10 space-y-3">
            <p className="text-[9px] font-medium tracking-[0.25em] text-accent/60">AI STYLIST</p>
            <p className="font-display text-[14px] font-light leading-[1.9] text-foreground/75 whitespace-pre-line">
              {aiResult}
            </p>
            <div className="h-px w-8 bg-foreground/[0.06]" />
          </div>
        )}

        {/* Content */}
        <div className="mt-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-4 w-4 animate-spin text-foreground/15" />
            </div>
          ) : (
            <>
              {user && savedItems.length > 0 && (
                <div className="space-y-4">
                  <p className="text-[9px] font-medium tracking-[0.25em] text-foreground/20">SAVED</p>
                  <div className="space-y-3">
                    {savedItems.map(item => (
                      <div key={item.id} className="py-3">
                        <p className="text-xs text-foreground/45">Product #{item.product_id}</p>
                        <p className="text-[10px] text-foreground/20 mt-1">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!aiResult && (
                <div className="py-20 text-center space-y-5">
                  <Sparkles className="mx-auto h-5 w-5 text-foreground/8" />
                  <p className="font-display text-base text-foreground/30">Ask your stylist</p>
                  <p className="mx-auto max-w-[240px] text-[11px] leading-[1.8] text-foreground/20">
                    Type a mood, occasion, or style to get personalized direction.
                  </p>
                  {!user && (
                    <button
                      onClick={() => navigate("/auth")}
                      className="text-[9px] font-medium tracking-[0.2em] text-foreground/25 transition-colors hover:text-foreground/40"
                    >
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
