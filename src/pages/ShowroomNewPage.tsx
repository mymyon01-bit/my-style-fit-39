import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Lock, Globe, Link2 } from "lucide-react";
import { SHOWROOM_THEMES, getTheme } from "@/lib/showroom/themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ShowroomNewPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [theme, setTheme] = useState("minimal_gallery");
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "invite_only">("public");
  const [creating, setCreating] = useState(false);

  const themeObj = getTheme(theme);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-foreground/70">Sign in to create a showroom.</p>
          <Button onClick={() => navigate("/auth")} className="mt-3">Sign in</Button>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Add a title"); return; }
    setCreating(true);
    const tags = hashtags
      .split(/[,\s#]+/)
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)
      .slice(0, 12);
    const { data, error } = await supabase
      .from("showrooms")
      .insert({
        user_id: user.id,
        title: title.trim().slice(0, 80),
        intro: intro.trim().slice(0, 200) || null,
        theme,
        theme_color: themeObj.accentHex,
        hashtags: tags,
        visibility,
      })
      .select()
      .single();
    setCreating(false);
    if (error || !data) { toast.error("Couldn't create showroom"); return; }
    toast.success("Showroom created");
    navigate(`/showroom/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="rounded-full p-1 hover:bg-foreground/5">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-lg">New Showroom</h1>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-foreground/50">Step {step}/3</span>
      </div>

      {step === 1 && (
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h2 className="mb-1 font-display text-xl">Pick a theme</h2>
          <p className="mb-5 text-xs text-foreground/60">Sets the mood for your room. You can change it later.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {SHOWROOM_THEMES.map((t) => {
              const active = t.key === theme;
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={`relative aspect-[4/5] overflow-hidden rounded-xl text-left transition ${t.bgClass} ${
                    active ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : "opacity-90 hover:opacity-100"
                  }`}
                >
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                    <p className="font-display text-sm">{t.label}</p>
                    <p className="text-[10px] opacity-80">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mx-auto max-w-xl px-4 py-6">
          <h2 className="mb-1 font-display text-xl">Name your room</h2>
          <p className="mb-5 text-xs text-foreground/60">Title, one-line intro, and a few hashtags.</p>
          <label className="text-xs text-foreground/70">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Quiet Luxury Closet" className="mt-1 mb-4" />
          <label className="text-xs text-foreground/70">Intro</label>
          <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={200} placeholder="One line about this room…" rows={2} className="mt-1 mb-4" />
          <label className="text-xs text-foreground/70">Hashtags</label>
          <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="luxury, evening, neutral" className="mt-1" />
          <p className="mt-1 text-[10px] text-foreground/40">Comma or space separated. Suggested: {themeObj.suggestedTags.join(", ")}</p>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!title.trim()}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mx-auto max-w-xl px-4 py-6">
          <h2 className="mb-1 font-display text-xl">Visibility</h2>
          <p className="mb-5 text-xs text-foreground/60">You can change this anytime.</p>
          <div className="space-y-2">
            {[
              { key: "public", icon: Globe, label: "Public", desc: "Anyone can view and find in ranking." },
              { key: "invite_only", icon: Link2, label: "Invite only", desc: "Only people with the link can view." },
              { key: "private", icon: Lock, label: "Private", desc: "Only you." },
            ].map(({ key, icon: Icon, label, desc }) => (
              <button
                key={key}
                onClick={() => setVisibility(key as any)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                  visibility === key ? "border-accent bg-accent/5" : "border-foreground/10 hover:border-foreground/20"
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 text-foreground/70" />
                <div>
                  <p className="text-sm">{label}</p>
                  <p className="text-[11px] text-foreground/55">{desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Showroom"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowroomNewPage;
