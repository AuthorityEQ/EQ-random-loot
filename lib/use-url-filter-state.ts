/**
 * lib/use-url-filter-state.ts
 *
 * React hook that syncs filter state bidirectionally with URL query params.
 * Designed to be a drop-in replacement for the individual useState calls in
 * app/page.tsx — see the INTEGRATION STEPS block below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATION STEPS for app/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Prerequisites
 * ~~~~~~~~~~~~~
 * useSearchParams() from next/navigation requires the component (or an
 * ancestor) to be wrapped in a React <Suspense> boundary.  app/page.tsx is
 * already "use client" so either:
 *
 *   Option A — wrap the default export in app/page.tsx with a Suspense
 *              fallback in the same file (preferred, zero layout change):
 *
 *     import { Suspense } from "react";
 *
 *     function Home() { /* existing component body *\/ }
 *
 *     export default function Page() {
 *       return <Suspense fallback={null}><Home /></Suspense>;
 *     }
 *
 *   Option B — add a <Suspense> wrapper in app/layout.tsx around {children}.
 *
 * Step 1 — Import
 * ~~~~~~~~~~~~~~~
 *   import { useUrlFilterState } from "@/lib/use-url-filter-state";
 *
 * Step 2 — Replace individual useState calls
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * Remove these lines:
 *
 *   const [query, setQuery] = useState("");
 *   const [selectedExpansions, setSelectedExpansions] = useState<ExpansionFilter[]>([...expansionOptions]);
 *   const [selectedZone, setSelectedZone] = useState("");
 *   const [playerLevel, setPlayerLevel] = useState(1);
 *
 * Replace with:
 *
 *   const { state: urlState, setState: setUrlState, shareUrl } = useUrlFilterState();
 *
 *   // Derive the same local variable names from urlState for minimal diff
 *   const query          = urlState.q    ?? "";
 *   const selectedZone   = urlState.zone ?? "";
 *   const playerLevel    = urlState.level ?? 1;
 *   const selectedExpansions = (urlState.exp ?? [...expansionOptions].map(e => e.toLowerCase()))
 *     .map(e => e.charAt(0).toUpperCase() + e.slice(1)) as ExpansionFilter[];
 *
 * Step 3 — Replace individual setters with setUrlState partial updates
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *   setQuery(v)                       → setUrlState({ q: v })
 *   setSelectedZone(v)                → setUrlState({ zone: v })
 *   setPlayerLevel(v)                 → setUrlState({ level: v })
 *   setSelectedExpansions(next => …)  → compute next array then call
 *                                       setUrlState({ exp: next.map(e => e.toLowerCase()) })
 *
 * Step 4 — Add ShareFilterButton to the toolbar
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *   import { ShareFilterButton } from "@/components/ShareFilterButton";
 *
 *   Inside the <div className="toolbar"> JSX, after the SearchBox:
 *     <ShareFilterButton shareUrl={shareUrl} />
 *
 * Step 5 — Hydration mismatch guard
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The hook initialises from URL on mount (inside useEffect) and returns empty
 * defaults on the first render, matching the SSR/pre-render output.  This
 * mirrors the pattern already used by ServerProvider.  No extra work needed
 * if you followed Option A or B above.
 *
 * Step 6 — level clamping (existing useEffect)
 * ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 * The existing useEffect that clamps playerLevel to maxSupportedLevel still
 * works — just change setPlayerLevel(clampedLevel) to
 * setUrlState({ level: clampedLevel }).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildShareUrl,
  filterStateToParams,
  paramsToFilterState,
  type FilterState,
} from "./url-state";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce delay in ms before URL is updated after a state change. */
const URL_UPDATE_DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseUrlFilterStateReturn {
  /**
   * Current filter state, hydrated from URL on mount.
   * Returns empty-defaults on the initial server render and the first client
   * render to prevent hydration mismatches.
   */
  state: FilterState;

  /**
   * Merge a partial FilterState into the current state and schedule a URL
   * update (debounced at 200 ms). Pass `undefined` for a key to clear it.
   */
  setState: (next: Partial<FilterState>) => void;

  /**
   * Full shareable URL reflecting the current filter state.
   * Safe to pass directly to navigator.clipboard.writeText().
   */
  shareUrl: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useUrlFilterState
 *
 * Syncs filter state to/from URL query params using Next.js App Router
 * navigation hooks.  URL updates use router.replace() (no history entries).
 * Updates are debounced to avoid spamming the router on rapid keystrokes.
 */
export function useUrlFilterState(): UseUrlFilterStateReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Hydration-safe initialisation ──────────────────────────────────────
  // Start with an empty state so the first render (SSR + hydration) is
  // deterministic regardless of what query params are in the URL.
  // After mount we read the real URL params and patch state once.
  const [state, setStateInternal] = useState<FilterState>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // This runs only on the client, after hydration is complete.
    const initialState = paramsToFilterState(searchParams);
    setStateInternal(initialState);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty: run once on mount

  // ── Sync URL → state when searchParams change externally ───────────────
  // (e.g. user presses Back / Forward, or another part of the app updates
  //  the URL).  Skip the initial run; the mount effect above handles that.
  const prevParamsStringRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    const paramsString = searchParams.toString();
    if (paramsString === prevParamsStringRef.current) return;
    prevParamsStringRef.current = paramsString;

    setStateInternal(paramsToFilterState(searchParams));
  }, [searchParams, hydrated]);

  // ── Debounced URL writer ────────────────────────────────────────────────
  const pendingStateRef = useRef<FilterState | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushUrlUpdate = useCallback(
    (nextState: FilterState) => {
      const params = filterStateToParams(nextState);
      const qs = params.toString();
      const newUrl = qs ? `${pathname}?${qs}` : pathname;

      // Track what we just pushed so the searchParams effect above ignores it.
      prevParamsStringRef.current = qs;

      router.replace(newUrl, { scroll: false });
    },
    [pathname, router],
  );

  // ── setState (public API) ───────────────────────────────────────────────
  const setState = useCallback(
    (next: Partial<FilterState>) => {
      setStateInternal((current) => {
        const merged: FilterState = { ...current, ...next };

        // Remove keys explicitly set to undefined so the URL stays clean.
        for (const key of Object.keys(merged) as Array<keyof FilterState>) {
          if (merged[key] === undefined) {
            delete merged[key];
          }
        }

        // Cancel any pending URL write and schedule a fresh one.
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current);
        }
        pendingStateRef.current = merged;
        debounceTimerRef.current = setTimeout(() => {
          if (pendingStateRef.current !== null) {
            flushUrlUpdate(pendingStateRef.current);
          }
        }, URL_UPDATE_DEBOUNCE_MS);

        return merged;
      });
    },
    [flushUrlUpdate],
  );

  // ── Cleanup debounce timer on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        // Flush immediately on unmount so the last state is not lost.
        if (pendingStateRef.current !== null) {
          flushUrlUpdate(pendingStateRef.current);
        }
      }
    };
    // flushUrlUpdate is stable due to useCallback; omitting from deps is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Shareable URL ───────────────────────────────────────────────────────
  const shareUrl = useMemo(() => buildShareUrl(state), [state]);

  return { state, setState, shareUrl };
}
