/**
 * LocationSearchInput — typeahead city/place search powered by OpenStreetMap
 * Nominatim (free, no API key). Debounced; results limited to 5.
 *
 * Used in:
 *  - signup form (collects user's home city)
 *  - OOTD page "내 위치 설정" (sets user's current location)
 */
import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationResult {
  display: string;          // "Seoul, South Korea"
  short: string;            // "Seoul"
  lat: number;
  lon: number;
  countryCode?: string;
}

interface Props {
  value?: string;
  onSelect: (loc: LocationResult) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
}

const LocationSearchInput = ({
  value = "",
  onSelect,
  onClear,
  placeholder = "Search city, region…",
  className,
  inputClassName,
  required,
}: Props) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => setQuery(value), [value]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = setTimeout(async () => {
      try {
        ctrl.current?.abort();
        ctrl.current = new AbortController();
        setLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: ctrl.current.signal,
          headers: { "Accept-Language": navigator.language || "en" },
        });
        const data = (await res.json()) as any[];
        const mapped: LocationResult[] = (data || []).map((r) => {
          const a = r.address || {};
          const short =
            a.city ||
            a.town ||
            a.village ||
            a.municipality ||
            a.county ||
            a.state ||
            r.display_name?.split(",")[0] ||
            "";
          return {
            display: r.display_name,
            short,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            countryCode: a.country_code,
          };
        });
        setResults(mapped);
        setOpen(true);
      } catch (err: any) {
        if (err?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          className={cn(
            "w-full rounded-lg border border-foreground/10 bg-background py-2.5 pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-foreground/30",
            inputClassName,
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-foreground/40" />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              onClear?.();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-foreground/10 bg-background shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  setQuery(r.display);
                  setOpen(false);
                  onSelect(r);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-foreground/5"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" />
                <span className="line-clamp-2">{r.display}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearchInput;
