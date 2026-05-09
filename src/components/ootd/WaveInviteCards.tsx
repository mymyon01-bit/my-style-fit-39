import { Check, X, Waves, Loader2 } from "lucide-react";
import { useState } from "react";
import { usePendingWaveInvites, acceptWaveInvite, declineWaveInvite } from "@/hooks/useWaves";
import { toast } from "sonner";

export default function WaveInviteCards({ onJoined }: { onJoined?: () => void } = {}) {
  const { invites, loading, refresh } = usePendingWaveInvites();
  const [busy, setBusy] = useState<string | null>(null);

  if (loading || invites.length === 0) return null;

  const handle = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      if (accept) { await acceptWaveInvite(id); toast.success("Joined the wave"); onJoined?.(); }
      else { await declineWaveInvite(id); toast.success("Declined"); }
      refresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-2">
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center gap-3 rounded-2xl border border-[hsl(330_85%_60%/0.3)] bg-gradient-to-r from-[hsl(330_85%_60%/0.08)] to-[hsl(280_70%_55%/0.08)] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)]">
            <Waves className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground truncate">
              {inv.inviter?.display_name || inv.inviter?.username || "Someone"} invited you
            </p>
            <p className="text-[10.5px] text-foreground/60 truncate">
              🌊 Let's ride the wave: <span className="font-semibold">{inv.wave?.name}</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => handle(inv.id, true)} disabled={busy === inv.id}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(330_85%_60%)] text-white hover:opacity-90 disabled:opacity-50">
              {busy === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button onClick={() => handle(inv.id, false)} disabled={busy === inv.id}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/15 disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
