import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Send, Loader2, MessageCircle, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  fetchMyCircle,
  searchUsersForInvite,
  inviteToWave,
  sendWaveInviteDM,
  fetchWaveInviteState,
} from "@/hooks/useWaves";
import { toast } from "sonner";

interface InviteToWaveSheetProps {
  open: boolean;
  onClose: () => void;
  waveId: string;
  waveName: string;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export default function InviteToWaveSheet({ open, onClose, waveId, waveName }: InviteToWaveSheetProps) {
  const { t } = useI18n();
  const [circle, setCircle] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [loadingCircle, setLoadingCircle] = useState(false);
  const [searching, setSearching] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoadingCircle(true);
    fetchMyCircle().then((rows) => {
      setCircle(rows as UserRow[]);
      setLoadingCircle(false);
    });
    fetchWaveInviteState(waveId).then(({ memberIds, pendingIds }) => {
      setMemberIds(memberIds);
      setInvitedIds(pendingIds);
    }).catch(() => { /* ignore */ });
  }, [open, waveId]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const rows = await searchUsersForInvite(q);
      setSearchResults(rows as UserRow[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  const circleIdSet = useMemo(() => new Set(circle.map((c) => c.user_id)), [circle]);

  const handleInvite = async (u: UserRow) => {
    if (memberIds.has(u.user_id)) { toast.info("Already a member"); return; }
    if (invitedIds.has(u.user_id)) { toast.info("Already invited"); return; }
    try {
      await inviteToWave(waveId, u.user_id);
      setInvitedIds((s) => new Set(s).add(u.user_id));
      toast.success(t("waveInviteSent"));
    } catch (err: any) {
      const msg = err.message === "already_invited" ? "Already invited"
        : err.message === "already_member" ? "Already a member"
        : err.message ?? "Failed";
      toast.error(msg);
    }
  };

  const handleInviteDM = async (u: UserRow) => {
    if (memberIds.has(u.user_id)) { toast.info("Already a member"); return; }
    if (invitedIds.has(u.user_id)) { toast.info("Already invited"); return; }
    try {
      await sendWaveInviteDM(waveId, u.user_id, waveName);
      setInvitedIds((s) => new Set(s).add(u.user_id));
      toast.success(t("waveInviteSent"));
    } catch (err: any) {
      const msg = err.message === "already_invited" ? "Already invited"
        : err.message === "already_member" ? "Already a member"
        : err.message ?? "Failed";
      toast.error(msg);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[125] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-background shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-[15px] font-bold text-foreground">{t("waveInviteSheetTitle")}</h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 hover:bg-foreground/20"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("waveInviteSearchPlaceholder")}
                className="w-full rounded-xl bg-foreground/[0.06] py-2.5 pl-9 pr-3 text-[13px] text-foreground placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.1]"
              />
            </div>
          </div>

          <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-6">
            {/* Search results (when searching) */}
            {query.trim().length >= 2 ? (
              <div className="space-y-1">
                {searching ? (
                  <div className="py-8 text-center text-foreground/40"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
                ) : searchResults.length === 0 ? (
                  <p className="py-8 text-center text-[12px] text-foreground/40">{t("waveNoResults")}</p>
                ) : (
                  searchResults.map((u) => (
                    <UserListRow
                      key={u.user_id}
                      user={u}
                      invited={invitedIds.has(u.user_id)}
                      member={memberIds.has(u.user_id)}
                      isCircle={circleIdSet.has(u.user_id)}
                      onInvite={() => handleInvite(u)}
                      onInviteDM={() => handleInviteDM(u)}
                      tDM={t("waveInviteSendDM")}
                    />
                  ))
                )}
              </div>
            ) : (
              <>
                <h4 className="mb-2 text-[10px] font-bold tracking-[0.18em] text-foreground/45">
                  {t("waveInviteFromCircle").toUpperCase()}
                </h4>
                {loadingCircle ? (
                  <div className="py-6 text-center text-foreground/40"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
                ) : circle.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-foreground/40">{t("waveCircleEmpty")}</p>
                ) : (
                  <div className="space-y-1">
                    {circle.map((u) => (
                      <UserListRow
                        key={u.user_id}
                        user={u}
                        invited={invitedIds.has(u.user_id)}
                        member={memberIds.has(u.user_id)}
                        isCircle={true}
                        onInvite={() => handleInvite(u)}
                        onInviteDM={() => handleInviteDM(u)}
                        tDM={t("waveInviteSendDM")}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function UserListRow({
  user, invited, member, isCircle, onInvite, onInviteDM, tDM,
}: {
  user: UserRow;
  invited: boolean;
  member?: boolean;
  isCircle: boolean;
  onInvite: () => void;
  onInviteDM: () => void;
  tDM: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-foreground/[0.04]">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-[12px] font-bold text-foreground/60">
          {(user.display_name?.[0] || user.username?.[0] || "?").toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {user.display_name || user.username}
        </p>
        {user.username && (
          <p className="truncate text-[11px] text-foreground/45">@{user.username}</p>
        )}
      </div>
      {member ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[10.5px] font-semibold text-emerald-400">
          <Check className="h-3 w-3" /> Member
        </span>
      ) : invited ? (
        <span className="flex items-center gap-1 rounded-full bg-foreground/[0.08] px-3 py-1.5 text-[10.5px] font-semibold text-foreground/60">
          <Check className="h-3 w-3" /> Sent
        </span>
      ) : isCircle ? (
        <button
          onClick={onInvite}
          className="flex items-center gap-1 rounded-full bg-[hsl(330_85%_60%)] px-3 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90"
        >
          <Send className="h-3 w-3" />
        </button>
      ) : (
        <button
          onClick={onInviteDM}
          title={tDM}
          className="flex items-center gap-1 rounded-full bg-foreground/[0.08] px-3 py-1.5 text-[11px] font-bold text-foreground/80 transition hover:bg-foreground/[0.14]"
        >
          <MessageCircle className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
