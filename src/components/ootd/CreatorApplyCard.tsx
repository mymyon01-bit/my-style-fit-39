/**
 * CreatorApplyCard — invite path for fashion bloggers / influencers.
 *
 * Instead of scraping other platforms, creators run their own account here:
 * they apply with their channel, an admin approves, and approved accounts get
 * the CREATOR badge on every OOTD post they publish.
 */
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Blog", "Other"];

export default function CreatorApplyCard({ isCreator }: { isCreator: boolean }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("creator_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setStatus((data as any)?.status ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user || isCreator) return null;

  const submit = async () => {
    if (!handle.trim()) { toast.error("채널 아이디를 입력해 주세요"); return; }
    setSaving(true);
    const { error } = await supabase.from("creator_applications").insert({
      user_id: user.id,
      platform,
      handle: handle.trim(),
      follower_count: Number(followers.replace(/\D/g, "")) || 0,
      note: note.trim() || null,
      status: "pending",
    });
    setSaving(false);
    if (error) { toast.error("신청하지 못했어요"); return; }
    setStatus("pending");
    setOpen(false);
    toast.success("크리에이터 신청을 보냈어요");
  };

  return (
    <div className="mt-3 rounded-md border-2 border-foreground/15 bg-card p-3">
      <div className="flex items-center gap-2.5">
        <BadgeCheck className="h-4 w-4 text-accent" strokeWidth={1.9} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-foreground">Creator 계정</p>
          <p className="mt-0.5 text-[11px] text-foreground/55">
            {status === "pending"
              ? "심사 중이에요 — 승인되면 배지가 표시됩니다."
              : status === "rejected"
                ? "이번에는 승인되지 않았어요. 다시 신청할 수 있어요."
                : "패션 블로거·인플루언서라면 신청하고 피드에 CREATOR 배지를 받으세요."}
          </p>
        </div>
        {status !== "pending" && (
          <Button
            variant="outline"
            className="h-8 shrink-0 rounded-md border-2 border-foreground/15 text-[11px] font-bold uppercase"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "닫기" : "신청"}
          </Button>
        )}
      </div>

      {open && status !== "pending" && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  platform === p
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 text-foreground/65"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@채널 아이디"
            className="w-full rounded-md border-2 border-foreground/15 bg-background px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-foreground/40"
          />
          <input
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            inputMode="numeric"
            placeholder="팔로워 수"
            className="w-full rounded-md border-2 border-foreground/15 bg-background px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-foreground/40"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="어떤 스타일을 올리시나요?"
            className="w-full resize-none rounded-md border-2 border-foreground/15 bg-background px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-foreground/40"
          />
          <Button className="h-9 w-full rounded-md text-[12px] font-bold uppercase" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "신청 보내기"}
          </Button>
        </div>
      )}
    </div>
  );
}
