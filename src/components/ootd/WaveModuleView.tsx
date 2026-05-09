import { useMemo, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useWavePosts, type WaveModule } from "@/hooks/useWaveModules";
import WavePostCard from "./WavePostCard";
import WaveComposeDialog from "./WaveComposeDialog";
import ImageLightbox from "./ImageLightbox";

interface Props {
  module: WaveModule;
  waveId: string;
  isAdmin: boolean;
}

export default function WaveModuleView({ module, waveId, isAdmin }: Props) {
  const { posts, loading, refresh } = useWavePosts(module.id);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-foreground">{module.label}</h3>
        <button onClick={() => setComposeOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-[hsl(330_85%_60%)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_-4px_hsl(330_85%_60%/0.5)] hover:opacity-95">
          <Plus className="h-3 w-3" /> Post
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-foreground/40" /></div>
      ) : posts.length === 0 ? (
        <p className="py-12 text-center text-[12px] text-foreground/45">Be the first to post here.</p>
      ) : module.kind === "photos" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {posts.map(p => p.image_urls?.[0] && (
            <div key={p.id} className="aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
              <img src={p.image_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {posts.map(p => (
            <WavePostCard key={p.id} post={p} isAdmin={isAdmin} onChanged={refresh} />
          ))}
        </div>
      )}

      <WaveComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)}
        module={module} waveId={waveId} onCreated={refresh} />
    </div>
  );
}
