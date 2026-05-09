import { useEffect, useState } from "react";
import { castWavePollVote, fetchWavePollVotes, type WavePost } from "@/hooks/useWaveModules";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  post: WavePost;
  onChanged: () => void;
}

export default function WavePollView({ post, onChanged }: Props) {
  const { user } = useAuth();
  const options: string[] = post.metadata?.options ?? [];
  const question: string = post.metadata?.question ?? post.title ?? "Poll";
  const [votes, setVotes] = useState<{ user_id: string; option_index: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setVotes(await fetchWavePollVotes(post.id));
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [post.id]);

  const myVote = user ? votes.find(v => v.user_id === user.id)?.option_index ?? null : null;
  const total = votes.length || 1;

  const handleVote = async (i: number) => {
    if (!user) { toast.error("Sign in"); return; }
    try { await castWavePollVote(post.id, i); refresh(); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-[12.5px] font-semibold text-foreground">{question}</p>
      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const count = votes.filter(v => v.option_index === i).length;
          const pct = Math.round((count / total) * 100);
          const active = myVote === i;
          return (
            <button key={i} onClick={() => handleVote(i)}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-[11.5px] transition ${
                active ? "border-[hsl(330_85%_60%)] bg-[hsl(330_85%_60%/0.08)]" : "border-border/40 hover:bg-foreground/[0.04]"
              }`}>
              <div className="absolute inset-y-0 left-0 bg-[hsl(330_85%_60%/0.15)]" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between">
                <span className={`font-medium ${active ? "text-[hsl(330_85%_60%)]" : "text-foreground/85"}`}>{opt}</span>
                <span className="text-[10px] tabular-nums text-foreground/55">{loading ? "" : `${pct}% · ${count}`}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
