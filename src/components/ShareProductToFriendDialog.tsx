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

  // Load my circle (people I follow) as soon as the dialog opens.
  useEffect(() => {
    if (!open || !user) return;
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
  }, [open, user, friendsFromInbox]);

  // Debounced search by id / username / display_name
  useEffect(() => {
    if (!open) return;
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
  }, [search, open, user?.id, friendsFromInbox]);

  // Unified suggestion list (must be declared before any early return).
  //  • when searching → search results
  //  • otherwise → people from circle merged with recent inbox conversations
  const suggestions: FriendOption[] = useMemo(() => {
    const ordered: FriendOption[] = [];
    const inboxMap = new Map(friendsFromInbox.map((f) => [f.user_id, f]));
    for (const f of circle) {
      const m = inboxMap.get(f.user_id);
      ordered.push(m ? { ...f, conversation_id: m.conversation_id } : f);
    }
    for (const f of friendsFromInbox) {
      if (!circle.some((c) => c.user_id === f.user_id)) ordered.push(f);
    }
    return ordered;
  }, [circle, friendsFromInbox]);

  if (!product) return null;

  const visibleList: FriendOption[] =
    search.trim().length >= 2 ? searchResults : suggestions.slice(0, 24);

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
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-sm "
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-card pb-6 pt-2 shadow-2xl sm:rounded-3xl"
            >
              {/* Drag handle (mobile) */}
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-foreground/15 sm:hidden" />

              {/* Compact header — product thumb + title + close */}
              <div className="flex items-center gap-3 px-5">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/45">
                    Send to
                  </p>
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {product.brand ? `${product.brand} · ` : ""}{product.name}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-foreground/45 hover:bg-foreground/[0.05] hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search field — single, always-visible */}
              <div className="mx-5 mt-4 flex items-center gap-2 rounded-full bg-foreground/[0.05] px-3.5 py-2.5">
                <Search className="h-3.5 w-3.5 text-foreground/45" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search a friend"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground/40"
                />
                {searching && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
              </div>

              {/* List */}
              <div className="mt-3 max-h-[42vh] overflow-y-auto px-2">
                {loadingCircle && visibleList.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40" />
                  </div>
                ) : visibleList.length === 0 ? (
                  <p className="px-3 py-10 text-center text-[12px] text-foreground/45">
                    {search.trim().length >= 2 ? "No matches" : "Follow people to see them here."}
                  </p>
                ) : (
                  <ul>
                    {visibleList.map((f) => {
                      const isPicked = picked?.user_id === f.user_id;
                      return (
                        <li key={f.user_id}>
                          <button
                            onClick={() => setPicked(isPicked ? null : f)}
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                              isPicked ? "bg-accent/10" : "hover:bg-foreground/[0.03]"
                            }`}
                          >
                            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                              {f.avatar_url ? (
                                <img src={f.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-muted-foreground">
                                  {(f.display_name || f.username || "?")[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {f.display_name || f.username || "User"}
                              </p>
                              {f.username && (
                                <p className="truncate text-[10.5px] text-foreground/45">@{f.username}</p>
                              )}
                            </div>
                            <span
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
                                isPicked
                                  ? "border-accent bg-accent text-accent-foreground"
                                  : "border-foreground/20 bg-transparent"
                              }`}
                            >
                              {isPicked && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Optional note */}
              <div className="mt-3 px-5">
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                  placeholder="Add a message (optional)"
                  className="w-full rounded-full bg-foreground/[0.04] px-4 py-2.5 text-[12.5px] text-foreground outline-none placeholder:text-foreground/40 focus:bg-foreground/[0.06]"
                />
              </div>

              {/* Send */}
              <div className="mt-4 px-5">
                <button
                  onClick={handleSend}
                  disabled={submitting || !picked || !user}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-[12px] font-semibold tracking-[0.06em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {picked
                    ? `Send to ${picked.display_name || picked.username || "friend"}`
                    : "Pick a friend"}
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
