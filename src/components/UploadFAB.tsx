import { useState } from "react";
import { Plus, Camera, Video, Layers, Store, Link2, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Floating "+" action button — opens a premium bottom sheet with the 6 creation
 * actions defined in the IA spec. Each action maps to an existing route/flow;
 * no business logic is changed.
 */
const HIDDEN_PREFIXES = ["/", "/auth", "/onboarding", "/admin", "/oauth", "/install"];

type Action = {
  icon: typeof Plus;
  title: string;
  desc: string;
  to: string;
};

const ACTIONS: Action[] = [
  { icon: Camera,   title: "Post Photo",        desc: "Upload an OOTD photo",          to: "/ootd?tab=mypage&upload=1&kind=photo" },
  { icon: Video,    title: "Post Video",        desc: "Share a style video",           to: "/ootd?tab=mypage&upload=1&kind=video" },
  { icon: Layers,   title: "Create Outfit",     desc: "Build a look from products",    to: "/ootd?tab=mypage&upload=1&kind=outfit" },
  { icon: Store,    title: "Create Showroom",   desc: "Curate a collection",           to: "/showroom/new" },
  { icon: Link2,    title: "Paste Product Link",desc: "Analyze or save a product",     to: "/discover?paste=1" },
  { icon: Sparkles, title: "Quick Try-On",      desc: "Try an item on your Body DNA",  to: "/fit" },
];

const UploadFAB = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const path = location.pathname;
  const hidden = path === "/" || HIDDEN_PREFIXES.some((p) => p !== "/" && path.startsWith(p));
  if (hidden) return null;

  const handle = (to: string) => {
    setOpen(false);
    setTimeout(() => navigate(to), 60);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Create"
        title="Create"
        className="fixed right-4 z-[115] md:hidden
                   bottom-[calc(72px+env(safe-area-inset-bottom)+12px)]
                   h-14 w-14 rounded-full
                   bg-accent text-accent-foreground
                   shadow-[0_10px_30px_-8px_hsl(var(--accent)/0.55)]
                   ring-1 ring-accent/40
                   flex items-center justify-center
                   active:scale-95 transition-transform"
      >
        <Plus className="h-7 w-7" strokeWidth={2.4} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="md:hidden rounded-t-3xl border-t border-foreground/10 bg-background/95 backdrop-blur-xl p-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/15" />
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div>
              <h2 className="font-display text-xl tracking-tight">Create</h2>
              <p className="text-[11px] text-foreground/55 mt-0.5">Post, build, or try on.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="h-9 w-9 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pt-2 pb-3 grid grid-cols-1 gap-1">
            {ACTIONS.map((a) => (
              <button
                key={a.title}
                onClick={() => handle(a.to)}
                className="group flex items-center gap-3.5 rounded-2xl px-3 py-3 text-left
                           hover:bg-foreground/5 active:bg-foreground/10 transition-colors"
              >
                <span className="h-11 w-11 rounded-xl bg-accent/10 text-accent
                                 flex items-center justify-center ring-1 ring-accent/15
                                 group-hover:bg-accent/15 transition-colors">
                  <a.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold leading-tight">{a.title}</span>
                  <span className="block text-[11.5px] text-foreground/55 mt-0.5 truncate">{a.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default UploadFAB;
