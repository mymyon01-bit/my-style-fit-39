import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Star, Heart, Bookmark, Share2, Pin, Edit3, Trash2,
  Plus, Loader2, Globe, Lock, Link2, Save, X, ImagePlus, Sparkles,
  UserPlus, UserCheck, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useShowroom } from "@/hooks/useShowrooms";
import { useShowroomFollow } from "@/hooks/useShowroomFollow";
import type { ShowroomItem } from "@/lib/showroom/types";
import OOTDBackground, { loadOOTDBgTheme, loadOOTDBgRealistic, type OOTDBgTheme } from "@/components/ootd/OOTDBackground";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import MyBackgroundPicker from "@/components/ootd/MyBackgroundPicker";
import SongOfTheDayPicker, { loadSongOfDay, type SongOfDay } from "@/components/ootd/SongOfTheDayPicker";
import CardColorPicker, { loadCardColor, applyCardColorToRoot, type CardColor } from "@/components/ootd/CardColorPicker";

const ShowroomDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, items, loading, reload } = useShowroom(id);
  const [editing, setEditing] = useState(false);
  const [reactions, setReactions] = useState<Record<string, boolean>>({});
  const [savingReaction, setSavingReaction] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [detailProduct, setDetailProduct] = useState<any | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const openItem = async (item: ShowroomItem) => {
    let detail: any = {
      id: item.product_id || item.id,
      name: item.title || "Item",
      brand: item.brand || "",
      price: "",
      category: "",
      reason: item.note || "From this Showroom",
      style_tags: item.hashtags || [],
      color: "",
      fit: "regular",
      image_url: item.image_url,
      source_url: null,
      store_name: null,
      platform: null,
    };
    if (item.product_id) {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", item.product_id)
        .maybeSingle();
      if (data) {
        const d: any = data;
        detail = {
          ...detail,
          name: d.name || d.title || detail.name,
          brand: d.brand || detail.brand,
          price: d.price ? String(d.price) : "",
          category: d.category || d.category_id || "",
          color: d.color || (d.color_tags?.[0] ?? ""),
          fit: d.fit || d.fit_type || "regular",
          image_url: d.image_url || d.images?.[0] || detail.image_url,
          source_url: d.source_url || d.external_url || null,
          store_name: d.store_name || null,
          platform: d.platform || null,
        };
      }
    }
    setDetailProduct(detail);
  };

  const handleSaveProduct = async (productId: string) => {
    if (!user) { toast.error("Sign in to save"); return; }
    const has = savedIds.has(productId);
    if (has) {
      await supabase.from("saved_items").delete().eq("user_id", user.id).eq("product_id", productId);
      setSavedIds((s) => { const n = new Set(s); n.delete(productId); return n; });
    } else {
      await supabase.from("saved_items").insert({ user_id: user.id, product_id: productId });
      setSavedIds((s) => new Set(s).add(productId));
    }
  };

  // Personalization (same pickers as OOTD My Page) — local-only per device
  const [bgTheme, setBgTheme] = useState<OOTDBgTheme>(() => loadOOTDBgTheme());
  const [bgRealistic] = useState<boolean>(() => loadOOTDBgRealistic());
  const [songOfDay, setSongOfDay] = useState<SongOfDay | null>(() => loadSongOfDay());
  const [cardColor, setCardColor] = useState<CardColor>(() => {
    const c = loadCardColor();
    if (typeof window !== "undefined") applyCardColorToRoot(c);
    return c;
  });
  const cardStyle = cardColor.hex
    ? { background: `${cardColor.hex}D6`, color: undefined as string | undefined }
    : undefined;

  const [eTitle, setETitle] = useState("");
  const [eIntro, setEIntro] = useState("");
  const [eVisibility, setEVisibility] = useState<"public" | "private" | "invite_only">("public");
  const [eHashtags, setEHashtags] = useState("");

  useEffect(() => {
    if (room) {
      setETitle(room.title);
      setEIntro(room.intro || "");
      setEVisibility(room.visibility);
      setEHashtags(room.hashtags.join(", "));
    }
  }, [room]);

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

  const isOwner = !!user && !!room && user.id === room.user_id;
  const { isFollowing, count: followerCount, toggle: toggleFollow } = useShowroomFollow(room?.id, user?.id);

  const handleFollowClick = async () => {
    if (!user) { toast.error("Sign in to follow"); return; }
    if (isOwner) return;
    await toggleFollow();
  };
  const bestItem = useMemo(
    () => (room?.best_item_id ? items.find((i) => i.id === room.best_item_id) ?? null : null),
    [room?.best_item_id, items],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />
      </div>
    );
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
        .eq("showroom_id", room.id)
        .eq("user_id", user.id)
        .eq("reaction_type", type);
      if (!error) { setReactions((r) => ({ ...r, [type]: false })); reload(); }
    } else {
      const { error } = await supabase
        .from("showroom_reactions")
        .insert({ showroom_id: room.id, user_id: user.id, reaction_type: type });
      if (error) {
        if (error.message.includes("Daily star limit")) toast.error("Out of stars today (3/day across OOTD + Showroom)");
        else if (!error.message.includes("duplicate")) toast.error("Couldn't react");
      } else {
        setReactions((r) => ({ ...r, [type]: true })); reload();
      }
    }
    setSavingReaction(false);
  };

  const handleSaveEdit = async () => {
    const tags = eHashtags
      .split(/[,\s#]+/)
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)
      .slice(0, 12);

    const { error } = await supabase
      .from("showrooms")
      .update({
        title: eTitle.trim().slice(0, 80),
        intro: eIntro.trim().slice(0, 200) || null,
        visibility: eVisibility,
        hashtags: tags,
      })
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
    const url = prompt("Image URL (paste any inspiration image)");
    if (!url) return;
    setAddingItem(true);
    const { error } = await supabase.from("showroom_items").insert({
      showroom_id: room.id,
      source_type: "image",
      image_url: url,
      position_order: items.length,
    });
    setAddingItem(false);
    if (error) toast.error("Couldn't add");
    else { toast.success("Added"); reload(); }
  };

  const removeItem = async (item: ShowroomItem) => {
    const { error } = await supabase.from("showroom_items").delete().eq("id", item.id);
    if (!error) reload();
  };

  const setBest = async (itemId: string | null) => {
    const { error } = await supabase
      .from("showrooms")
      .update({ best_item_id: itemId })
      .eq("id", room.id);
    if (error) { toast.error("Couldn't set best"); return; }
    toast.success(itemId ? "Marked as Best" : "Best cleared");
    reload();
  };

  const onPickBanner = () => bannerInputRef.current?.click();

  const handleBannerFile = async (file: File) => {
    if (!user) return;
    if (file.size > 6 * 1024 * 1024) { toast.error("Image must be under 6MB"); return; }
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/showroom-banner-${room.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ootd-photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("ootd-photos").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("showrooms")
        .update({ banner_url: pub.publicUrl })
        .eq("id", room.id);
      if (updErr) throw updErr;
      toast.success("Banner updated");
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingBanner(false);
    }
  };

  const clearBanner = async () => {
    const { error } = await supabase.from("showrooms").update({ banner_url: null }).eq("id", room.id);
    if (!error) { toast.success("Banner removed"); reload(); }
  };

  const shareLink = async () => {
    const url = `${window.location.origin}/showroom/${room.id}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Copy failed"); }
  };

  const VisIcon = room.visibility === "public" ? Globe : room.visibility === "private" ? Lock : Link2;

  return (
    <div className="relative min-h-screen bg-background pb-32">
      {/* Live background — same engine as OOTD */}
      <OOTDBackground theme={bgTheme} realistic={bgRealistic} />

      {/* Sticky header */}
      <div className="sticky-header sticky top-0 z-20 border-b border-border/40 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 pb-2.5">
          <button onClick={() => navigate(-1)} className="rounded-full p-1.5 text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="line-clamp-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/45">Showroom</p>
            <p className="line-clamp-1 text-sm text-foreground/85">{room.title}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card px-2 py-1 text-[10px] text-foreground/65">
              <VisIcon className="h-3 w-3" />
              {room.visibility}
            </span>
            <button onClick={shareLink} className="rounded-full p-1.5 text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground">
              <Share2 className="h-4 w-4" />
            </button>
            {isOwner && (
              <>
                <button onClick={togglePin} className="rounded-full p-1.5 text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground" title={room.is_pinned ? "Unpin" : "Pin to profile"}>
                  <Pin className={`h-4 w-4 ${room.is_pinned ? "fill-current" : ""}`} />
                </button>
                <button onClick={() => setEditing((v) => !v)} className="rounded-full p-1.5 text-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={handleDeleteRoom} className="rounded-full p-1.5 text-destructive transition-colors hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-lg px-6 pt-4 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12 space-y-4">

        {/* Personalization card — owner only */}
        {isOwner && (
          <div
            className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11.5px] text-foreground/70 leading-snug">
                ✨ <span className="font-medium text-foreground/85">당신의 쇼룸을 꾸며주세요</span>
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <MyBackgroundPicker value={bgTheme} onChange={setBgTheme} />
                <SongOfTheDayPicker value={songOfDay} onChange={setSongOfDay} />
                <CardColorPicker value={cardColor} onChange={setCardColor} />
              </div>
            </div>
          </div>
        )}

        {/* Banner */}
        <div
          className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10"
          style={cardStyle}
        >
          <div className="relative aspect-[16/7] overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-accent/[0.08] via-secondary/40 to-background">
            {room.banner_url ? (
              <img
                src={room.banner_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/30 bg-background/70 text-accent/70 backdrop-blur-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
            )}

            {isOwner && room.banner_url && (
              <button
                onClick={clearBanner}
                className="absolute right-2 top-2 rounded-full border border-border/35 bg-background/95 p-1 text-foreground/70 transition-colors hover:text-foreground"
                aria-label="Remove banner"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {isOwner && (
            <>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBannerFile(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={onPickBanner}
                disabled={uploadingBanner}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-[10.5px] text-foreground/45 hover:text-foreground/75 transition-colors"
              >
                {uploadingBanner ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ImagePlus className="h-3 w-3" />
                )}
                <span>upload your banner</span>
              </button>
            </>
          )}

          <h1 className="mt-3 font-display text-2xl text-foreground md:text-3xl">{room.title}</h1>
          {room.intro && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/65">{room.intro}</p>
          )}

          {room.hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {room.hashtags.map((h) => (
                <span key={h} className="rounded-full border border-border/35 bg-background/60 px-2.5 py-0.5 text-[10px] text-foreground/60">
                  #{h}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ReactBtn active={reactions.star} onClick={() => toggleReaction("star")} icon={Star} count={room.star_count} label="Star" />
            <ReactBtn active={reactions.like} onClick={() => toggleReaction("like")} icon={Heart} count={room.like_count} label="Like" />
            <ReactBtn active={reactions.save} onClick={() => toggleReaction("save")} icon={Bookmark} count={room.save_count} label="Save" />
            {!isOwner && (
              <button
                onClick={handleFollowClick}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                  isFollowing
                    ? "border-accent/40 bg-accent/10 text-foreground"
                    : "border-border/35 bg-background text-foreground/70 hover:border-accent/30"
                }`}
              >
                {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-foreground/55">
              <Users className="h-3 w-3" /> {followerCount} {followerCount === 1 ? "follower" : "followers"}
            </span>
          </div>
        </div>

        {/* Edit panel */}
        {editing && isOwner && (
          <div
            className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10 space-y-3"
            style={cardStyle}
          >
            <h3 className="font-display text-base text-foreground">Edit</h3>
            <div>
              <label className="text-[11px] text-foreground/60">Title</label>
              <Input value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={80} className="mt-1" />
            </div>
            <div>
              <label className="text-[11px] text-foreground/60">Intro</label>
              <Textarea value={eIntro} onChange={(e) => setEIntro(e.target.value)} maxLength={200} rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-[11px] text-foreground/60">Hashtags</label>
              <Input value={eHashtags} onChange={(e) => setEHashtags(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-[11px] text-foreground/60">Visibility</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["public", "invite_only", "private"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setEVisibility(v)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                      eVisibility === v
                        ? "border-accent/40 bg-accent/10 text-foreground"
                        : "border-border/35 bg-background text-foreground/65 hover:border-accent/25"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit}><Save className="mr-1 h-3.5 w-3.5" />Save</Button>
            </div>
          </div>
        )}

        {/* Best pick (replaces playlist) */}
        <div
          className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10"
          style={cardStyle}
        >
          <div className="mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
            <h3 className="font-display text-base text-foreground">Best</h3>
            <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/45">owner's pick</span>
          </div>

          {bestItem ? (
            <div className="flex items-stretch gap-3">
              <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-border/35 bg-muted">
                {bestItem.image_url && (
                  <img src={bestItem.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between min-w-0">
                <div>
                  {bestItem.brand && (
                    <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">{bestItem.brand}</p>
                  )}
                  <p className="text-sm text-foreground/85 line-clamp-2">{bestItem.title || "Featured pick"}</p>
                  {bestItem.note && (
                    <p className="mt-1 text-[11px] text-foreground/55 line-clamp-2">{bestItem.note}</p>
                  )}
                </div>
                {isOwner && (
                  <button
                    onClick={() => setBest(null)}
                    className="self-start rounded-full border border-border/35 bg-background/60 px-2.5 py-1 text-[10px] text-foreground/60 hover:text-foreground"
                  >
                    Clear best
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/35 bg-background/40 p-5 text-center text-[12px] text-foreground/55">
              {isOwner
                ? "Pick one item below as your Best — others will see it featured here."
                : "No featured pick yet."}
            </div>
          )}
        </div>

        {/* Items grid — upload order */}
        <div
          className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10"
          style={cardStyle}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-base text-foreground">Items</h3>
            {isOwner && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={addImageItem} disabled={addingItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Image
                </Button>
                <Link to="/discover"><Button size="sm" variant="outline">From Discover</Button></Link>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/35 bg-background/40 p-8 text-center text-sm text-foreground/55">
              No items yet. Add inspiration images or curate from Discover.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => {
                const isBest = room.best_item_id === item.id;
                return (
                  <div key={item.id} className="group overflow-hidden rounded-xl border border-border/35 bg-background/70 cursor-pointer" onClick={() => openItem(item)}>
                    <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title || "Showroom item"} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-foreground/35">No image</div>
                      )}

                      {isBest && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-[hsl(var(--star))]/40 bg-background/90 px-2 py-0.5 text-[9px] font-medium text-foreground/85 backdrop-blur-sm">
                          <Star className="h-2.5 w-2.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                          Best
                        </span>
                      )}

                      {isOwner && (
                        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); setBest(isBest ? null : item.id); }}
                            className="rounded-full border border-border/35 bg-background/95 p-1 text-foreground/70 hover:text-foreground"
                            title={isBest ? "Unset Best" : "Set as Best"}
                          >
                            <Star className={`h-3 w-3 ${isBest ? "fill-[hsl(var(--star))] text-[hsl(var(--star))]" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeItem(item); }}
                            className="rounded-full border border-border/35 bg-background/95 p-1 text-foreground/70 hover:text-destructive"
                            title="Remove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 p-2.5">
                      {item.brand && <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/45">{item.brand}</p>}
                      <p className="line-clamp-1 text-[12px] text-foreground/80">{item.title || "Untitled item"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReactBtn = ({
  active,
  onClick,
  icon: Icon,
  count,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  icon: any;
  count: number;
  label: string;
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
      active
        ? "border-accent/40 bg-accent/10 text-foreground"
        : "border-border/40 bg-background text-foreground/65 hover:border-accent/25 hover:text-foreground"
    }`}
  >
    <Icon className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} />
    <span className="tabular-nums">{count}</span>
  </button>
);

export default ShowroomDetailPage;
