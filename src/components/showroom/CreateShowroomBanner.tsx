import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, LayoutGrid } from "lucide-react";

/**
 * Soft banner that invites users to create a personal Showroom.
 * Used on OOTD My Page above the post-OOTD button.
 * Keeps the WARDROBE tone: muted accents, font-display, semantic tokens.
 */
const CreateShowroomBanner = () => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/showroom/new")}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-accent/15 bg-gradient-to-br from-accent/[0.06] via-background to-background p-4 text-left transition-colors hover:border-accent/30"
    >
      {/* subtle sparkle */}
      <Sparkles className="pointer-events-none absolute -right-2 -top-2 h-16 w-16 text-accent/[0.06]" />

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent/80">
        <LayoutGrid className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-display text-[14px] text-foreground/90">Create your Showroom</p>
          <span className="rounded-full border border-accent/30 px-1.5 py-[1px] text-[8px] font-semibold tracking-[0.18em] text-accent/80">NEW</span>
        </div>
        <p className="text-[11px] leading-relaxed text-foreground/60">
          Curate a personal style room — themes, playlists, and party looks.
        </p>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </button>
  );
};

export default CreateShowroomBanner;
