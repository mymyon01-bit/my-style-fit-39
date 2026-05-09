import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, LogOut, Waves, Loader2, Heart, Settings2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { leaveWave, followWave, unfollowWave, useWaveFollow, type Wave } from "@/hooks/useWaves";
import { useWaveModules } from "@/hooks/useWaveModules";
import { supabase } from "@/integrations/supabase/client";
import InviteToWaveSheet from "./InviteToWaveSheet";
import WaveSidebar from "./WaveSidebar";
import WaveModuleView from "./WaveModuleView";
import AddModuleSheet from "./AddModuleSheet";
import WaveAdminPanel from "./WaveAdminPanel";
import WaveMusicPicker from "./WaveMusicPicker";
import WaveBackground from "./WaveBackground";
import { toast } from "sonner";

interface WaveModalProps {
  open: boolean;
  wave: Wave | null;
  onClose: () => void;
  onLeft?: () => void;
  onWaveUpdated?: () => void;
  /** Render inline (in the page flow) instead of as a fullscreen overlay. */
  inline?: boolean;
}

export default function WaveModal({ open, wave, onClose, onLeft, onWaveUpdated, inline }: WaveModalProps) {
  const { user } = useAuth();
  const { modules, loading: modulesLoading, refresh: refreshModules } = useWaveModules(open && wave ? wave.id : null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [myRole, setMyRole] = useState<"owner" | "admin" | "member" | null>(null);
  const { following, count: followerCount, refresh: refreshFollow, setFollowing } = useWaveFollow(open && wave ? wave.id : null);

  // Resolve role
  useEffect(() => {
    if (!open || !wave || !user) { setMyRole(null); return; }
    if (wave.role) { setMyRole(wave.role); return; }
    supabase.from("wave_members").select("role")
      .eq("wave_id", wave.id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMyRole((data as any)?.role ?? null));
  }, [open, wave?.id, user?.id]);

  // Auto-select first module
  useEffect(() => {
    if (modules.length === 0) { setSelectedId(null); return; }
    if (!selectedId || !modules.find(m => m.id === selectedId)) {
      setSelectedId(modules[0].id);
    }
  }, [modules, selectedId]);

  // Auto-create a default photos module if owner enters an empty wave
  useEffect(() => {
    if (!open || !wave || modulesLoading) return;
    if (modules.length === 0 && (myRole === "owner" || myRole === "admin")) {
      supabase.from("wave_modules" as any).insert({
        wave_id: wave.id, kind: "photos", label: "Photos", position: 0,
      }).then(() => refreshModules());
    }
  }, [open, wave, modulesLoading, modules.length, myRole]);

  const selected = useMemo(() => modules.find(m => m.id === selectedId) ?? null, [modules, selectedId]);

  if (!open || !wave) return null;

  const isOwner = myRole === "owner";
  const isAdmin = myRole === "owner" || myRole === "admin";

  const handleLeave = async () => {
    if (!confirm("Leave this wave?")) return;
    try { await leaveWave(wave.id); toast.success("Left"); onLeft?.(); onClose(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[115] flex items-stretch justify-center bg-black/80 backdrop-blur-md sm:p-3 md:p-6">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 240 }}
          onClick={e => e.stopPropagation()}
          style={{
            borderColor: (wave as any).card_border_color || undefined,
            borderWidth: (wave as any).card_border_color ? 2 : 0,
            borderStyle: (wave as any).card_border_color ? "solid" : undefined,
          }}
          className="relative w-full h-[100dvh] sm:h-[calc(100dvh-1.5rem)] md:h-[calc(100dvh-3rem)] sm:max-w-[min(1280px,96vw)] overflow-hidden rounded-none sm:rounded-2xl md:rounded-3xl bg-background shadow-2xl flex flex-col">

          {/* Cover banner — fixed slim height, never overlaps title */}
          <div className="relative h-16 sm:h-20 shrink-0 overflow-hidden">
            {wave.cover_image_url ? (
              <img src={wave.cover_image_url} alt="" className="h-full w-full object-cover" />
            ) : (() => {
              const c1 = (wave as any).theme_color || "hsl(330 85% 60% / 0.55)";
              const c2 = (wave as any).theme_color_2 || (wave as any).theme_color || "hsl(280 70% 55% / 0.55)";
              const animated = !!(wave as any).theme_animated;
              return (
                <div
                  className={`h-full w-full ${animated ? "wave-modal-anim-bg" : ""}`}
                  style={{
                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                    backgroundSize: animated ? "200% 200%" : undefined,
                  }}
                />
              );
            })()}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
            <button onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 text-foreground/85 backdrop-blur hover:bg-background"><X className="h-4 w-4" /></button>
          </div>
          <style>{`
            @keyframes waveModalBgShift {
              0%   { background-position: 0% 50%; }
              50%  { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .wave-modal-anim-bg { animation: waveModalBgShift 8s ease-in-out infinite; }
          `}</style>

          {/* Title block — its OWN row, fully clear of cover/X. Never gets hidden. */}
          <div className="px-5 pt-2 pb-3 shrink-0 bg-background">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)]">
                <Waves className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 className="min-w-0 break-words text-[16px] sm:text-[18px] font-bold leading-tight text-foreground">{wave.name}</h2>
                  <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground/55">
                    {(wave.visibility ?? (wave.is_private ? "private" : "public"))}
                  </span>
                </div>
                <p className="text-[11px] text-foreground/55">
                  {wave.member_count} members
                  {(wave as any).follower_count != null && (wave as any).visibility === "public"
                    ? <> · <span className="text-foreground/70">Following the wave</span> {(wave as any).follower_count}</>
                    : null}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button onClick={() => setInviteOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-[hsl(330_85%_60%)] px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-[0_4px_14px_-4px_hsl(330_85%_60%/0.5)]">
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              )}
              {(wave.visibility === "public" || (!wave.is_private)) && !isAdmin && user && (
                <button onClick={async () => {
                  try {
                    if (following) { await unfollowWave(wave.id); setFollowing(false); toast.success("Unfollowed"); }
                    else { await followWave(wave.id); setFollowing(true); toast.success("Following the wave"); }
                    refreshFollow();
                  } catch (e: any) { toast.error(e.message); }
                }}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold shadow-[0_4px_14px_-4px_hsl(330_85%_60%/0.5)] ${
                    following
                      ? "bg-foreground/10 text-foreground/75 hover:bg-foreground/15"
                      : "bg-[hsl(330_85%_60%)] text-white"
                  }`}>
                  <Heart className={`h-3.5 w-3.5 ${following ? "fill-current" : ""}`} />
                  {following ? "Following" : "Follow"}
                </button>
              )}
              {!isOwner && myRole && (
                <button onClick={handleLeave}
                  className="flex items-center gap-1.5 rounded-full bg-foreground/[0.08] px-3.5 py-1.5 text-[11.5px] font-semibold text-foreground/70 hover:bg-destructive/15 hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5" /> Leave
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setAdminOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-foreground/[0.08] px-3.5 py-1.5 text-[11.5px] font-semibold text-foreground/70 hover:bg-foreground/15">
                  <Settings2 className="h-3.5 w-3.5" /> Customize
                </button>
              )}
              <WaveMusicPicker waveId={wave.id} canEdit={isAdmin} />
            </div>
          </div>

          {/* Body — sidebar + content */}
          <div className="relative flex flex-1 min-h-0 flex-col sm:flex-row">
            {/* Animated graphic background — behind everything in body */}
            <WaveBackground
              type={(wave as any).bg_animation}
              c1={(wave as any).theme_color}
              c2={(wave as any).theme_color_2}
            />
            {/* Card inner tint — low opacity so content is always visible */}
            {(wave as any).card_bg_color && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: (wave as any).card_bg_color, opacity: 0.14 }}
              />
            )}
            <aside className="relative z-10 shrink-0 border-b border-border/30 px-3 py-2 sm:w-44 sm:border-b-0 sm:border-r sm:py-3 sm:flex sm:flex-col bg-background/70 backdrop-blur-sm">
              <WaveSidebar
                modules={modules} selectedId={selectedId} onSelect={setSelectedId}
                isAdmin={isAdmin} isOwner={isOwner}
                onAdd={() => setAddOpen(true)} onAdminPanel={() => setAdminOpen(true)}
                onChanged={refreshModules}
              />
            </aside>
            <main className="scrollbar-hide relative z-10 flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:pb-6">
              {(wave as any).announcement_pinned && (wave as any).announcement && (
                <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-400/35 bg-amber-400/[0.08] p-3">
                  <span className="mt-0.5 text-amber-400">📌</span>
                  <p className="flex-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/85">{(wave as any).announcement}</p>
                </div>
              )}
              {modulesLoading ? (
                <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-foreground/40" /></div>
              ) : selected ? (
                <WaveModuleView module={selected} waveId={wave.id} isAdmin={isAdmin} />
              ) : (
                <p className="py-12 text-center text-[12px] text-foreground/45">
                  {isAdmin ? "Add a menu to get started." : "No menus yet."}
                </p>
              )}
            </main>
          </div>
        </motion.div>

        <InviteToWaveSheet open={inviteOpen} onClose={() => setInviteOpen(false)}
          waveId={wave.id} waveName={wave.name} />
        <AddModuleSheet open={addOpen} onClose={() => setAddOpen(false)}
          waveId={wave.id} nextPosition={modules.length} onCreated={refreshModules} />
        <WaveAdminPanel open={adminOpen} onClose={() => setAdminOpen(false)}
          wave={wave} isOwner={isOwner} isAdmin={isAdmin}
          onWaveDeleted={() => { onLeft?.(); onClose(); }}
          onWaveUpdated={onWaveUpdated} />
      </motion.div>
    </AnimatePresence>
  );
}
