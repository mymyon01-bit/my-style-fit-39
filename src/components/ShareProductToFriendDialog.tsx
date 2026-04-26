/**
 * ShareProductToFriendDialog — in-app share of a PRODUCT to a friend via the
 * platform's own messaging (no external link share). Mirrors the MESSAGE tab
 * of ShareToOOTDDialog but for products.
 *
 * Recipient picker has TWO sources:
 *   • SEARCH — type a username / @handle / display name to find any user
 *   • CIRCLE — pick from the people the current user already follows
 *
 * The message is delivered as a chat message with a rich `product` attachment
 * that MessageBubble will render as a tappable preview card.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConversations, openConversationWith } from "@/hooks/useMessages";

function buildSharePreview(product: ProductLite, note: string) {
  const trimmed = note.trim();
  if (trimmed) return trimmed.slice(0, 140);
  const brand = product.brand?.trim();
  const name = product.name.trim();
  return [brand, name].filter(Boolean).join(" · ").slice(0, 140);
}

interface ProductLite {
  id: string;
  name: string;
  brand: string | null;
  image_url?: string | null;
  source_url?: string | null;
}

interface FriendOption {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  conversation_id?: string | null;
}

interface Props {
  open: boolean;
  product: ProductLite | null;
  onClose: () => void;
}

const MAX_NOTE = 280;

export default function ShareProductToFriendDialog({ open, product, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversations } = useConversations();
  const [tab, setTab] = useState<"search" | "circle">("search");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FriendOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [circle, setCircle] = useState<FriendOption[]>([]);
  const [loadingCircle, setLoadingCircle] = useState(false);
  const [picked, setPicked] = useState<FriendOption | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("search");
    setSearch("");
    setSearchResults([]);
    setPicked(null);
    setNote("");
  }, [open, product?.id]);

  const friendsFromInbox: FriendOption[] = useMemo(
    () =>
      conversations.map((c) => ({
        user_id: c.other_user_id,
        display_name: c.other_display_name,
        username: c.other_username,
        avatar_url: c.other_avatar_url,
        conversation_id: c.id,
      })),
    [conversations],
  );

  // Load my circle (people I follow) when the user opens the CIRCLE tab.
  useEffect(() => {
    if (!open || tab !== "circle" || !user) return;
    let cancelled = false;
    (async () => {
      setLoadingCircle(true);
      const { data: links } = await supabase
        .from("circles")
        .select("following_id")
        .eq("follower_id", user.id);
      const ids = Array.from(new Set((links || []).map((l: any) => l.following_id).filter(Boolean)));
      if (ids.length === 0) {
        if (!cancelled) {
          setCircle([]);
          setLoadingCircle(false);
        }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", ids);
      if (cancelled) return;
      const inboxMap = new Map(friendsFromInbox.map((f) => [f.user_id, f.conversation_id]));
      setCircle(
        ((profs as any[]) || []).map((p) => ({
          user_id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          conversation_id: inboxMap.get(p.user_id) ?? null,
        })),
      );
      setLoadingCircle(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, user, friendsFromInbox]);

  // Debounced search by id / username / display_name
  useEffect(() => {
    if (tab !== "search") return;
    const q = search.trim().replace(/^@/, "");
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.${q}%,display_name.ilike.${q}%`)
        .neq("user_id", user?.id || "")
        .limit(8);
      if (cancelled) return;
      const inboxMap = new Map(friendsFromInbox.map((f) => [f.user_id, f.conversation_id]));
      setSearchResults(
        ((data as any[]) || []).map((p) => ({
          user_id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          conversation_id: inboxMap.get(p.user_id) ?? null,
        })),
      );
      setSearching(false);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [search, tab, user?.id, friendsFromInbox]);

  if (!product) return null;

  const visibleList: FriendOption[] =
    tab === "circle"
      ? circle
      : search.trim().length >= 2
      ? searchResults
      : friendsFromInbox.slice(0, 12);

  async function handleSend() {
    if (!user) {
      toast.error("로그인이 필요해요 / Sign in required");
      return;
    }
    if (!product || !picked) return;
    setSubmitting(true);
    try {
      let conversationId = picked.conversation_id || null;
      if (!conversationId) {
        conversationId = await openConversationWith(picked.user_id);
      }
      if (!conversationId) {
        throw new Error("Could not start conversation. Try again.");
      }

      const attachments: any[] = [
        {
          type: "product",
          url: product.image_url || "",
          name: product.name,
          meta: {
            product_id: product.id,
            brand: product.brand,
            name: product.name,
            image_url: product.image_url,
            source_url: product.source_url,
          },
        },
      ];

      const fallbackText = `이 상품 어때? — ${product.brand || ""} ${product.name}`.trim();
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: picked.user_id,
        content: note.trim() || fallbackText,
        tagged_user_ids: [],
        attachments,
      } as any).select("id, created_at, content").single();
      if (error) {
        console.error("[ShareProduct] insert error", error);
        throw new Error(error.message || "Send failed");
      }
      if (!data?.id) {
        throw new Error("Message was not created");
      }

      const previewText = buildSharePreview(product, String(data.content || note || fallbackText));
      await supabase
        .from("conversations")
        .update({
          last_message_at: data.created_at,
          last_message_preview: previewText,
          updated_at: data.created_at,
        } as any)
        .eq("id", conversationId);

      const pendingChat = {
        conversationId,
        otherUserId: picked.user_id,
        openedAt: Date.now(),
      };

      try {
        sessionStorage.setItem("ootd:pending-chat", JSON.stringify(pendingChat));
      } catch {
        // ignore storage failures
      }

      toast.success(`Sent to ${picked.display_name || picked.username || "friend"}`);
      onClose();
      navigate(
        `/ootd?tab=mypage&chat=${encodeURIComponent(conversationId)}&user=${encodeURIComponent(picked.user_id)}`,
        {
          state: {
            openChat: pendingChat,
          },
        },
      );
    } catch (e: any) {
      console.error("[ShareProduct] handleSend error", e);
      toast.error(e?.message || "Could not send");
    } finally {
      setSubmitting(false);
    }
  }

  const node = (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ pointerEvents: "auto" }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border-t border-border bg-card pb-7 sm:rounded-3xl sm:border"
            >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5">
              <h3 className="font-display text-[15px] font-semibold tracking-[0.04em] text-foreground">
                Share in OOTD
              </h3>
              <button onClick={onClose} className="text-foreground/55 hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Product preview */}
            <div className="mx-6 mt-4 flex gap-3 rounded-2xl border border-border/30 bg-background/50 p-3">
              <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                  {product.brand || "Brand"}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] text-foreground/85">{product.name}</p>
              </div>
            </div>

            {/* Source tabs */}
            <div className="mx-6 mt-4 grid grid-cols-2 gap-1 rounded-full bg-foreground/[0.05] p-1">
              <button
                onClick={() => setTab("search")}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.16em] transition-colors ${
                  tab === "search" ? "bg-background text-foreground shadow-soft" : "text-foreground/55"
                }`}
              >
                <AtSign className="h-3.5 w-3.5" />
                SEARCH
              </button>
              <button
                onClick={() => setTab("circle")}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.16em] transition-colors ${
                  tab === "circle" ? "bg-background text-foreground shadow-soft" : "text-foreground/55"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                MY CIRCLE
              </button>
            </div>

            <div className="mt-4 space-y-3 px-6">
              {tab === "search" && (
                <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-foreground/45" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="@username or name…"
                    className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-foreground/35"
                  />
                  {searching && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
                </div>
              )}

              {/* Picker list */}
              <div className="max-h-44 overflow-y-auto rounded-xl border border-border/30 bg-background/30">
                {tab === "circle" && loadingCircle ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40" />
                  </div>
                ) : visibleList.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[11px] text-foreground/40">
                    {tab === "circle"
                      ? "Your circle is empty — follow some stylists first."
                      : search.trim().length >= 2
                      ? "No matches"
                      : "Start typing a username or name."}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/20">
                    {visibleList.map((f) => {
                      const isPicked = picked?.user_id === f.user_id;
                      return (
                        <li key={f.user_id}>
                          <button
                            onClick={() => setPicked(f)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                              isPicked ? "bg-accent/10" : "hover:bg-foreground/[0.04]"
                            }`}
                          >
                            <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                              {f.avatar_url ? (
                                <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                                  {(f.display_name || f.username || "?")[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-semibold text-foreground">
                                {f.display_name || f.username || "User"}
                              </p>
                              {f.username && (
                                <p className="truncate text-[10px] text-muted-foreground">@{f.username}</p>
                              )}
                            </div>
                            {isPicked && <Check className="h-3.5 w-3.5 text-accent" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                placeholder="이 상품 어때? Add a personal note…"
                rows={2}
                className="w-full resize-none rounded-xl border border-border/30 bg-background/40 p-3 text-[12.5px] text-foreground outline-none placeholder:text-foreground/35 focus:border-accent/40"
              />

              <button
                onClick={handleSend}
                disabled={submitting || !picked || !user}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-[11.5px] font-semibold tracking-[0.18em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {picked
                  ? `SEND TO ${(picked.display_name || picked.username || "FRIEND").toUpperCase()}`
                  : "PICK A FRIEND"}
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
