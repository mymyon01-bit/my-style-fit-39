import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Star, Heart, Bookmark, Share2, Pin, Edit3, Trash2,
  Plus, Loader2, Music, Globe, Lock, Link2, Save, X, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useShowroom } from "@/hooks/useShowrooms";
import { getTheme, SHOWROOM_THEMES } from "@/lib/showroom/themes";
import { detectPlaylistProvider, type PlaylistLink, type ShowroomItem } from "@/lib/showroom/types";
import { PlaylistEmbed } from "@/components/showroom/PlaylistEmbed";

const ShowroomDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, items, loading, reload } = useShowroom(id);
  const [editing, setEditing] = useState(false);
  const [reactions, setReactions] = useState<Record<string, boolean>>({});
  const [savingReaction, setSavingReaction] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [playlistInput, setPlaylistInput] = useState("");
  const [playlistLabel, setPlaylistLabel] = useState("");

  // Edit state
  const [eTitle, setETitle] = useState("");
  const [eIntro, setEIntro] = useState("");
  const [eTheme, setETheme] = useState("");
  const [eVisibility, setEVisibility] = useState<"public" | "private" | "invite_only">("public");
  const [eHashtags, setEHashtags] = useState("");

  useEffect(() => {
    if (room) {
      setETitle(room.title);
      setEIntro(room.intro || "");
      setETheme(room.theme);
      setEVisibility(room.visibility);
      setEHashtags(room.hashtags.join(", "));
    }
  }, [room]);

  // Load my reactions
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data } = await supabase
        .from("showroom_reactions")
        .select("reaction_type")
        .eq("showroom_id", id)
        .eq("user_id", user.id);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r: any) => { map[r.reaction_type] = true; });
      setReactions(map);
    })();
  }, [user, id]);

  const theme = useMemo(() => getTheme(room?.theme), [room?.theme]);
  const isOwner = !!user && !!room && user.id === room.user_id;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-foreground/60">Showroom not found.</p>
      </div>
    );
  }

  const toggleReaction = async (type: "like" | "star" | "save") => {
    if (!user) { toast.error("Sign in to react"); return; }
    if (savingReaction) return;
    setSavingReaction(true);
    const has = reactions[type];
    if (has) {
      const { error } = await supabase
        .from("showroom_reactions")
        .delete()
        .eq("showroom_id", room.id).eq("user_id", user.id).eq("reaction_type", type);
      if (!error) { setReactions((r) => ({ ...r, [type]: false })); reload(); }
    } else {
      const { error } = await supabase
        .from("showroom_reactions")
        .insert({ showroom_id: room.id, user_id: user.id, reaction_type: type });
      if (error) {
        if (error.message.includes("Daily star limit")) toast.error("Out of stars today (3/day across OOTD + Showroom)");
        else if (!error.message.includes("duplicate")) toast.error("Couldn't react");
      } else {
        setReactions((r) => ({ ...r, [type]: true }));
        reload();
      }
    }
    setSavingReaction(false);
  };

  const handleSaveEdit = async () => {
    const tags = eHashtags.split(/[,\s#]+/).map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean).slice(0, 12);
    const { error } = await supabase
      .from("showrooms")
      .update({ title: eTitle.trim().slice(0, 80), intro: eIntro.trim().slice(0, 200) || null, theme: eTheme, visibility: eVisibility, hashtags: tags, theme_color: getTheme(eTheme).accentHex })
      .eq("id", room.id);
    if (error) { toast.error("Couldn't save"); return; }
    toast.success("Saved");
    setEditing(false);
    reload();
  };

  const togglePin = async () => {
    const { error } = await supabase.from("showrooms").update({ is_pinned: !room.is_pinned }).eq("id", room.id);
    if (!error) { toast.success(room.is_pinned ? "Unpinned" : "Pinned to your profile"); reload(); }
  };

  const handleDeleteRoom = async () => {
    if (!confirm("Delete this showroom? This cannot be undone.")) return;
    const { error } = await supabase.from("showrooms").delete().eq("id", room.id);
    if (error) { toast.error("Couldn't delete"); return; }
    toast.success("Deleted");
    navigate("/showroom");
  };

  const addImageItem = async () => {
    const url = prompt("Image URL (you can paste any inspiration image)");
    if (!url) return;
    setAddingItem(true);
    const { error } = await supabase.from("showroom_items").insert({
      showroom_id: room.id, source_type: "image", image_url: url, position_order: items.length,
    });
    setAddingItem(false);
    if (error) toast.error("Couldn't add"); else { toast.success("Added"); reload(); }
  };

  const removeItem = async (item: ShowroomItem) => {
    const { error } = await supabase.from("showroom_items").delete().eq("id", item.id);
    if (!error) reload();
  };

  const addPlaylist = async () => {
    if (!playlistInput.trim()) return;
    const link: PlaylistLink = {
      url: playlistInput.trim(),
      label: playlistLabel.trim() || undefined,
      provider: detectPlaylistProvider(playlistInput.trim()),
    };
    const next = [...room.playlist_links, link].slice(0, 6);
    const { error } = await supabase.from("showrooms").update({ playlist_links: next as any }).eq("id", room.id);
    if (error) toast.error("Couldn't add"); else { setPlaylistInput(""); setPlaylistLabel(""); reload(); }
  };

  const removePlaylist = async (idx: number) => {
    const next = room.playlist_links.filter((_, i) => i !== idx);
    await supabase.from("showrooms").update({ playlist_links: next as any }).eq("id", room.id);
    reload();
  };

  const shareLink = async () => {
    const url = `${window.location.origin}/showroom/${room.id}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { toast.error("Copy failed"); }
  };

  const VisIcon = room.visibility === "public" ? Globe : room.visibility === "private" ? Lock : Link2;

  return (
    <div className={`min-h-screen ${theme.bgClass} pb-32`}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-background/80 px-4 py-2 backdrop-blur-md border-b border-foreground/10">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-foreground hover:bg-foreground/10"><ArrowLeft className="h-4 w-4" /></button>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground"><VisIcon className="h-3 w-3" /> {room.visibility}</span>
        <button onClick={shareLink} className="rounded-full p-1.5 text-foreground hover:bg-foreground/10"><Share2 className="h-4 w-4" /></button>
        {isOwner && (
          <>
            <button onClick={togglePin} className="rounded-full p-1.5 text-foreground hover:bg-foreground/10" title={room.is_pinned ? "Unpin" : "Pin to profile"}>
              <Pin className={`h-4 w-4 ${room.is_pinned ? "fill-current" : ""}`} />
            </button>
            <button onClick={() => setEditing((v) => !v)} className="rounded-full p-1.5 text-foreground hover:bg-foreground/10"><Edit3 className="h-4 w-4" /></button>
            <button onClick={handleDeleteRoom} className="rounded-full p-1.5 text-foreground hover:bg-red-500/20"><Trash2 className="h-4 w-4" /></button>
          </>
        )}
      </div>

      {/* Hero */}
      <div className="relative px-6 py-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] opacity-70">{theme.label}</p>
        <h1 className="mt-2 font-display text-3xl md:text-4xl">{room.title}</h1>
        {room.intro && <p className="mx-auto mt-2 max-w-md text-sm opacity-80">{room.intro}</p>}
        {room.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {room.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-current/10 px-2 py-0.5 text-[10px] backdrop-blur-sm">#{h}</span>
            ))}
          </div>
        )}
        {/* Reactions */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <ReactBtn active={reactions.star} onClick={() => toggleReaction("star")} icon={Star} count={room.star_count} label="Star" />
          <ReactBtn active={reactions.like} onClick={() => toggleReaction("like")} icon={Heart} count={room.like_count} label="Like" />
          <ReactBtn active={reactions.save} onClick={() => toggleReaction("save")} icon={Bookmark} count={room.save_count} label="Save" />
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 px-4">
        {/* Edit panel */}
        {editing && isOwner && (
          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-md">
            <h3 className="mb-3 font-display text-lg">Edit Room</h3>
            <div className="space-y-3">
              <div><label className="text-xs opacity-80">Title</label><Input value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={80} className="mt-1" /></div>
              <div><label className="text-xs opacity-80">Intro</label><Textarea value={eIntro} onChange={(e) => setEIntro(e.target.value)} maxLength={200} rows={2} className="mt-1" /></div>
              <div>
                <label className="text-xs opacity-80">Theme</label>
                <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {SHOWROOM_THEMES.map((t) => (
                    <button key={t.key} onClick={() => setETheme(t.key)} className={`rounded-md px-2 py-1 text-[10px] ${eTheme === t.key ? "bg-white text-black" : "bg-white/10"}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs opacity-80">Hashtags</label><Input value={eHashtags} onChange={(e) => setEHashtags(e.target.value)} className="mt-1" /></div>
              <div>
                <label className="text-xs opacity-80">Visibility</label>
                <div className="mt-1 flex gap-1.5">
                  {(["public", "invite_only", "private"] as const).map((v) => (
                    <button key={v} onClick={() => setEVisibility(v)} className={`rounded-md px-3 py-1 text-[11px] ${eVisibility === v ? "bg-white text-black" : "bg-white/10"}`}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveEdit}><Save className="mr-1 h-3.5 w-3.5" />Save</Button>
              </div>
            </div>
          </div>
        )}

        {/* Playlists */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Music className="h-4 w-4" />
            <h3 className="font-display text-lg">Playlists</h3>
          </div>
          {room.playlist_links.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {room.playlist_links.map((p, i) => (
                <div key={i} className="relative">
                  <PlaylistEmbed link={p} />
                  {isOwner && (
                    <button onClick={() => removePlaylist(i)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs opacity-60">No playlists yet.</p>
          )}
          {isOwner && room.playlist_links.length < 6 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input value={playlistInput} onChange={(e) => setPlaylistInput(e.target.value)} placeholder="Spotify / YouTube / Apple Music link" className="min-w-[200px] flex-1 bg-white/10" />
              <Input value={playlistLabel} onChange={(e) => setPlaylistLabel(e.target.value)} placeholder="Label (optional)" className="w-40 bg-white/10" />
              <Button size="sm" onClick={addPlaylist}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
            </div>
          )}
        </section>

        {/* Items */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-lg">Items</h3>
            {isOwner && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addImageItem} disabled={addingItem}><Plus className="mr-1 h-3.5 w-3.5" />Image</Button>
                <Link to="/discover"><Button size="sm" variant="outline">From Discover</Button></Link>
              </div>
            )}
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-current/20 p-8 text-center text-xs opacity-70">
              No items yet. Owners can add inspiration images or curate from Discover/OOTD/Saved.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className={`group relative overflow-hidden rounded-xl ${theme.cardClass} aspect-[3/4]`}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title || ""} className="h-full w-full object-cover" loading="lazy" />
                  ) : <div className="flex h-full items-center justify-center text-xs opacity-50">No image</div>}
                  {(item.title || item.brand) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
                      {item.brand && <p className="text-[9px] uppercase tracking-wider opacity-80">{item.brand}</p>}
                      {item.title && <p className="line-clamp-1 text-xs">{item.title}</p>}
                    </div>
                  )}
                  {isOwner && (
                    <button onClick={() => removeItem(item)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {item.product_id && (
                    <Link to={`/fit/${item.product_id}`} className="absolute left-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] text-black opacity-0 group-hover:opacity-100">
                      <ExternalLink className="inline h-2.5 w-2.5" /> Fit
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const ReactBtn = ({ active, onClick, icon: Icon, count, label }: { active?: boolean; onClick: () => void; icon: any; count: number; label: string; }) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs backdrop-blur-sm transition ${
      active ? "bg-white text-black" : "bg-black/30 text-white hover:bg-black/50"
    }`}
  >
    <Icon className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} />
    <span className="tabular-nums">{count}</span>
  </button>
);

export default ShowroomDetailPage;
