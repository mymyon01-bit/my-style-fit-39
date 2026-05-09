import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Crown, Loader2, UserMinus, Palette, LayoutGrid, Check, Sparkles, Square, Layers, Megaphone, Pin } from "lucide-react";
import WaveBackground, { WAVE_BG_OPTIONS } from "./WaveBackground";
import { fetchWaveMembers, type Wave, type WaveMember } from "@/hooks/useWaves";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  wave: Wave;
  isOwner: boolean;
  isAdmin: boolean;
  onWaveDeleted: () => void;
  onWaveUpdated?: () => void;
}

const PRESETS: { name: string; c1: string; c2: string }[] = [
  { name: "Sunset",   c1: "hsl(330 85% 60%)", c2: "hsl(280 70% 55%)" },
  { name: "Ocean",    c1: "hsl(200 90% 55%)", c2: "hsl(260 70% 55%)" },
  { name: "Mint",     c1: "hsl(160 70% 55%)", c2: "hsl(200 80% 55%)" },
  { name: "Citrus",   c1: "hsl(40 95% 60%)",  c2: "hsl(15 90% 60%)"  },
  { name: "Forest",   c1: "hsl(150 60% 45%)", c2: "hsl(90 50% 45%)"  },
  { name: "Mono",     c1: "hsl(0 0% 25%)",    c2: "hsl(0 0% 55%)"    },
  { name: "Berry",    c1: "hsl(340 80% 55%)", c2: "hsl(20 85% 60%)"  },
  { name: "Aurora",   c1: "hsl(170 80% 55%)", c2: "hsl(290 75% 60%)" },
];

const TINTS: { name: string; color: string }[] = [
  { name: "Slate",  color: "hsl(220 15% 35%)" },
  { name: "Rose",   color: "hsl(330 70% 55%)" },
  { name: "Violet", color: "hsl(265 65% 60%)" },
  { name: "Sky",    color: "hsl(200 80% 55%)" },
  { name: "Mint",   color: "hsl(160 60% 50%)" },
  { name: "Amber",  color: "hsl(40 85% 55%)"  },
  { name: "White",  color: "hsl(0 0% 95%)"    },
  { name: "Ink",    color: "hsl(0 0% 8%)"     },
];

