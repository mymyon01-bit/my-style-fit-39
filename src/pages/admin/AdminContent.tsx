import { Star, TrendingUp } from "lucide-react";

const AdminContent = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-display text-foreground/80">Content Management</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/20 bg-card/30 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-accent/60" />
            <span className="text-[12px] font-medium text-foreground/75">Featured Content</span>
          </div>
          <p className="text-[11px] text-foreground/75 leading-relaxed">
            Mark products as featured in the Products tab. Featured items appear in the Discover page's "New / Featured" section.
          </p>
        </div>

        <div className="rounded-xl border border-border/20 bg-card/30 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent/60" />
            <span className="text-[12px] font-medium text-foreground/75">Trending Topics</span>
          </div>
          <p className="text-[11px] text-foreground/75 leading-relaxed">
            OOTD topics are community-driven. The most popular topics are surfaced automatically based on post count.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminContent;
