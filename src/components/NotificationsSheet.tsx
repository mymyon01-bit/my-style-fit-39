import { useEffect, useMemo } from "react";
import { Bell, Loader2, X, Star, MessageCircle, UserPlus, CheckCheck, Heart, AtSign, Smile } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationsList, type NotificationRow } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ko as koLocale, ja as jaLocale, zhCN, es as esLocale, fr as frLocale, de as deLocale, it as itLocale } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";
import TranslateButton from "@/components/TranslateButton";

const DATE_LOCALES: Record<string, any> = {
  ko: koLocale, ja: jaLocale, zh: zhCN, es: esLocale, fr: frLocale, de: deLocale, it: itLocale,
};

// Localized strings used inside this sheet only — keeps the global i18n
// dictionary lean. Falls back to English when a locale is missing.
const STRINGS: Record<string, Record<string, string>> = {
  en: { title: "NOTIFICATIONS", read: "READ", unread: "UNREAD", earlier: "EARLIER", empty: "No notifications yet", emptySub: "Stars, comments, and new followers will show up here", connector: "" },
  ko: { title: "알림", read: "모두 읽음", unread: "안 읽음", earlier: "이전", empty: "아직 알림이 없습니다", emptySub: "스타·댓글·팔로우 알림이 여기 표시됩니다", connector: "님이 " },
  ja: { title: "通知", read: "既読にする", unread: "未読", earlier: "以前", empty: "まだ通知はありません", emptySub: "スター・コメント・フォローが表示されます", connector: "さんが" },
  zh: { title: "通知", read: "全部已读", unread: "未读", earlier: "更早", empty: "暂无通知", emptySub: "星标、评论和新粉丝会显示在这里", connector: "" },
  es: { title: "NOTIFICACIONES", read: "LEER", unread: "NUEVAS", earlier: "ANTERIORES", empty: "Sin notificaciones aún", emptySub: "Estrellas, comentarios y nuevos seguidores aparecerán aquí", connector: "" },
  fr: { title: "NOTIFICATIONS", read: "LU", unread: "NON LU", earlier: "PLUS TÔT", empty: "Aucune notification", emptySub: "Étoiles, commentaires et nouveaux abonnés s'afficheront ici", connector: "" },
  de: { title: "BENACHRICHTIGUNGEN", read: "GELESEN", unread: "NEU", earlier: "FRÜHER", empty: "Noch keine Benachrichtigungen", emptySub: "Sterne, Kommentare und neue Follower erscheinen hier", connector: "" },
  it: { title: "NOTIFICHE", read: "LETTO", unread: "NUOVE", earlier: "PRECEDENTI", empty: "Ancora nessuna notifica", emptySub: "Stelle, commenti e nuovi follower compariranno qui", connector: "" },
};

