/**
 * ShareToOOTDDialog — two-tab share surface for an OOTD post.
 *
 *   POST tab    → re-share this look to the current user's own OOTD feed
 *                 (creates a new ootd_posts row with the same image_url and
 *                 a back-reference topic so we can credit the original).
 *
 *   MESSAGE tab → send the post as a chat message to a friend. The user
 *                 picks an existing conversation OR searches by username,
 *                 can attach a personal note, and optionally include their
 *                 own NAMECARD so the recipient can tap straight to the
 *                 sender's profile.
 *
 * Recipients render the rich attachments in MessageBubble (ootd_post +
 * namecard types). The dialog itself stays presentation-only — all DB
 * writes go through the existing supabase client and `useMessages` RPC.
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Repeat2, MessageCircle, Search, Loader2, IdCard, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConversations } from "@/hooks/useMessages";
import { openConversationWith } from "@/hooks/useMessages";

interface OOTDPostLite {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
}

interface OriginalAuthor {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
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
  onClose: () => void;
  post: OOTDPostLite | null;
  /** Original post author — used for re-share attribution + namecard preview. */
  author?: OriginalAuthor | null;
}

const MAX_NOTE = 280;

export default function ShareToOOTDDialog({ open, onClose, post, author }: Props) {
  const { user } = useAuth();
  const { conversations } = useConversations();
  const [tab, setTab] = useState<"post" | "message">("post");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // MESSAGE tab state
  const [pickedFriend, setPickedFriend] = useState<FriendOption | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FriendOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [includeNamecard, setIncludeNamecard] = useState(true);

  // Reset whenever the dialog opens / closes or the post changes
  useEffect(() => {
    if (!open) return;
    setTab("post");
    setNote("");
    setPickedFriend(null);
    setSearch("");
    setSearchResults([]);
    setIncludeNamecard(true);
  }, [open, post?.id]);

  // Friends list = existing conversations (most recent first)
  const friendsFromInbox: FriendOption[] = useMemo(() => {
    return conversations.map((c) => ({
      user_id: c.other_user_id,
      display_name: c.other_display_name,
      username: c.other_username,
      avatar_url: c.other_avatar_url,
      conversation_id: c.id,
    }));
  }, [conversations]);

  // Search for any user by username/display_name (debounced)
  useEffect(() => {
    const q = search.trim();
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
      setSearchResults(((data as any[]) || []).map((p) => ({
        user_id: p.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        conversation_id: friendsFromInbox.find((f) => f.user_id === p.user_id)?.conversation_id ?? null,
      })));
      setSearching(false);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [search, user?.id, friendsFromInbox]);

  // ── POST tab handler ──────────────────────────────────────────────────
  async function handleRepostToFeed() {
    if (!user || !post) {
      toast.error("Sign in to repost");
      return;
    }
    if (post.user_id === user.id) {
      toast.error("This is already your post");
      return;
    }
    setSubmitting(true);
    try {
      const credit = author?.username
        ? `Reposted from @${author.username}`
        : `Reposted from another stylist`;
      const caption = note.trim()
        ? `${note.trim()}\n\n— ${credit}`
        : `${credit}${post.caption ? `\n"${post.caption}"` : ""}`;

      const { error } = await supabase.from("ootd_posts").insert({
        user_id: user.id,
        image_url: post.image_url,
        caption: caption.slice(0, 1000),
        // mark as repost so the feed/profile can attribute it later
        topics: ["__repost", `from:${post.id}`],
      } as any);
      if (error) throw error;
      toast.success("Reposted to your OOTD feed");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Could not repost");
    } finally {
      setSubmitting(false);
    }
  }

  // ── MESSAGE tab handler ───────────────────────────────────────────────
  async function handleSendToFriend() {
    if (!user || !post || !pickedFriend) return;
    setSubmitting(true);
    try {
      const conversationId =
        pickedFriend.conversation_id || (await openConversationWith(pickedFriend.user_id));
      if (!conversationId) throw new Error("Could not open conversation");

      const attachments: any[] = [
        {
          type: "ootd_post",
          url: post.image_url,
          name: post.caption || "OOTD",
          meta: {
            post_id: post.id,
            user_id: post.user_id,
            username: author?.username ?? null,
            display_name: author?.display_name ?? null,
            avatar_url: author?.avatar_url ?? null,
            caption: post.caption,
          },
        },
      ];

      if (includeNamecard) {
        // Fetch sender's own profile for the namecard preview
        const { data: me } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        attachments.push({
          type: "namecard",
          url: me?.avatar_url || "",
          name: me?.display_name || me?.username || "My namecard",
          meta: {
            user_id: user.id,
            username: me?.username ?? null,
            display_name: me?.display_name ?? null,
            avatar_url: me?.avatar_url ?? null,
          },
        });
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: pickedFriend.user_id,
        content: note.trim() || "",
        tagged_user_ids: [],
        attachments,
      } as any);
      if (error) throw error;

      toast.success(`Sent to ${pickedFriend.display_name || pickedFriend.username || "friend"}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Could not send");
    } finally {
      setSubmitting(false);
    }
  }

  if (!post) return null;

  const visibleFriends: FriendOption[] = search.trim().length >= 2 ? searchResults : friendsFromInbox.slice(0, 12);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm "
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
                Share this OOTD
              </h3>
              <button onClick={onClose} className="text-foreground/55 hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="mx-6 mt-4 grid grid-cols-2 gap-1 rounded-full bg-foreground/[0.05] p-1">
              <button
                onClick={() => setTab("post")}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.16em] transition-colors ${
                  tab === "post" ? "bg-background text-foreground shadow-soft" : "text-foreground/55"
                }`}
              >
                <Repeat2 className="h-3.5 w-3.5" />
                POST
              </button>
              <button
                onClick={() => setTab("message")}
                className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.16em] transition-colors ${
                  tab === "message" ? "bg-background text-foreground shadow-soft" : "text-foreground/55"
                }`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                MESSAGE
              </button>
            </div>

            {/* Post preview */}
            <div className="mx-6 mt-4 flex gap-3 rounded-2xl border border-border/30 bg-background/50 p-3">
              <div className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {post.image_url ? (
                  <img src={post.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                  {author?.display_name || author?.username || "Original look"}
                </p>
                <p className="mt-1 line-clamp-3 text-[12px] text-foreground/80">
                  {post.caption || "—"}
                </p>
              </div>
            </div>

            {/* TAB CONTENT */}
            <div className="mt-4 px-6">
              {tab === "post" ? (
                <div className="space-y-3">
                  <label className="block text-[10px] font-semibold tracking-[0.18em] text-foreground/55">
                    ADD A NOTE (OPTIONAL)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                    placeholder="Why are you reposting this look?"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border/30 bg-background/40 p-3 text-[12.5px] text-foreground outline-none placeholder:text-foreground/35 focus:border-accent/40"
                  />
                  <p className="text-right text-[9px] text-foreground/40">{note.length}/{MAX_NOTE}</p>
                  <button
                    onClick={handleRepostToFeed}
                    disabled={submitting || !user || post.user_id === user?.id}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-[11.5px] font-semibold tracking-[0.18em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat2 className="h-3.5 w-3.5" />}
                    REPOST TO MY FEED
                  </button>
                  {post.user_id === user?.id && (
                    <p className="text-center text-[10px] text-foreground/45">
                      You can't repost your own look — try the MESSAGE tab.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Friend search */}
                  <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-foreground/45" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search a friend by @ or name…"
                      className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-foreground/35"
                    />
                    {searching && <Loader2 className="h-3 w-3 animate-spin text-foreground/40" />}
                  </div>

                  {/* Friends list */}
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-border/30 bg-background/30">
                    {visibleFriends.length === 0 ? (
                      <p className="px-3 py-4 text-center text-[11px] text-foreground/40">
                        {search.trim().length >= 2 ? "No matches" : "No conversations yet — search a friend above."}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/20">
                        {visibleFriends.map((f) => {
                          const picked = pickedFriend?.user_id === f.user_id;
                          return (
                            <li key={f.user_id}>
                              <button
                                onClick={() => setPickedFriend(f)}
                                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                                  picked ? "bg-accent/10" : "hover:bg-foreground/[0.04]"
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
                                {picked && <Check className="h-3.5 w-3.5 text-accent" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Note */}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                    placeholder="Say something about this look…"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border/30 bg-background/40 p-3 text-[12.5px] text-foreground outline-none placeholder:text-foreground/35 focus:border-accent/40"
                  />

                  {/* Namecard toggle */}
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/30 bg-background/40 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-[11.5px] text-foreground/80">
                      <IdCard className="h-3.5 w-3.5 text-accent/70" />
                      Include my namecard
                    </span>
                    <input
                      type="checkbox"
                      checked={includeNamecard}
                      onChange={(e) => setIncludeNamecard(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                    />
                  </label>

                  <button
                    onClick={handleSendToFriend}
                    disabled={submitting || !pickedFriend || !user}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-[11.5px] font-semibold tracking-[0.18em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    {pickedFriend
                      ? `SEND TO ${(pickedFriend.display_name || pickedFriend.username || "FRIEND").toUpperCase()}`
                      : "PICK A FRIEND"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
