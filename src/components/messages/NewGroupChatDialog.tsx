import { useEffect, useState } from "react";
import { Loader2, Search, X, Users, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createGroupConversation, openConversationWith } from "@/hooks/useMessages";
import { toast } from "sonner";

interface UserRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string, otherUserId: string | null) => void;
}

/**
 * Dialog to start a new chat — pick one user (1:1) or several users (group).
 * Group chats also accept an optional title.
 */
export default function NewGroupChatDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserRow[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected([]);
      setTitle("");
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const q = query.trim();
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(20);
      if (cancelled) return;
      const filtered = ((data as UserRow[]) || []).filter((r) => r.user_id !== user?.id);
      setResults(filtered);
      setSearching(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, user]);

  const toggle = (u: UserRow) => {
    setSelected((prev) =>
      prev.some((p) => p.user_id === u.user_id)
        ? prev.filter((p) => p.user_id !== u.user_id)
        : [...prev, u],
    );
  };

  const handleCreate = async () => {
    if (selected.length === 0 || creating) return;
    setCreating(true);
    try {
      if (selected.length === 1) {
        const id = await openConversationWith(selected[0].user_id);
        if (!id) throw new Error("Could not open chat");
        onCreated(id, selected[0].user_id);
      } else {
        const id = await createGroupConversation(title.trim(), selected.map((s) => s.user_id));
        if (!id) throw new Error("Could not create group");
        onCreated(id, null);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to start chat");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="border-b border-border/40 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Users className="h-4 w-4" />
            New chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-5 pt-4">
          {selected.length > 1 && (
            <Input
              placeholder="Group name (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              className="h-9 text-[13px]"
            />
          )}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((s) => (
                <span
                  key={s.user_id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground/8 px-2.5 py-1 text-[11px] font-medium"
                >
                  @{s.username}
                  <button
                    onClick={() => toggle(s)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by username or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 text-[13px]"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto px-2 pb-2 pt-1">
          {searching ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              {query ? "No users found" : "Type a name to search"}
            </p>
          ) : (
            <ul className="divide-y divide-border/30">
              {results.map((u) => {
                const isSelected = selected.some((s) => s.user_id === u.user_id);
                return (
                  <li key={u.user_id}>
                    <button
                      onClick={() => toggle(u)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                            {(u.display_name || u.username || "?")[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {u.display_name || u.username}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">@{u.username}</p>
                      </div>
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/25"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/40 px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            {selected.length === 0
              ? "Pick people to chat with"
              : selected.length === 1
              ? "Direct chat"
              : `Group chat · ${selected.length} people`}
          </p>
          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            className="rounded-full bg-foreground px-4 py-1.5 text-[12px] font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
