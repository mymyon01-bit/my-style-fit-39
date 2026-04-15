import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DailyPicks from "@/components/DailyPicks";
import WeeklyPlan from "@/components/WeeklyPlan";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import RecommendationFeed from "@/components/RecommendationFeed";
import OutfitComposition from "@/components/OutfitComposition";
import { mockProducts } from "@/lib/mockData";
import { motion, AnimatePresence } from "framer-motion";

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
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quiz + Recommendation state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);

  useEffect(() => { loadSavedItems(); }, [user]);

  const loadSavedItems = async () => {
    setIsLoading(true);
    if (user) {
      const { data } = await supabase.from("saved_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setSavedItems(data || []);
    }
    setIsLoading(false);
  };

  const handleQuizComplete = (answers: StyleQuizAnswers) => {
    setQuizAnswers(answers);
    setShowQuiz(false);
  };

  // Build an editorial outfit from top mock products
  const editorialOutfit = mockProducts.slice(0, 4).map(p => ({
    id: p.id, label: p.name, category: p.category, image: p.image, brand: p.brand,
  }));

  return (
    <>
      {/* Style Quiz Overlay */}
      <AnimatePresence>
        {showQuiz && (
          <StyleQuiz
            onComplete={handleQuizComplete}
            onClose={() => setShowQuiz(false)}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
        {/* Header */}
        <div className="mx-auto max-w-lg px-8 pt-10 pb-2 md:max-w-2xl md:px-10 md:pt-10 lg:max-w-3xl lg:px-12">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[12px] font-medium tracking-[0.35em] text-foreground/80 md:text-[13px] lg:hidden">WARDROBE</span>
            <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/62 md:text-[11px]">DISCOVER</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-8 pt-8 md:max-w-2xl md:px-10 lg:max-w-3xl lg:px-12 lg:pt-10">
          {/* Search → opens quiz */}
          <button
            onClick={() => setShowQuiz(true)}
            className="flex w-full items-center gap-3 pb-4"
          >
            <Search className="h-4 w-4 text-foreground/60 md:h-5 md:w-5" />
            <span className="text-[14px] font-light text-foreground/80 md:text-base lg:text-lg">
              {quizAnswers ? "Refine your style…" : "Find your style…"}
            </span>
            <Sparkles className="ml-auto h-4 w-4 text-accent/70" />
          </button>
          <div className="h-px bg-accent/[0.16]" />

          {categoryFilter && (
            <div className="mt-6 flex items-center gap-2">
              <span className="text-[10px] tracking-[0.2em] text-foreground/80">{categoryFilter.toUpperCase()}</span>
              <button onClick={() => navigate("/discover")} className="text-[10px] text-accent/70 hover:text-accent">Clear</button>
            </div>
          )}

          {/* Recommendation Feed — replaces text AI output */}
          {quizAnswers ? (
            <div className="mt-12 md:mt-14 lg:mt-16">
              <RecommendationFeed
                quizAnswers={quizAnswers}
                onReset={() => setQuizAnswers(null)}
              />
            </div>
          ) : (
            <>
              {/* Editorial Outfit Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mt-14 md:mt-16 lg:mt-18"
              >
                <OutfitComposition
                  pieces={editorialOutfit}
                  caption="Curated for a clean, balanced day"
                  tags={["Minimal", "22°", "Daily"]}
                />
              </motion.div>

              {/* Daily + Weekly — premium content */}
              <div className="mt-16 space-y-16 md:mt-20 md:space-y-20 lg:space-y-24">
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
            </>
          )}

          {/* Saved Items */}
          <div className="mt-14 md:mt-16 lg:mt-20">
            {isLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/80" />
              </div>
            ) : (
              <>
                {user && savedItems.length > 0 && (
                  <div className="space-y-5">
                    <p className="text-[10px] font-medium tracking-[0.25em] text-foreground/62 md:text-[11px]">SAVED</p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                      {savedItems.map(item => {
                        const product = mockProducts.find(p => p.id === item.product_id);
                        return product ? (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group"
                          >
                            <div className="overflow-hidden rounded-xl">
                              <img src={product.image} alt={product.name} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                            </div>
                            <div className="mt-2.5">
                              <p className="text-[10px] font-medium tracking-wider text-foreground/80">{product.brand}</p>
                              <p className="text-[12px] text-foreground/68 md:text-[13px]">{product.name}</p>
                              <p className="text-[12px] font-medium text-foreground/62">${product.price}</p>
                            </div>
                          </motion.div>
                        ) : (
                          <div key={item.id} className="py-4">
                            <p className="text-[13px] text-foreground/80">Product #{item.product_id}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!quizAnswers && savedItems.length === 0 && (
                  <div className="py-16 text-center space-y-5 md:py-20 lg:py-24">
                    <p className="font-display text-lg text-foreground/60 md:text-xl">Discover your style</p>
                    <p className="mx-auto max-w-[260px] text-[12px] leading-[1.8] text-foreground/62 md:max-w-xs md:text-[13px]">
                      Take the style quiz above to get curated recommendations that match your taste.
                    </p>
                    <button
                      onClick={() => setShowQuiz(true)}
                      className="text-[10px] font-medium tracking-[0.2em] text-accent/70 transition-colors hover:text-accent"
                    >
                      START QUIZ
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DiscoverPage;
