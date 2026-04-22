// ─── useResolvedGarmentSize ─────────────────────────────────────────────────
// Loads exact size measurements for the selected size. If none exist, it
// fires the on-demand `garment-size-fetch` scraper and re-resolves once.
// Surfaces honest state to the UI: exactSizeDataAvailable, missingFields,
// and a `fetching` flag while the on-demand scrape is in flight.

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
  fetching: boolean; // true while on-demand size-chart scrape is running
  error: string | null;
}

export function useResolvedGarmentSize(args: Args): UseResolvedGarmentSizeState {
  const [state, setState] = useState<UseResolvedGarmentSizeState>({
    resolved: null,
    loading: true,
    fetching: false,
    error: null,
  });
  const triedFetchKey = useRef<string | null>(null);

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
          selectedSize: args.selectedSize,
          category: args.category,
        });
        if (cancelled) return;

        // If we already have exact data, we're done.
        if (first.exactSizeDataAvailable) {
          setState({ resolved: first, loading: false, fetching: false, error: null });
          return;
        }

        // Otherwise show the approximate result immediately AND kick off the
        // on-demand scraper so the UI honestly says "preview is approximate"
        // while we try to find real measurements in the background.
        setState({ resolved: first, loading: false, fetching: true, error: null });

        const fetchKey = `${productKey}::${args.selectedSize}`;
        if (triedFetchKey.current === fetchKey) {
          setState((s) => ({ ...s, fetching: false }));
          return;
        }
        triedFetchKey.current = fetchKey;

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
          setState((s) => ({ ...s, fetching: false }));
          return;
        }

        // Re-resolve once after the scraper returns.
        const second = await resolveGarmentSize({
          productKey,
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
