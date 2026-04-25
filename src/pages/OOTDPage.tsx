import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Star, Camera, Loader2, TrendingUp, Heart, Crown, Edit3, Trash2, X, Save, Search, Bell, Info, Trophy, Users, LayoutGrid, User as UserIcon } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthGate } from "@/components/AuthGate";
import { motion, AnimatePresence } from "framer-motion";
import OOTDUploadSheet from "@/components/OOTDUploadSheet";
import OOTDPostDetail from "@/components/OOTDPostDetail";
import OOTDCard from "@/components/OOTDCard";
import CrownedBoard from "@/components/CrownedBoard";
import StoriesRow, { type UserStories } from "@/components/StoriesRow";
import StoryUploadSheet from "@/components/StoryUploadSheet";
import StoryViewer from "@/components/StoryViewer";
import MyPageProfileHeader from "@/components/MyPageProfileHeader";
import MyPageInboxCard from "@/components/ootd/MyPageInboxCard";
import InviteFriendsCard from "@/components/ootd/InviteFriendsCard";
import MailboxPopup from "@/components/messages/MailboxPopup";
import MailboxIcon from "@/components/messages/MailboxIcon";
import NotificationsSheet from "@/components/NotificationsSheet";
import FeedTopRow from "@/components/ootd/FeedTopRow";
import { useNotifications } from "@/hooks/useNotifications";
import { useConversations } from "@/hooks/useMessages";
import { toast } from "sonner";
import Brandmark from "@/components/Brandmark";
import OOTDBackground, { loadOOTDBgTheme, loadOOTDBgRealistic, type OOTDBgTheme } from "@/components/ootd/OOTDBackground";
import MyBackgroundPicker from "@/components/ootd/MyBackgroundPicker";
import SongOfTheDayPicker, { loadSongOfDay, type SongOfDay } from "@/components/ootd/SongOfTheDayPicker";
import CardColorPicker, { loadCardColor, applyCardColorToRoot, type CardColor } from "@/components/ootd/CardColorPicker";
import OOTDWelcomeModal, { openOOTDWelcome } from "@/components/ootd/OOTDWelcomeModal";
import HotShowroomSection from "@/components/showroom/HotShowroomSection";
import CreateShowroomBanner from "@/components/showroom/CreateShowroomBanner";
import ShowroomMyBlock from "@/components/showroom/ShowroomMyBlock";

interface OOTDPost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  style_tags: string[] | null;
  weather_tag: string | null;
  occasion_tags: string[] | null;
  topics: string[] | null;
  star_count: number | null;
  like_count: number | null;
  dislike_count: number | null;
  created_at: string;
}

interface Topic {
  id: string;
  name: string;
  post_count: number;
}

interface ProfileInfo {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username?: string | null;
}

type Tab = "ranking" | "feed" | "community" | "showroom" | "mypage";

const MAX_MESSAGE = 100;

const OOTDPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTabState] = useState<Tab>(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return (t === "feed" || t === "community" || t === "showroom" || t === "mypage" || t === "ranking") ? t : "mypage";
  });
  const [posts, setPosts] = useState<OOTDPost[]>([]);
  const [myPosts, setMyPosts] = useState<OOTDPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [starsLeft, setStarsLeft] = useState(3);
  const [starredPosts, setStarredPosts] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<Topic[]>([]);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileInfo>>({});
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike">>({});
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [selectedPost, setSelectedPost] = useState<OOTDPost | null>(null);
  // User style preferences — used to personalize the FEED tab.
  const [userPrefs, setUserPrefs] = useState<{ styles: string[]; occasions: string[] } | null>(null);
  // Edit state
  const [editingPost, setEditingPost] = useState<OOTDPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTopics, setEditTopics] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // Stories
  const [storyUploadOpen, setStoryUploadOpen] = useState(false);
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);
  const [allStoryUsers, setAllStoryUsers] = useState<UserStories[]>([]);
  const [viewerState, setViewerState] = useState<{ open: boolean; index: number; users: UserStories[] }>({
    open: false,
    index: 0,
    users: [],
  });
  // Inbox/notifications opened from My Page or the top mailbox icon
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [mailboxAnchor, setMailboxAnchor] = useState<{ x: number; y: number } | null>(null);
  const [initialChat, setInitialChat] = useState<{ conversationId: string | null; otherUserId: string | null }>({
    conversationId: null,
    otherUserId: null,
  });
  const [notifsOpen, setNotifsOpen] = useState(false);
  const { notifUnread, totalUnread } = useNotifications();
  const { totalUnread: msgUnread } = useConversations();
  const [searchParams, setSearchParams] = useSearchParams();

  // User-selected animated background for the OOTD experience.
  const [bgTheme, setBgTheme] = useState<OOTDBgTheme>(() => loadOOTDBgTheme());
  const [bgRealistic, setBgRealistic] = useState<boolean>(() => loadOOTDBgRealistic());
  const [songOfDay, setSongOfDay] = useState<SongOfDay | null>(() => loadSongOfDay());
  const [cardColor, setCardColor] = useState<CardColor>(() => {
    const c = loadCardColor();
    if (typeof window !== "undefined") applyCardColorToRoot(c);
    return c;
  });
  // Style applied to translucent cards so the user-picked tint wins over
  // the default `bg-background/80`. When no color is chosen we fall back
  // to the original surface (undefined background lets the Tailwind class
  // take effect).
  const cardStyle = cardColor.hex
    ? {
        background: `${cardColor.hex}D6`, // ~84% alpha — keeps the scene faintly visible
        color: undefined as string | undefined,
      }
    : undefined;
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as OOTDBgTheme | undefined;
      if (detail) setBgTheme(detail);
    };
    const onRealistic = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean | undefined;
      if (typeof detail === "boolean") setBgRealistic(detail);
    };
    window.addEventListener("ootd-bg-theme-change", onChange);
    window.addEventListener("ootd-bg-realistic-change", onRealistic);
    return () => {
      window.removeEventListener("ootd-bg-theme-change", onChange);
      window.removeEventListener("ootd-bg-realistic-change", onRealistic);
    };
  }, []);

  // Combined user + hashtag search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<ProfileInfo[]>([]);
  const [searchTopics, setSearchTopics] = useState<Topic[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const myStoryUser = user ? allStoryUsers.find((u) => u.user_id === user.id) : undefined;
  const hasOwnStory = !!myStoryUser;
  const hasOwnUnseen = !!myStoryUser?.hasUnseen;

  useEffect(() => {
    loadPosts();
    loadTopics();
    if (user) { loadMyPosts(); loadTodayStars(); loadUserReactions(); loadSavedPosts(); loadUserPrefs(); }
  }, [user]);

  useEffect(() => { loadPosts(); }, [activeTopic]);

  // Tab navigation: push to history so the browser back button cycles
  // through tabs (community → feed → ranking) before leaving the page.
  const setActiveTab = (next: Tab) => {
    if (next === activeTab) return;
    setActiveTabState(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "ranking") params.delete("tab"); else params.set("tab", next);
    const qs = params.toString();
    const url = `/ootd${qs ? `?${qs}` : ""}`;
    window.history.pushState({ ootdTab: next }, "", url);
  };

  // Sync state when the user uses the browser back/forward buttons.
  useEffect(() => {
    const onPop = () => {
      const t = new URLSearchParams(window.location.search).get("tab");
      const next: Tab = (t === "feed" || t === "community" || t === "showroom" || t === "mypage" || t === "ranking") ? t : "mypage";
      setActiveTabState(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Deep-link: /ootd?post=<id> opens that post's detail (used by notifications
  // and the ranking board).
  useEffect(() => {
    const postId = searchParams.get("post");
    if (!postId) return;
    let cancelled = false;
    (async () => {
      // Try in-memory first to avoid a roundtrip.
      const inMemory = posts.find((p) => p.id === postId) || myPosts.find((p) => p.id === postId);
      if (inMemory) { setSelectedPost(inMemory as OOTDPost); }
      else {
        const { data } = await supabase
          .from("ootd_posts")
          .select("*")
          .eq("id", postId)
          .maybeSingle();
        if (!cancelled && data) setSelectedPost(data as OOTDPost);
      }
      // Clear the query param so re-opens work.
      const next = new URLSearchParams(searchParams);
      next.delete("post");
      setSearchParams(next, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("post")]);

  useEffect(() => {
    const chatId = searchParams.get("chat");
    const otherUserId = searchParams.get("user");
    const nextTab = searchParams.get("tab");
    if (!chatId || !otherUserId) return;

    if (nextTab === "mypage") {
      setActiveTabState("mypage");
    }

    setInitialChat({ conversationId: chatId, otherUserId });
    setMessagesOpen(true);

    const next = new URLSearchParams(searchParams);
    next.delete("chat");
    next.delete("user");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const pendingFromState = (location.state as { openChat?: { conversationId?: string | null; otherUserId?: string | null } } | null)?.openChat;
    let pending = pendingFromState;

    if (!pending?.conversationId || !pending?.otherUserId) {
      try {
        const raw = sessionStorage.getItem("ootd:pending-chat");
        if (raw) {
          pending = JSON.parse(raw);
        }
      } catch {
        pending = null;
      }
    }

    if (!pending?.conversationId || !pending?.otherUserId) return;

    setActiveTabState("mypage");
    setInitialChat({
      conversationId: pending.conversationId,
      otherUserId: pending.otherUserId,
    });
    setMessagesOpen(true);

    try {
      sessionStorage.removeItem("ootd:pending-chat");
    } catch {
      // ignore storage failures
    }

    if (location.state && (location.state as any).openChat) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);


  // Debounced combined search (users + hashtags)
  useEffect(() => {
    const raw = searchQuery.trim();
    if (!raw || raw.replace(/[@#\s]/g, "").length < 2) {
      setSearchUsers([]);
      setSearchTopics([]);
      setSearchLoading(false);
      return;
    }
    const intent: "user" | "tag" | "any" = raw.startsWith("@") ? "user" : raw.startsWith("#") ? "tag" : "any";
    const q = raw.replace(/^[@#]/, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (q.length < 2) {
      setSearchUsers([]);
      setSearchTopics([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const [userRes, topicRes] = await Promise.all([
        intent === "tag"
          ? Promise.resolve({ data: [] as ProfileInfo[] })
          : supabase
              .from("profiles")
              .select("user_id, display_name, avatar_url, username, is_official")
              .ilike("username", `${q}%`)
              .limit(15),
        intent === "user"
          ? Promise.resolve({ data: [] as Topic[] })
          : supabase
              .from("ootd_topics")
              .select("*")
              .ilike("name", `${q}%`)
              .order("post_count", { ascending: false })
              .limit(15),
      ]);
      setSearchUsers((userRes.data as ProfileInfo[]) || []);
      setSearchTopics((topicRes.data as Topic[]) || []);
      setSearchLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTopics = async () => {
    const { data } = await supabase.from("ootd_topics").select("*").order("post_count", { ascending: false }).limit(15);
    setTrendingTopics((data as Topic[]) || []);
  };

  const loadPosts = async () => {
    setIsLoading(true);
    let query = supabase.from("ootd_posts").select("*").order("created_at", { ascending: false }).limit(30);
    if (activeTopic) query = query.contains("topics", [activeTopic]);
    const { data } = await query;
    const fetched = (data as OOTDPost[]) || [];
    setPosts(fetched);
    setIsLoading(false);

    const userIds = [...new Set(fetched.map(p => p.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, username, is_official").in("user_id", userIds);
      if (profiles) {
        const map: Record<string, ProfileInfo> = {};
        for (const p of profiles) map[p.user_id] = p as ProfileInfo;
        setProfileMap(prev => ({ ...prev, ...map }));
      }
    }
  };

  const loadMyPosts = async () => {
    if (!user) return;
    const { data } = await supabase.from("ootd_posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMyPosts((data as OOTDPost[]) || []);
  };

  const loadTodayStars = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("ootd_stars").select("id, post_id").eq("user_id", user.id).gte("created_at", today);
    const given = data || [];
    setStarsLeft(3 - given.length);
    setStarredPosts(new Set(given.map(s => s.post_id)));
  };

  const loadUserReactions = async () => {
    if (!user) return;
    const { data } = await supabase.from("ootd_reactions").select("post_id, reaction").eq("user_id", user.id);
    if (data) {
      const map: Record<string, "like" | "dislike"> = {};
      for (const r of data) map[r.post_id] = r.reaction as "like" | "dislike";
      setReactions(map);
    }
  };

  const loadSavedPosts = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id);
    if (data) setSavedPosts(new Set(data.map((d: any) => d.post_id)));
  };

  // Pulls preferred styles + occasions from style_profiles. Used to filter
  // the FEED tab so users see looks aligned with their taste.
  const loadUserPrefs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("style_profiles")
      .select("preferred_styles, occasions")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setUserPrefs({
        styles: (data.preferred_styles || []).map((s: string) => s.toLowerCase()),
        occasions: (data.occasions || []).map((s: string) => s.toLowerCase()),
      });
    }

    // Pull saved profile customization (bg theme, card color, song of day)
    // so the user's choices follow their account across devices and so
    // visitors to their profile see the same vibe.
    const { data: prof } = await supabase
      .from("profiles")
      .select("ootd_bg_theme, ootd_bg_realistic, ootd_card_color, song_of_the_day")
      .eq("user_id", user.id)
      .maybeSingle();
    if (prof) {
      const p = prof as any;
      if (p.ootd_bg_theme) setBgTheme(p.ootd_bg_theme as OOTDBgTheme);
      if (typeof p.ootd_bg_realistic === "boolean") setBgRealistic(p.ootd_bg_realistic);
      if (p.ootd_card_color) {
        const cc = p.ootd_card_color as CardColor;
        setCardColor(cc);
        applyCardColorToRoot(cc);
      }
      if (p.song_of_the_day) setSongOfDay(p.song_of_the_day as SongOfDay);
    }
  };

  // Persist profile customization to the DB whenever it changes — this is
  // what makes the user's chosen background, card tint and song-of-the-day
  // visible to visitors on their public profile page.
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      supabase.from("profiles").update({
        ootd_bg_theme: bgTheme,
        ootd_bg_realistic: bgRealistic,
        ootd_card_color: cardColor as any,
        song_of_the_day: songOfDay as any,
      } as any).eq("user_id", user.id).then(() => {});
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, bgTheme, bgRealistic, cardColor, songOfDay]);

  const handleSavePost = async (postId: string) => {
    if (!user) return;
    if (savedPosts.has(postId)) {
      await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", postId);
      setSavedPosts(prev => { const n = new Set(prev); n.delete(postId); return n; });
    } else {
      await supabase.from("saved_posts").insert({ user_id: user.id, post_id: postId });
      setSavedPosts(prev => new Set(prev).add(postId));
    }
  };

  const handleReaction = async (postId: string, type: "like" | "dislike") => {
    if (!user) return;
    const current = reactions[postId];
    if (current === type) {
      await supabase.from("ootd_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => { const n = { ...prev }; delete n[postId]; return n; });
      const updatePosts = (list: OOTDPost[]) => list.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? Math.max(0, (p.like_count || 0) - 1) : p.like_count,
        dislike_count: type === "dislike" ? Math.max(0, (p.dislike_count || 0) - 1) : p.dislike_count,
      } : p);
      setPosts(updatePosts);
      setMyPosts(updatePosts);
    } else if (current) {
      await supabase.from("ootd_reactions").update({ reaction: type }).eq("post_id", postId).eq("user_id", user.id);
      setReactions(prev => ({ ...prev, [postId]: type }));
      const updatePosts = (list: OOTDPost[]) => list.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : Math.max(0, (p.like_count || 0) - 1),
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : Math.max(0, (p.dislike_count || 0) - 1),
      } : p);
      setPosts(updatePosts);
      setMyPosts(updatePosts);
    } else {
      await supabase.from("ootd_reactions").insert({ post_id: postId, user_id: user.id, reaction: type });
      setReactions(prev => ({ ...prev, [postId]: type }));
      const updatePosts = (list: OOTDPost[]) => list.map(p => p.id === postId ? {
        ...p,
        like_count: type === "like" ? (p.like_count || 0) + 1 : p.like_count,
        dislike_count: type === "dislike" ? (p.dislike_count || 0) + 1 : p.dislike_count,
      } : p);
      setPosts(updatePosts);
      setMyPosts(updatePosts);
    }
    await supabase.from("interactions").insert({
      user_id: user.id, event_type: type, target_id: postId, target_type: "ootd", metadata: {},
    });
  };

  const handleStar = async (postId: string) => {
    if (!user || starsLeft <= 0 || starredPosts.has(postId)) return;
    const { error } = await supabase.from("ootd_stars").insert({ user_id: user.id, post_id: postId });
    if (!error) {
      setStarsLeft(prev => prev - 1);
      setStarredPosts(prev => new Set(prev).add(postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, star_count: (p.star_count || 0) + 1 } : p));
    }
  };

  // Edit post
  const handleEditPost = (post: OOTDPost) => {
    setEditingPost(post);
    setEditCaption(post.caption || "");
    setEditTopics((post.topics || []).join(", "));
    setSelectedPost(null);
  };

  const saveEditPost = async () => {
    if (!editingPost || !user) return;
    setSavingEdit(true);
    const parsedTopics = editTopics.split(/[,\s]+/).map(t => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from("ootd_posts").update({
      caption: editCaption.slice(0, MAX_MESSAGE) || null,
      topics: parsedTopics.length > 0 ? parsedTopics : null,
    }).eq("id", editingPost.id);
    if (!error) {
      toast.success("Post updated");
      setEditingPost(null);
      loadMyPosts();
      loadPosts();
    } else {
      toast.error("Failed to update");
    }
    setSavingEdit(false);
  };

  // Delete post
  const handleDeletePost = (postId: string) => {
    setDeleteConfirm(postId);
    setSelectedPost(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm || !user) return;
    const { error } = await supabase.from("ootd_posts").delete().eq("id", deleteConfirm);
    if (!error) {
      toast.success("Post deleted");
      setMyPosts(prev => prev.filter(p => p.id !== deleteConfirm));
      setPosts(prev => prev.filter(p => p.id !== deleteConfirm));
    } else {
      toast.error("Failed to delete");
    }
    setDeleteConfirm(null);
  };

  const handlePosted = () => { loadPosts(); loadMyPosts(); loadTopics(); };
  const getProfile = (userId: string) => profileMap[userId] || null;

  // FEED tab — preference-aware ranking. Posts that match the user's preferred
  // styles or occasions surface first; everything else falls through in the
  // original chronological order. When the user has no preferences (or no
  // matches) we keep the chronological order so the feed never looks empty.
  const getFeedPosts = (): OOTDPost[] => {
    if (!userPrefs || (userPrefs.styles.length === 0 && userPrefs.occasions.length === 0)) {
      return posts;
    }
    const styleSet = new Set(userPrefs.styles);
    const occasionSet = new Set(userPrefs.occasions);
    const scoreOf = (p: OOTDPost) => {
      const styleHits = (p.style_tags || []).reduce((n, t) => n + (styleSet.has(t.toLowerCase()) ? 1 : 0), 0);
      const occHits = (p.occasion_tags || []).reduce((n, t) => n + (occasionSet.has(t.toLowerCase()) ? 1 : 0), 0);
      const topicHits = (p.topics || []).reduce((n, t) => n + (styleSet.has(t.toLowerCase()) ? 1 : 0), 0);
      return styleHits * 3 + occHits * 2 + topicHits;
    };
    const matched = posts.map(p => ({ p, s: scoreOf(p) })).filter(x => x.s > 0);
    if (matched.length === 0) return posts;
    matched.sort((a, b) => b.s - a.s);
    const matchedIds = new Set(matched.map(x => x.p.id));
    return [...matched.map(x => x.p), ...posts.filter(p => !matchedIds.has(p.id))];
  };

  const getFeaturedPosts = (source: OOTDPost[] = posts) => {
    if (source.length < 4) return { featured: [], rest: source };
    const scored = [...source].sort((a, b) => {
      const scoreA = (a.like_count || 0) * 3 + (a.star_count || 0) * 5 - (a.dislike_count || 0) * 2;
      const scoreB = (b.like_count || 0) * 3 + (b.star_count || 0) * 5 - (b.dislike_count || 0) * 2;
      return scoreB - scoreA;
    });
    return { featured: scored.slice(0, 3), rest: scored.slice(3) };
  };

  const renderPostCard = (post: OOTDPost, index: number, showAuthor = true, isMyPage = false) => (
    <OOTDCard
      key={post.id}
      post={post}
      profile={getProfile(post.user_id)}
      index={index}
      showAuthor={showAuthor}
      isMyPage={isMyPage}
      onOpen={(p) => setSelectedPost(p as OOTDPost)}
      onEdit={isMyPage ? (p) => handleEditPost(p as OOTDPost) : undefined}
      onDelete={isMyPage ? handleDeletePost : undefined}
    />
  );

  return (
    <div className="relative min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-[64px]">
      <OOTDWelcomeModal />
      <OOTDBackground theme={bgTheme} realistic={bgRealistic} />
      {/* Fixed tab bar — stays under the main nav on desktop and always
          visible at the top on mobile, even when scrolling. A matching
          placeholder preserves document flow so content never jumps. */}
      <div className="sticky-header h-[64px] lg:h-[40px]" aria-hidden="true" />
      <div className="sticky-header fixed left-0 right-0 top-0 lg:top-[64px] z-30 bg-background/95 backdrop-blur-md border-b border-accent/[0.14]">
        <div className="mx-auto max-w-lg px-3 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {/* Mobile-only first row: brand + right-side actions. Tabs sit on a
              SECOND row so RANKING/FEED/COMMUNITY/MY PAGE never get squeezed
              or overlapped by the stars/mailbox/bell cluster. */}
          <div className="flex items-center justify-between gap-2 pt-2 lg:hidden">
            <div className="shrink-0"><Brandmark variant="inline" /></div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={openOOTDWelcome}
                className="text-foreground/55 hover:text-foreground transition-colors"
                aria-label="OOTD 안내 보기"
                title="OOTD 안내"
              >
                <Info className="h-4 w-4" />
              </button>
              {user && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                    <span className="text-[10px] font-medium text-foreground/80">{starsLeft}</span>
                  </div>
                  <MailboxIcon
                    unread={msgUnread}
                    onClick={(anchor) => { setMailboxAnchor(anchor); setMessagesOpen(true); }}
                  />
                  {notifUnread > 0 && (
                    <button
                      onClick={() => setNotifsOpen(true)}
                      className="relative text-foreground/75 hover:text-foreground transition-colors"
                      aria-label="Open notifications"
                    >
                      <Bell className="h-4 w-4" />
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold text-destructive-foreground">
                        {notifUnread > 99 ? "99+" : notifUnread}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs row — icon-based for a clean, balanced look on every viewport.
              Labels appear under the icon on desktop / sm+ for clarity. */}
          <div className="flex items-center gap-3">
            <div className="flex flex-1 min-w-0 items-stretch justify-around">
              {([
                { key: "ranking" as const, label: "RANKING", Icon: Trophy },
                { key: "feed" as const, label: "FEED", Icon: TrendingUp },
                { key: "community" as const, label: "COMMUNITY", Icon: Users },
                { key: "showroom" as const, label: "SHOWROOM", Icon: LayoutGrid },
                { key: "mypage" as const, label: "MY PAGE", Icon: UserIcon },
              ]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  aria-label={label}
                  title={label}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2.5"
                >
                  <Icon
                    className={`h-[18px] w-[18px] transition-colors ${
                      activeTab === key ? "text-foreground" : "text-foreground/45"
                    }`}
                    strokeWidth={activeTab === key ? 2.2 : 1.6}
                  />
                  <span
                    className={`hidden sm:block text-[8.5px] font-semibold tracking-[0.16em] transition-colors ${
                      activeTab === key ? "text-foreground/90" : "text-foreground/40"
                    }`}
                  >
                    {label}
                  </span>
                  {activeTab === key && (
                    <motion.div layoutId="ootd-tab" className="absolute bottom-0 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-accent" />
                  )}
                </button>
              ))}
            </div>
            {/* Desktop-only right cluster (mobile shows it on its own row above) */}
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              <button
                onClick={openOOTDWelcome}
                className="text-foreground/55 hover:text-foreground transition-colors"
                aria-label="OOTD 안내 보기"
                title="OOTD 안내"
              >
                <Info className="h-4 w-4" />
              </button>
              {user && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-[hsl(var(--star))] text-[hsl(var(--star))]" />
                    <span className="text-[10px] font-medium text-foreground/80">{starsLeft}</span>
                  </div>
                  <MailboxIcon
                    unread={msgUnread}
                    onClick={(anchor) => { setMailboxAnchor(anchor); setMessagesOpen(true); }}
                  />
                  {notifUnread > 0 && (
                    <button
                      onClick={() => setNotifsOpen(true)}
                      className="relative text-foreground/75 hover:text-foreground transition-colors"
                      aria-label="Open notifications"
                    >
                      <Bell className="h-4 w-4" />
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[8px] font-bold text-destructive-foreground">
                        {notifUnread > 99 ? "99+" : notifUnread}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-lg px-6 pt-4 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        {activeTab === "mypage" && user && (
          <div
            className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-5 shadow-xl shadow-black/10 mb-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <p className="hidden md:block text-[11.5px] text-foreground/70 leading-snug">
                ✨ <span className="font-medium text-foreground/85">당신의 페이지를 꾸며주세요</span>
              </p>
              <div className="flex w-full items-center gap-1.5 overflow-x-auto scrollbar-hide md:w-auto md:flex-wrap md:overflow-visible">
                <MyBackgroundPicker value={bgTheme} onChange={setBgTheme} />
                <SongOfTheDayPicker value={songOfDay} onChange={setSongOfDay} />
                <CardColorPicker value={cardColor} onChange={setCardColor} />
              </div>
            </div>
            <MyPageProfileHeader
              postCount={myPosts.length}
              totalStars={myPosts.reduce((sum, p) => sum + (p.star_count || 0), 0)}
              refreshKey={storiesRefreshKey}
              hasStory={hasOwnStory}
              hasUnseenStory={hasOwnUnseen}
              onUploadStory={() => setStoryUploadOpen(true)}
              onOpenMessages={() => setMessagesOpen(true)}
              onViewMyStory={() => {
                const idx = allStoryUsers.findIndex((u) => u.user_id === user.id);
                if (idx >= 0) setViewerState({ open: true, index: idx, users: allStoryUsers });
              }}
            />
          </div>
        )}

        {/* Stories row — Feed shows everyone, My Page shows your circle */}
        {(activeTab === "feed" || activeTab === "mypage") && (
          <div
            className={bgTheme !== "none" ? "rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-3 md:p-4 shadow-xl shadow-black/10" : ""}
            style={bgTheme !== "none" ? cardStyle : undefined}
          >
            <StoriesRow
              key={activeTab}
              refreshKey={storiesRefreshKey}
              circlesOnly={activeTab === "mypage"}
              onUploadClick={() => {
                if (!user) { navigate("/auth"); return; }
                setStoryUploadOpen(true);
              }}
              onOpenStories={(index, users) => setViewerState({ open: true, index, users })}
              onLoaded={setAllStoryUsers}
            />
          </div>
        )}
      </div>


      <div className="relative mx-auto max-w-lg px-6 pt-8 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
        <div
          className={bgTheme !== "none" ? "rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl p-4 md:p-6 shadow-xl shadow-black/10" : ""}
          style={bgTheme !== "none" ? cardStyle : undefined}
        >
        <AnimatePresence mode="wait">
          {activeTab === "ranking" ? (
            <motion.div key="ranking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              <CrownedBoard
                styleHints={userPrefs?.styles}
                onPostClick={(p) => setSelectedPost(p as unknown as OOTDPost)}
              />
              <HotShowroomSection />
            </motion.div>
          ) : activeTab === "community" ? (
            <motion.div key="community" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {/* User Search */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search @user or #hashtag"
                    className="w-full rounded-full border border-border/40 bg-card/50 pl-9 pr-9 py-2.5 text-[12px] text-foreground placeholder:text-foreground/35 outline-none focus:border-accent/40 transition-colors"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchQuery.trim().length >= 2 && (
                  <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
                    {searchLoading ? (
                      <div className="py-4 flex items-center justify-center"><Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40" /></div>
                    ) : searchUsers.length === 0 && searchTopics.length === 0 ? (
                      <div className="py-4 text-center text-[11px] text-foreground/40">No matches</div>
                    ) : (
                      <div className="divide-y divide-border/20">
                        {searchUsers.length > 0 && (
                          <div>
                            <div className="px-3 pt-2.5 pb-1 text-[9px] font-medium tracking-[0.2em] text-foreground/40">USERS</div>
                            <ul>
                              {searchUsers.map((u) => (
                                <li key={u.user_id}>
                                  <button onClick={() => navigate(`/user/${u.user_id}`)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5 transition-colors text-left">
                                    {u.avatar_url ? (
                                      <img src={u.avatar_url} alt={u.username || ""} className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-medium text-foreground/60">
                                        {(u.username || u.display_name || "?").charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-medium text-foreground truncate">@{u.username}</div>
                                      {u.display_name && <div className="text-[10px] text-foreground/50 truncate">{u.display_name}</div>}
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {searchTopics.length > 0 && (
                          <div>
                            <div className="px-3 pt-2.5 pb-1 text-[9px] font-medium tracking-[0.2em] text-foreground/40">HASHTAGS</div>
                            <ul>
                              {searchTopics.map((t) => (
                                <li key={t.id}>
                                  <button onClick={() => { setActiveTopic(t.name); setSearchQuery(""); setActiveTab("feed"); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5 transition-colors text-left">
                                    <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-[12px] font-medium text-accent/80">#</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-medium text-foreground truncate">#{t.name}</div>
                                      <div className="text-[10px] text-foreground/50">{t.post_count} {t.post_count === 1 ? "post" : "posts"}</div>
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trending Topics */}
              {trendingTopics.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3 text-accent/60" />
                    <span className="text-[10px] font-medium tracking-[0.2em] text-foreground/50">TRENDING TOPICS</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {trendingTopics.map(topic => (
                      <button key={topic.id} onClick={() => { setActiveTopic(topic.name); setActiveTab("feed"); }} className="rounded-full border border-border/30 bg-card/40 px-3 py-1.5 text-[10px] font-medium text-foreground/70 hover:border-accent/40 hover:text-accent transition-all">
                        #{topic.name}
                        <span className="ml-1.5 text-foreground/35">{topic.post_count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest from the community — chronological grid of all new posts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium tracking-[0.2em] text-foreground/50">LATEST POSTS</span>
                  <span className="text-[9px] tracking-[0.18em] text-foreground/35">NEWEST FIRST</span>
                </div>
                {isLoading ? (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="rounded-lg bg-foreground/[0.04] aspect-[3/4]" />
                      </div>
                    ))}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-[12px] text-foreground/50">No posts yet</p>
                    <p className="text-[10px] text-foreground/35">Be the first to share an outfit</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                    {posts.map((post, i) => renderPostCard(post, i, true))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === "showroom" ? (
            <motion.div key="showroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              <ShowroomMyBlock userId={user?.id} />
              <HotShowroomSection />
            </motion.div>
          ) : activeTab === "mypage" ? (
            <motion.div key="mypage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {!user ? (
                <div className="py-20 text-center space-y-5">
                  <Camera className="h-6 w-6 text-foreground/65 mx-auto" />
                  <p className="text-[14px] text-foreground/75">Sign in to create your style page</p>
                  <button onClick={() => navigate("/auth")} className="text-[10px] font-medium tracking-[0.2em] text-accent/80 hover:text-accent">SIGN IN</button>
                </div>
              ) : (
                <>
                  <MyPageInboxCard
                    onOpenMessages={() => setMessagesOpen(true)}
                    onOpenNotifications={() => setNotifsOpen(true)}
                  />

                  <InviteFriendsCard />

                  <CreateShowroomBanner />

                  <button onClick={() => setUploadOpen(true)} className="flex w-full items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-foreground/10 text-foreground/60 hover:text-accent/80 hover:border-accent/30 transition-colors">
                    <Camera className="h-5 w-5" />
                    <span className="text-[10px] font-medium tracking-[0.2em]">POST YOUR OOTD</span>
                  </button>

                  {myPosts.length === 0 ? (
                    <div className="py-16 text-center space-y-3">
                      <p className="text-[13px] text-foreground/80">No outfits posted yet</p>
                      <p className="text-[11px] text-foreground/50 max-w-[220px] mx-auto leading-relaxed">
                        Upload daily looks to build your style identity.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
                      {myPosts.map((post, i) => renderPostCard(post, i, false, true))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Top promo strip — Saved + AI AD slots */}
              {!activeTopic && (
                <FeedTopRow styleHints={userPrefs?.styles} />
              )}

              {/* Preference banner — explains why these looks are surfacing */}
              {user && userPrefs && (userPrefs.styles.length > 0 || userPrefs.occasions.length > 0) && !activeTopic && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/15 bg-accent/[0.04] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent/75">For You</p>
                    <p className="mt-0.5 truncate text-[11px] text-foreground/65">
                      Tuned to {[...userPrefs.styles, ...userPrefs.occasions].slice(0, 4).join(" · ")}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/settings")}
                    className="shrink-0 text-[9px] font-medium tracking-[0.18em] text-accent/70 hover:text-accent"
                  >
                    EDIT
                  </button>
                </div>
              )}
              {user && (!userPrefs || (userPrefs.styles.length === 0 && userPrefs.occasions.length === 0)) && !activeTopic && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/30 bg-card/40 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/55">Personalize feed</p>
                    <p className="mt-0.5 truncate text-[11px] text-foreground/55">
                      Set your styles to surface looks you'll love.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/onboarding")}
                    className="shrink-0 rounded-full border border-accent/25 px-2.5 py-1 text-[9px] font-medium tracking-[0.18em] text-accent/80 hover:bg-accent/10"
                  >
                    SET
                  </button>
                </div>
              )}

              {/* Active topic filter pill */}
              {activeTopic && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium tracking-[0.2em] text-foreground/45">FILTER</span>
                  <button onClick={() => setActiveTopic(null)} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/30 px-3 py-1 text-[11px] font-medium text-accent">
                    #{activeTopic}
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Social Feed */}
              {isLoading ? (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="rounded-lg bg-foreground/[0.04] aspect-[3/4]" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <Camera className="h-6 w-6 text-foreground/30 mx-auto" />
                  <p className="text-[13px] text-foreground/50">
                    {activeTopic ? `No posts in #${activeTopic} yet` : "Feed is growing"}
                  </p>
                  {user && (
                    <button onClick={() => { setActiveTab("mypage"); setUploadOpen(true); }} className="text-[10px] font-medium tracking-[0.2em] text-accent/60 hover:text-accent">
                      POST FIRST
                    </button>
                  )}
                </div>
              ) : (() => {
                const feedSource = getFeedPosts();
                const { featured, rest } = getFeaturedPosts(feedSource);
                return (
                  <div className="space-y-5">
                    {featured.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-medium tracking-[0.25em] text-foreground/40 block">FEATURED</span>
                        <div className="grid grid-cols-3 gap-2">
                          {featured.map((post, i) => (
                            <div key={post.id} className="ring-1 ring-accent/15 rounded-lg overflow-hidden">
                              {renderPostCard(post, i, true)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                      {rest.map((post, i) => renderPostCard(post, i, true))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Edit Post Modal */}
      <AnimatePresence>
        {editingPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingPost(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground/80">Edit Post</h3>
                <button onClick={() => setEditingPost(null)} className="text-foreground/40 hover:text-foreground/60">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground/50">Message</label>
                <input
                  type="text"
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value.slice(0, MAX_MESSAGE))}
                  maxLength={MAX_MESSAGE}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[12px] text-foreground outline-none focus:border-accent/30"
                />
                <span className="text-[9px] text-foreground/30">{editCaption.length}/{MAX_MESSAGE}</span>
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground/50">Hashtags (comma separated)</label>
                <input
                  type="text"
                  value={editTopics}
                  onChange={e => setEditTopics(e.target.value)}
                  placeholder="#minimal, #street"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[12px] text-foreground outline-none focus:border-accent/30"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingPost(null)} className="flex-1 rounded-lg border border-border py-2.5 text-[11px] font-medium text-foreground/60">Cancel</button>
                <button onClick={saveEditPost} disabled={savingEdit} className="flex-1 rounded-lg bg-foreground py-2.5 text-[11px] font-semibold text-background disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xs rounded-2xl bg-card border border-border p-5 text-center space-y-4"
            >
              <Trash2 className="h-6 w-6 text-destructive/60 mx-auto" />
              <p className="text-[13px] text-foreground/70">Delete this post?</p>
              <p className="text-[10px] text-foreground/40">This will permanently remove it from your page, the feed, and rankings.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-lg border border-border py-2.5 text-[11px] font-medium text-foreground/60">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 rounded-lg bg-destructive/80 py-2.5 text-[11px] font-semibold text-white">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <OOTDPostDetail
            post={posts.find(p => p.id === selectedPost.id) || myPosts.find(p => p.id === selectedPost.id) || selectedPost}
            profile={getProfile(selectedPost.user_id)}
            reaction={reactions[selectedPost.id]}
            isStarred={starredPosts.has(selectedPost.id)}
            isSaved={savedPosts.has(selectedPost.id)}
            starsLeft={starsLeft}
            onClose={() => setSelectedPost(null)}
            onReaction={handleReaction}
            onStar={handleStar}
            onSave={handleSavePost}
            onTopicClick={(topic) => { setActiveTopic(topic); setActiveTab("community"); }}
            onEdit={user?.id === selectedPost.user_id ? handleEditPost : undefined}
            onDelete={user?.id === selectedPost.user_id ? handleDeletePost : undefined}
          />
        )}
      </AnimatePresence>

      <OOTDUploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} onPosted={handlePosted} />

      <StoryUploadSheet
        open={storyUploadOpen}
        onClose={() => setStoryUploadOpen(false)}
        onPosted={() => setStoriesRefreshKey(k => k + 1)}
      />

      <StoryViewer
        open={viewerState.open}
        startUserIndex={viewerState.index}
        userStories={viewerState.users}
        onClose={() => setViewerState(s => ({ ...s, open: false }))}
        onDeleted={() => setStoriesRefreshKey(k => k + 1)}
      />

      <MailboxPopup
        open={messagesOpen}
        anchor={mailboxAnchor}
        onClose={() => {
          setMessagesOpen(false);
          setInitialChat({ conversationId: null, otherUserId: null });
        }}
        initialConversationId={initialChat.conversationId}
        initialOtherUserId={initialChat.otherUserId}
      />
      <NotificationsSheet open={notifsOpen} onClose={() => setNotifsOpen(false)} />
    </div>
  );
};

export default OOTDPage;