const ACTION_LABELS: Record<string, Record<string, string>> = {
  en: {
    follow: "requested to circle you", circle_request: "requested to circle you",
    star: "starred your post", ootd_star: "starred your post",
    ootd_like: "liked your post", comment_like: "liked your comment",
    comment: "commented on your post", ootd_comment: "commented on your post",
    ootd_reply: "replied to your comment", ootd_mention: "mentioned you",
    ootd_reaction: "reacted to your post", reaction: "reacted to your post",
  },
  ko: {
    follow: "서클을 신청했어요", circle_request: "서클을 신청했어요",
    star: "스타를 받았어요", ootd_star: "스타를 받았어요",
    ootd_like: "좋아요를 받았습니다", comment_like: "댓글에 좋아요를 받았어요",
    comment: "댓글을 남겼어요", ootd_comment: "댓글을 남겼어요",
    ootd_reply: "답글을 남겼어요", ootd_mention: "당신을 언급했어요",
    ootd_reaction: "반응을 남겼어요", reaction: "반응을 남겼어요",
  },
  ja: {
    follow: "サークル申請しました", circle_request: "サークル申請しました",
    star: "スターをくれました", ootd_star: "スターをくれました",
    ootd_like: "いいねしました", comment_like: "コメントにいいねしました",
    comment: "コメントしました", ootd_comment: "コメントしました",
    ootd_reply: "返信しました", ootd_mention: "あなたをメンションしました",
    ootd_reaction: "リアクションしました", reaction: "リアクションしました",
  },
  zh: {
    follow: "申请加入你的圈子", circle_request: "申请加入你的圈子",
    star: "为你点赞星标", ootd_star: "为你点赞星标",
    ootd_like: "赞了你的帖子", comment_like: "赞了你的评论",
    comment: "评论了你的帖子", ootd_comment: "评论了你的帖子",
    ootd_reply: "回复了你的评论", ootd_mention: "提到了你",
    ootd_reaction: "对你的帖子做出反应", reaction: "对你的帖子做出反应",
  },
  es: {
    follow: "quiere seguirte", circle_request: "quiere seguirte",
    star: "destacó tu publicación", ootd_star: "destacó tu publicación",
    ootd_like: "le gustó tu publicación", comment_like: "le gustó tu comentario",
    comment: "comentó tu publicación", ootd_comment: "comentó tu publicación",
    ootd_reply: "respondió a tu comentario", ootd_mention: "te mencionó",
    ootd_reaction: "reaccionó a tu publicación", reaction: "reaccionó a tu publicación",
  },
  fr: {
    follow: "souhaite vous suivre", circle_request: "souhaite vous suivre",
    star: "a mis votre publication en favori", ootd_star: "a mis votre publication en favori",
    ootd_like: "a aimé votre publication", comment_like: "a aimé votre commentaire",
    comment: "a commenté votre publication", ootd_comment: "a commenté votre publication",
    ootd_reply: "a répondu à votre commentaire", ootd_mention: "vous a mentionné",
    ootd_reaction: "a réagi à votre publication", reaction: "a réagi à votre publication",
  },
  de: {
    follow: "möchte dir folgen", circle_request: "möchte dir folgen",
    star: "hat deinen Beitrag markiert", ootd_star: "hat deinen Beitrag markiert",
    ootd_like: "hat deinen Beitrag geliked", comment_like: "hat deinen Kommentar geliked",
    comment: "hat deinen Beitrag kommentiert", ootd_comment: "hat deinen Beitrag kommentiert",
    ootd_reply: "hat auf deinen Kommentar geantwortet", ootd_mention: "hat dich erwähnt",
    ootd_reaction: "hat auf deinen Beitrag reagiert", reaction: "hat auf deinen Beitrag reagiert",
  },
  it: {
    follow: "vuole seguirti", circle_request: "vuole seguirti",
    star: "ha messo una stella al tuo post", ootd_star: "ha messo una stella al tuo post",
    ootd_like: "ha messo mi piace al tuo post", comment_like: "ha messo mi piace al tuo commento",
    comment: "ha commentato il tuo post", ootd_comment: "ha commentato il tuo post",
    ootd_reply: "ha risposto al tuo commento", ootd_mention: "ti ha menzionato",
    ootd_reaction: "ha reagito al tuo post", reaction: "ha reagito al tuo post",
  },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

const ICON_BY_TYPE: Record<string, any> = {
  follow: UserPlus,
  circle_request: UserPlus,
  star: Star,
  ootd_star: Star,
  comment: MessageCircle,
  ootd_comment: MessageCircle,
  ootd_reply: MessageCircle,
  ootd_like: Heart,
  comment_like: Heart,
  ootd_mention: AtSign,
  ootd_reaction: Smile,
  reaction: Smile,
};

// (Legacy LABEL_BY_TYPE removed — now derived per-language from ACTION_LABELS.)

/**
 * Notifications inbox: splits items into "Unread" and "Earlier" sections so
 * read items stay visible (history). The badge clears only when the user
 * taps "Mark all read" — never automatically — so they can actually see
 * what's new on open.
 */
export default function NotificationsSheet({ open, onClose }: Props) {
  const { items, actors, loading, markAllRead, reload } = useNotificationsList();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const S = STRINGS[lang] || STRINGS.en;
  const A = ACTION_LABELS[lang] || ACTION_LABELS.en;
  const dateLocale = DATE_LOCALES[lang];

  // Esc closes the sheet — guarantees a keyboard exit if the X is missed
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { unread, earlier } = useMemo(() => {
    const u: NotificationRow[] = [];
    const e: NotificationRow[] = [];
    items.forEach((n) => (n.read_at ? e.push(n) : u.push(n)));
    return { unread: u, earlier: e };
  }, [items]);

  const renderItem = (n: NotificationRow) => {
    const Icon = ICON_BY_TYPE[n.type] || Bell;
    const actor = n.actor_id ? actors[n.actor_id] : null;
    const actorName = actor?.display_name || actor?.username || "Someone";
    const isUnread = !n.read_at;
    return (
      <li key={n.id}>
        <button
          onClick={() => {
            if (n.type === "follow" && n.actor_id) {
              onClose();
              navigate(`/user/${n.actor_id}`);
            } else if ((n.type === "star" || n.type === "comment") && n.target_id) {
              onClose();
              navigate(`/ootd?post=${n.target_id}`);
            }
          }}
          className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/5 ${
            isUnread ? "bg-accent/[0.06]" : "opacity-75"
          }`}
        >
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-foreground/[0.06]">
            {actor?.avatar_url ? (
              <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-foreground/50">
                {actorName[0].toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
              <Icon className="h-2.5 w-2.5 text-accent" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-foreground/90">
              <span className="font-semibold">{actorName}</span>
              <span className="text-foreground/60">{S.connector || " "}{A[n.type] || n.type}</span>
            </p>
            {/* Surface a translate CTA if the actor's display name is in a
                non-UI script (e.g. Korean name shown to an English user). */}
            <TranslateButton text={actorName} className="mt-0.5" />
            {/* Translate the comment / message preview when present in the
                metadata payload (e.g. comment text on a comment notif). */}
            {typeof (n.metadata as any)?.preview === "string" && (n.metadata as any).preview.trim() && (
              <TranslateButton text={(n.metadata as any).preview} className="mt-0.5" />
            )}
            <p className="text-[10px] text-foreground/40">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale })}
            </p>
          </div>
          {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
        </button>
      </li>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="mx-auto flex h-full max-w-lg flex-col">
            {/* Sticky header with prominent close — always reachable */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/30 bg-background/95 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="h-4 w-4 text-foreground/70 shrink-0" />
                <span className="text-[11px] font-semibold tracking-[0.25em] text-foreground/80 truncate">
                  {S.title}
                </span>
                {unread.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground leading-none">
                    {unread.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {unread.length > 0 && (
                  <button
                    onClick={async () => {
                      await markAllRead();
                      reload();
                    }}
                    className="flex items-center gap-1 rounded-full border border-border/40 px-2.5 py-1.5 text-[9px] font-semibold tracking-wider text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <CheckCheck className="h-3 w-3" /> {S.read}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List — extra bottom padding so last item clears mobile nav */}
            <div className="flex-1 overflow-y-auto pb-24">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <Bell className="h-8 w-8 text-foreground/15" />
                  <p className="text-[12px] text-foreground/50">{S.empty}</p>
                  <p className="text-[10px] text-foreground/35">
                    {S.emptySub}
                  </p>
                </div>
              ) : (
                <>
                  {unread.length > 0 && (
                    <div>
                      <p className="px-5 pt-4 pb-2 text-[9px] font-semibold tracking-[0.25em] text-accent">
                        UNREAD · {unread.length}
                      </p>
                      <ul className="divide-y divide-border/20">{unread.map(renderItem)}</ul>
                    </div>
                  )}
                  {earlier.length > 0 && (
                    <div>
                      <p className="px-5 pt-5 pb-2 text-[9px] font-semibold tracking-[0.25em] text-foreground/45">
                        EARLIER
                      </p>
                      <ul className="divide-y divide-border/20">{earlier.map(renderItem)}</ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
