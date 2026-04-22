import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MentionUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  query: string;
  onSelect: (user: MentionUser) => void;
}

/**
 * Suggestion popup that appears while typing "@..." in the message composer.
 * Searches profiles by username/display_name (case-insensitive prefix).
 */
export default function MentionAutocomplete({ query, onSelect }: Props) {
  const [results, setResults] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.${query}%,display_name.ilike.${query}%`)
        .limit(6);
      if (cancelled) return;
      setResults((data as MentionUser[]) || []);
      setLoading(false);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  if (!query) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover shadow-elevated">
      {loading && results.length === 0 ? (
        <div className="p-3 text-[11px] text-muted-foreground">Searching…</div>
      ) : results.length === 0 ? (
        <div className="p-3 text-[11px] text-muted-foreground">No matches</div>
      ) : (
        results.map((u) => (
          <button
            key={u.user_id}
            type="button"
            onClick={() => onSelect(u)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
          >
            <div className="h-7 w-7 overflow-hidden rounded-full bg-muted">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {(u.display_name || u.username)[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {u.display_name || u.username}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">@{u.username}</p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
