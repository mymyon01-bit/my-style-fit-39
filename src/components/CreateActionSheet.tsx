import { Camera, Film, Shirt, LayoutGrid, Link as LinkIcon, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface CreateActionSheetProps {
  open: boolean;
  onClose: () => void;
}

interface ActionItem {
  key: string;
  Icon: typeof Camera;
  label: string;
  caption: string;
  to: string;
}

const ACTIONS: ActionItem[] = [
  { key: "photo", Icon: Camera, label: "Post Photo", caption: "Share today's OOTD", to: "/feed?action=post-photo" },
  { key: "video", Icon: Film, label: "Post Video", caption: "Reels-style fit clip", to: "/feed?action=post-video" },
  { key: "outfit", Icon: Shirt, label: "Create Outfit", caption: "Build a look", to: "/fit" },
  { key: "showroom", Icon: LayoutGrid, label: "Create Showroom", caption: "Curate a collection", to: "/showroom/new" },
  { key: "link", Icon: LinkIcon, label: "Paste Product Link", caption: "Save from the web", to: "/discover?action=paste-link" },
];

const CreateActionSheet = ({ open, onClose }: CreateActionSheetProps) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm md:hidden"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[141] rounded-t-3xl border-t border-border/40 bg-background/95 backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/15" />
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-[10px] font-semibold tracking-[0.22em] text-foreground/55 uppercase">Create</span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-foreground/55 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 pb-3">
              {ACTIONS.map(({ key, Icon, label, caption, to }) => (
                <button
                  key={key}
                  onClick={() => {
                    onClose();
                    navigate(to);
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-accent/[0.06]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground/90">{label}</span>
                    <span className="block text-[11px] text-foreground/50">{caption}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateActionSheet;
