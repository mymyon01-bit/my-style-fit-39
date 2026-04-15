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
      if (!error && data?.response) {
        setAiResult(data.response);
      }
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
          <span className="font-display text-[13px] font-semibold tracking-[0.25em] text-foreground/70">WARDROBE</span>
          <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/40">DISCOVER</span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6">
        {/* Search */}
        <div className="flex items-center gap-2.5 rounded-xl bg-card/60 px-4 py-3 backdrop-blur-sm">
          <Search className="h-4 w-4 text-foreground/25" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for a style, mood, or occasion…"
            className="w-full bg-transparent text-sm font-light text-foreground outline-none placeholder:text-foreground/30"
          />
          {searchQuery && !aiLoading && (
            <button onClick={handleSearch} className="shrink-0">
              <Sparkles className="h-4 w-4 text-accent/60 hover:text-accent" />
            </button>
          )}
          {aiLoading && <Loader2 className="h-4 w-4 animate-spin text-foreground/30 shrink-0" />}
        </div>

        {categoryFilter && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">
              FILTERED: {categoryFilter.toUpperCase()}
            </span>
            <button
              onClick={() => navigate("/discover")}
              className="text-[10px] text-accent hover:underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* AI search result */}
        {aiResult && (
          <div className="mt-5 rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 backdrop-blur-sm">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-accent mb-3">AI STYLIST</p>
            <p className="text-sm font-light leading-relaxed text-foreground/80 whitespace-pre-line">
              {aiResult}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-foreground/25" />
            </div>
          ) : (
            <>
              {/* Saved items section */}
              {user && savedItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30 mb-3">SAVED ITEMS</p>
                  <div className="space-y-2">
                    {savedItems.map(item => (
                      <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-card/30 p-4">
                        <p className="text-xs text-foreground/50">Product #{item.product_id}</p>
                        <p className="text-[10px] text-foreground/30 mt-1">
                          Saved {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Beta prompt */}
              {!aiResult && (
                <div className="py-10 text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-2xl border border-dashed border-foreground/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-foreground/15" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground/45">Ask your AI stylist</p>
                    <p className="text-xs text-foreground/30 max-w-xs mx-auto leading-relaxed">
                      Type a mood, occasion, or style above to get personalized recommendations. Your saved items and interactions build your feed over time.
                    </p>
                  </div>
                  {!user && (
                    <button
                      onClick={() => navigate("/auth")}
                      className="mx-auto mt-4 rounded-xl bg-foreground/5 px-6 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-foreground/45 transition-colors hover:bg-foreground/10"
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
