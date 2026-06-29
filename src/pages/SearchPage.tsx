/**
 * SearchPage — Universal AI-powered search results.
 * Calls the ai-search edge function and renders grouped results
 * (Products · Showrooms · Looks · Creators).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AISearchBar from "@/components/home/AISearchBar";

type Product = {
  id: string; title: string; brand: string | null;
  image_url: string | null; price: number | null; currency: string | null;
  product_url: string | null; category: string | null;
};
type Showroom = {
  id: string; name: string; slug: string | null; description: string | null;
  cover_image_url: string | null; owner_id: string;
};
type Look = {
  id: string; user_id: string; image_url: string;
  caption: string | null; star_count: number | null;
};
type Creator = {
  user_id: string; display_name: string | null;
  username: string | null; avatar_url: string | null;
};

type Results = {
  products?: Product[]; showrooms?: Showroom[];
  looks?: Look[]; creators?: Creator[];
  intent?: { keywords: string[]; category: string | null; mood: string[] };
};

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("ai-search", { body: { query: q } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError(error.message); return; }
        setData(data as Results);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q]);

  const hasResults =
    !!data &&
    ((data.products?.length ?? 0) +
      (data.showrooms?.length ?? 0) +
      (data.looks?.length ?? 0) +
      (data.creators?.length ?? 0) >
      0);

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-16">
      <header className="sticky top-0 z-30 bg-background/90 px-5 pt-5 pb-3 backdrop-blur-xl md:px-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 hover:bg-secondary/60"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>
          <div className="flex-1">
            <AISearchBar autoFocus={!q} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-4 md:max-w-4xl md:px-10">
        {!q.trim() && (
          <p className="mt-10 text-center text-sm text-foreground/55">
            Try "minimal beige spring outfit" or "korean street brand"
          </p>
        )}

        {q.trim() && loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-foreground/55">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Searching with AI…</span>
          </div>
        )}

        {error && <p className="py-10 text-sm text-destructive">{error}</p>}

        {data && !loading && (
          <>
            {data.intent?.keywords?.length ? (
              <p className="mt-1 mb-5 text-[11px] uppercase tracking-[0.2em] text-foreground/45">
                Interpreted as: {data.intent.keywords.join(" · ")}
                {data.intent.category ? ` · ${data.intent.category}` : ""}
              </p>
            ) : null}

            {!hasResults && (
              <p className="py-10 text-center text-sm text-foreground/55">
                No matches found.
              </p>
            )}

            {!!data.products?.length && (
              <Section title="Products">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {data.products.map((p) => (
                    <a
                      key={p.id}
                      href={p.product_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-xl border border-border bg-card"
                    >
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      )}
                      <div className="p-2.5">
                        <p className="line-clamp-1 text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/55">
                          {p.brand || "—"}
                        </p>
                        <p className="line-clamp-2 text-[12px] font-medium text-foreground">
                          {p.title}
                        </p>
                        {p.price != null && (
                          <p className="mt-1 text-[12px] font-medium text-foreground">
                            {p.currency || ""} {p.price}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {!!data.showrooms?.length && (
              <Section title="Showrooms">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {data.showrooms.map((s) => (
                    <Link
                      key={s.id}
                      to={`/showroom/${s.slug || s.id}`}
                      className="group block overflow-hidden rounded-xl border border-border bg-card"
                    >
                      {s.cover_image_url ? (
                        <img
                          src={s.cover_image_url}
                          alt={s.name}
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="aspect-[4/3] w-full bg-secondary" />
                      )}
                      <div className="p-2.5">
                        <p className="line-clamp-1 text-[13px] font-medium text-foreground">{s.name}</p>
                        {s.description && (
                          <p className="line-clamp-1 text-[11px] text-foreground/60">{s.description}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {!!data.looks?.length && (
              <Section title="Looks">
                <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                  {data.looks.map((l) => (
                    <Link
                      key={l.id}
                      to={`/user/${l.user_id}`}
                      className="block aspect-[3/4] overflow-hidden rounded-lg bg-secondary"
                    >
                      <img src={l.image_url} alt={l.caption || "look"} className="h-full w-full object-cover" loading="lazy" />
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {!!data.creators?.length && (
              <Section title="Creators">
                <div className="flex flex-wrap gap-3">
                  {data.creators.map((c) => (
                    <Link
                      key={c.user_id}
                      to={`/user/${c.user_id}`}
                      className="flex items-center gap-3 rounded-full border border-border bg-card px-3 py-2 hover:border-accent/60"
                    >
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-secondary" />
                      )}
                      <div className="text-left">
                        <p className="text-[12px] font-medium text-foreground">{c.display_name || c.username || "user"}</p>
                        {c.username && (
                          <p className="text-[10px] text-foreground/55">@{c.username}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-[20px] font-medium tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