export default function WaveAdminPanel({ open, onClose, wave, isOwner, isAdmin, onWaveDeleted, onWaveUpdated }: Props) {
  const [members, setMembers] = useState<WaveMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [c1, setC1] = useState<string>((wave as any).theme_color || PRESETS[0].c1);
  const [c2, setC2] = useState<string>((wave as any).theme_color_2 || PRESETS[0].c2);
  const [animated, setAnimated] = useState<boolean>(!!(wave as any).theme_animated);
  const [bgAnim, setBgAnim] = useState<string>((wave as any).bg_animation || "none");
  const [borderColor, setBorderColor] = useState<string | null>((wave as any).card_border_color ?? null);
  const [cardBg, setCardBg] = useState<string | null>((wave as any).card_bg_color ?? null);
  const [savingTheme, setSavingTheme] = useState(false);
  const [announcement, setAnnouncement] = useState<string>((wave as any).announcement || "");
  const [pinned, setPinned] = useState<boolean>(!!(wave as any).announcement_pinned);
  const [savingAnn, setSavingAnn] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchWaveMembers(wave.id).then(m => { setMembers(m); setLoading(false); });
    setC1((wave as any).theme_color || PRESETS[0].c1);
    setC2((wave as any).theme_color_2 || PRESETS[0].c2);
    setAnimated(!!(wave as any).theme_animated);
    setBgAnim((wave as any).bg_animation || "none");
    setBorderColor((wave as any).card_border_color ?? null);
    setCardBg((wave as any).card_bg_color ?? null);
    setAnnouncement((wave as any).announcement || "");
    setPinned(!!(wave as any).announcement_pinned);
  }, [open, wave.id]);

  if (!open) return null;

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await supabase.from("wave_members").delete().eq("wave_id", wave.id).eq("user_id", userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteWave = async () => {
    if (!confirm(`Delete the wave "${wave.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("waves").delete().eq("id", wave.id);
      if (error) throw error;
      toast.success("Wave deleted");
      onWaveDeleted();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const saveTheme = async (next?: Partial<{ c1: string; c2: string; animated: boolean; bgAnim: string; borderColor: string | null; cardBg: string | null }>) => {
    if (!isAdmin) return;
    const payload: any = {
      theme_color: next?.c1 ?? c1,
      theme_color_2: next?.c2 ?? c2,
      theme_animated: next?.animated ?? animated,
      bg_animation: next?.bgAnim ?? bgAnim,
      card_border_color: next?.borderColor !== undefined ? next.borderColor : borderColor,
      card_bg_color: next?.cardBg !== undefined ? next.cardBg : cardBg,
    };
    setSavingTheme(true);
    try {
      const { error } = await supabase.from("waves").update(payload).eq("id", wave.id);
      if (error) throw error;
      toast.success("Saved");
      onWaveUpdated?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingTheme(false); }
  };

  const applyPreset = (p: typeof PRESETS[number]) => {
    setC1(p.c1); setC2(p.c2);
    saveTheme({ c1: p.c1, c2: p.c2 });
  };

  const toggleAnimated = () => {
    const next = !animated;
    setAnimated(next);
    saveTheme({ animated: next });
  };

  const setBg = (id: string) => { setBgAnim(id); saveTheme({ bgAnim: id }); };
  const setBorder = (color: string | null) => { setBorderColor(color); saveTheme({ borderColor: color }); };
  const setCard = (color: string | null) => { setCardBg(color); saveTheme({ cardBg: color }); };

  const saveAnnouncement = async (nextPinned?: boolean) => {
    if (!isAdmin) return;
    setSavingAnn(true);
    try {
      const { error } = await supabase.from("waves").update({
        announcement: announcement.trim() || null,
        announcement_pinned: nextPinned ?? pinned,
      }).eq("id", wave.id);
      if (error) throw error;
      toast.success("Announcement saved");
      onWaveUpdated?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingAnn(false); }
  };

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    saveAnnouncement(next);
  };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 backdrop-blur p-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5"><X className="h-3.5 w-3.5" /></button>
          <h3 className="text-[16px] font-bold text-foreground">Customize · {wave.name}</h3>

          {/* ANNOUNCEMENT */}
          {isAdmin && (
            <section className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/[0.04] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[10px] font-semibold tracking-wide text-foreground/65">ANNOUNCEMENT · PIN TO TOP</p>
                {savingAnn && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
              </div>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                onBlur={() => saveAnnouncement()}
                placeholder="Write a notice for your wave members (e.g. event, rules, this week's theme)…"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-border/40 bg-background px-3 py-2 text-[12px] leading-relaxed text-foreground placeholder:text-foreground/35 focus:border-amber-400/60 focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <button onClick={togglePinned}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    pinned ? "bg-amber-400/15 text-amber-500" : "bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/10"
                  }`}>
                  <Pin className={`h-3 w-3 ${pinned ? "fill-current" : ""}`} />
                  {pinned ? "Pinned to top" : "Pin to top"}
                </button>
                <span className="text-[10px] text-foreground/40">{announcement.length}/500</span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-foreground/50">
                Pinned announcements appear as a sticky banner at the top of the wave for everyone.
              </p>
            </section>
          )}
          {/* BACKGROUND */}
          {isAdmin && (
            <section className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="h-3.5 w-3.5 text-foreground/60" />
                <p className="text-[10px] font-semibold tracking-wide text-foreground/55">BACKGROUND</p>
                {savingTheme && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
              </div>

              {/* Live preview */}
              <div className="relative h-20 w-full overflow-hidden rounded-2xl border border-border/30">
                <div
                  className={`absolute inset-0 ${animated ? "wave-anim-bg" : ""}`}
                  style={{
                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                    backgroundSize: animated ? "200% 200%" : undefined,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-white/90 text-[11px] font-semibold tracking-wide">
                  PREVIEW
                </div>
              </div>

              {/* Presets */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {PRESETS.map((p) => {
                  const active = p.c1 === c1 && p.c2 === c2;
                  return (
                    <button key={p.name} onClick={() => applyPreset(p)}
                      className={`relative h-10 rounded-xl overflow-hidden border ${active ? "border-foreground" : "border-border/30"}`}
                      title={p.name}>
                      <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Animate toggle */}
              <button onClick={toggleAnimated}
                className={`mt-3 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  animated ? "border-accent/50 bg-accent/[0.06]" : "border-border/40 bg-foreground/[0.02] hover:bg-foreground/[0.05]"
                }`}>
                <span className="flex items-center gap-2 text-[12px] font-semibold text-foreground/85">
                  <Sparkles className={`h-3.5 w-3.5 ${animated ? "text-accent" : "text-foreground/55"}`} />
                  Animated background
                </span>
                <span className={`text-[10px] font-bold tracking-wide ${animated ? "text-accent" : "text-foreground/45"}`}>
                  {animated ? "ON" : "OFF"}
                </span>
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-foreground/50">
                Pick two colors — turn on Animated to make the wave's banner gently shift between them.
              </p>
            </section>
          )}

          {/* GRAPHIC ANIMATED BACKGROUND */}
          {isAdmin && (
            <section className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-3.5 w-3.5 text-foreground/60" />
                <p className="text-[10px] font-semibold tracking-wide text-foreground/55">ANIMATED GRAPHIC BACKGROUND</p>
              </div>
              {/* Live preview */}
              <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-border/30 bg-background">
                <WaveBackground type={bgAnim} c1={c1} c2={c2} />
                <div className="absolute inset-0 flex items-center justify-center text-foreground/80 text-[11px] font-semibold tracking-wide">
                  PREVIEW
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {WAVE_BG_OPTIONS.map((opt) => {
                  const active = opt.id === bgAnim;
                  return (
                    <button key={opt.id} onClick={() => setBg(opt.id)}
                      className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors ${
                        active ? "border-accent bg-accent/10 text-accent" : "border-border/40 text-foreground/70 hover:bg-foreground/[0.04]"
                      }`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* CARD BORDER + CARD INNER COLOR */}
          {isAdmin && (
            <section className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <Square className="h-3.5 w-3.5 text-foreground/60" />
                <p className="text-[10px] font-semibold tracking-wide text-foreground/55">CARD STYLE</p>
              </div>
              <p className="text-[11px] text-foreground/75 mb-1.5">Card border</p>
              <div className="grid grid-cols-9 gap-1.5">
                <button onClick={() => setBorder(null)}
                  title="Default"
                  className={`h-7 rounded-md border-2 ${borderColor === null ? "border-foreground" : "border-border/40"} bg-foreground/[0.04] text-[9px] text-foreground/60`}>
                  —
                </button>
                {TINTS.map((t) => (
                  <button key={t.name} onClick={() => setBorder(t.color)}
                    title={t.name}
                    className={`h-7 rounded-md border-2 ${borderColor === t.color ? "border-foreground" : "border-border/30"}`}
                    style={{ background: t.color }} />
                ))}
              </div>

              <p className="text-[11px] text-foreground/75 mt-3 mb-1.5">Card inner tint</p>
              <div className="grid grid-cols-9 gap-1.5">
                <button onClick={() => setCard(null)}
                  title="Default"
                  className={`h-7 rounded-md border-2 ${cardBg === null ? "border-foreground" : "border-border/40"} bg-foreground/[0.04] text-[9px] text-foreground/60`}>
                  —
                </button>
                {TINTS.map((t) => (
                  <button key={t.name} onClick={() => setCard(t.color)}
                    title={t.name}
                    className={`h-7 rounded-md border-2 ${cardBg === t.color ? "border-foreground" : "border-border/30"}`}
                    style={{ background: t.color }} />
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-foreground/50">
                Card tint is applied at low opacity automatically so content (photos, text) is always clearly visible.
              </p>
            </section>
          )}

          {/* MENUS HELP */}
          {isAdmin && (
            <section className="mt-5 rounded-2xl border border-border/30 bg-foreground/[0.03] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <LayoutGrid className="h-3.5 w-3.5 text-foreground/60" />
                <p className="text-[10px] font-semibold tracking-wide text-foreground/55">HOW MENUS WORK</p>
              </div>
              <ul className="space-y-1 text-[11px] leading-relaxed text-foreground/70">
                <li>• Use the <span className="font-semibold">+ Add menu</span> button in the sidebar to create a new section (Photos, Posts, Polls, Music, Notes…).</li>
                <li>• Each menu shows up as a tab in this wave. Drag or use the up/down arrows in the sidebar to reorder.</li>
                <li>• Long-press a menu in the sidebar to rename or delete it.</li>
                <li>• Members see exactly the menus you create — keep them focused.</li>
              </ul>
            </section>
          )}

          {/* MEMBERS */}
          <section className="mt-5">
            <p className="text-[10px] font-semibold tracking-wide text-foreground/55 mb-2">MEMBERS</p>
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-foreground/40" /> : (
              <ul className="space-y-1.5">
                {members.map(m => (
                  <li key={m.user_id} className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] p-2">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
                        {(m.display_name?.[0] || m.username?.[0] || "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{m.display_name || m.username}</p>
                      <p className="text-[9.5px] text-foreground/55 capitalize flex items-center gap-1">
                        {m.role === "owner" && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                        {m.role}
                      </p>
                    </div>
                    {isAdmin && m.role !== "owner" && (
                      <button onClick={() => removeMember(m.user_id)}
                        className="rounded-full p-1.5 text-foreground/50 hover:bg-destructive/10 hover:text-destructive">
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isOwner && (
            <div className="mt-5 border-t border-border/30 pt-4">
              <p className="text-[10px] font-semibold tracking-wide text-destructive/80 mb-2">DANGER ZONE</p>
              <button onClick={deleteWave} disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-[12px] font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-40">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete this wave
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes waveBgShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .wave-anim-bg { animation: waveBgShift 8s ease-in-out infinite; }
      `}</style>
    </AnimatePresence>
  );
}
