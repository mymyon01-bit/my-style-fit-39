/**
 * AISearchBar — Home universal search.
 * Submits free-text query to /search?q=... which calls the ai-search edge function.
 */
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";

export default function AISearchBar({
  placeholder = "Search styles, products, looks…",
  autoFocus,
}: { placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={submit}
      className="group relative flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-4 py-3.5 shadow-[var(--shadow-1)] backdrop-blur-md transition focus-within:border-accent/70 focus-within:shadow-[var(--shadow-2)]"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[15px] tracking-tight text-foreground placeholder:text-foreground/40 focus:outline-none"
        enterKeyHint="search"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition active:scale-95"
      >
        <Search className="h-4 w-4" strokeWidth={2} />
      </button>
    </form>
  );
}
