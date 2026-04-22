// ─── useResolvedGarmentSize ─────────────────────────────────────────────────
// Loads measurements for the selected size using the strict 5-step hierarchy
// implemented by `resolveGarmentSize`. If we land on the lowest-confidence
// fallback ("approximate") AND we haven't tried yet for this product+size,
// fires the on-demand `garment-size-fetch` scraper ONCE and re-resolves.
//
// Surfaces honest state to the UI:
//   - `resolved.source`  → exact / graded / category fallback / etc
//   - `resolved.confidence`
//   - `fetching` flag while the on-demand scrape is running
//   - `error` if the resolver itself crashed

import { useEffect, useRef, useState } from "react";
import {
  resolveGarmentSize,
  requestSizeChartFetch,
  makeProductKey,
  type ResolvedGarmentSize,
} from "@/lib/fit/garmentSizeResolver";

interface Args {
  productUrl?: string | null;
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  selectedSize: string;
  enabled?: boolean;
}

export interface UseResolvedGarmentSizeState {
  resolved: ResolvedGarmentSize | null;
  loading: boolean;
  fetching: boolean;
  error: string | null;
}

export function useResolvedGarmentSize(args: Args): UseResolvedGarmentSizeState {
  const [state, setState] = useState<UseResolvedGarmentSizeState>({
    resolved: null,
    loading: true,
    fetching: false,
    error: null,
  });
  const triedFetchKey = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (args.enabled === false) return;
    if (!args.selectedSize) return;
    let cancelled = false;
    const productKey = makeProductKey({ url: args.productUrl, name: args.productName, brand: args.brand });

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const first = await resolveGarmentSize({
          productKey,
          productName: args.productName,
          selectedSize: args.selectedSize,
          category: args.category,
        });
        if (cancelled) return;

        // db_exact and db_graded are good enough — no need to scrape.
        if (first.source === "db_exact" || first.source === "db_graded") {
          setState({ resolved: first, loading: false, fetching: false, error: null });
          return;
        }

        // For category fallback / brand average / approximate, immediately
        // surface the approximate result so the UI never blocks. THEN attempt
        // a one-shot scrape to see if we can upgrade to db_exact.
        setState({ resolved: first, loading: false, fetching: true, error: null });

        const fetchKey = `${productKey}::${args.selectedSize}`;
        if (triedFetchKey.current.has(fetchKey)) {
          setState((s) => ({ ...s, fetching: false }));
          return;
        }
        triedFetchKey.current.add(fetchKey);

        const fetched = await requestSizeChartFetch({
          productKey,
          productUrl: args.productUrl,
          productName: args.productName,
          brand: args.brand,
          category: args.category,
          selectedSize: args.selectedSize,
        });
        if (cancelled) return;

        if (!fetched.ok) {
          // Stay on the fallback we already have — never blank the UI.
          setState((s) => ({ ...s, fetching: false }));
          return;
        }

        const second = await resolveGarmentSize({
          productKey,
          productName: args.productName,
          selectedSize: args.selectedSize,
          category: args.category,
        });
        if (cancelled) return;
        setState({ resolved: second, loading: false, fetching: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          fetching: false,
          error: e instanceof Error ? e.message : "size_resolve_failed",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [args.productUrl, args.productName, args.brand, args.category, args.selectedSize, args.enabled]);

  return state;
}
