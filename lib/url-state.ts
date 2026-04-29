/**
 * lib/url-state.ts
 *
 * Pure, side-effect-free utilities for serializing and deserializing filter
 * state to/from URLSearchParams. No React dependency — safe to call anywhere.
 *
 * URL shape
 * ---------
 *   /?q=cloak&exp=classic,kunark&level=45
 *   /?zone=nektulos-forest
 *   /?slots=primary,secondary
 *
 * Rules
 * -----
 * - Arrays are stored as a single comma-separated value: exp=classic,kunark
 * - Empty/default values are omitted entirely (no ?q= ghost params)
 * - level=1 is the default and is omitted; any other numeric value is written
 * - Expansion names in the URL are lowercase; they are compared
 *   case-insensitively when parsing so the canonical display-case values
 *   ("Classic", "Kunark", "Velious") round-trip cleanly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterState {
  /** Free-text search query */
  q?: string;
  /** Active expansions, lowercase in URL: "classic" | "kunark" | "velious" */
  exp?: string[];
  /** Selected zone name (display name, URL-encoded by URLSearchParams) */
  zone?: string;
  /** Player level; 1 is the default and is omitted from the URL */
  level?: number;
  /** Slot filter — future use */
  slots?: string[];
}

// ---------------------------------------------------------------------------
// Serialise: FilterState → URLSearchParams
// ---------------------------------------------------------------------------

/**
 * Convert a FilterState object into URLSearchParams ready to be appended to a
 * URL.  Fields that carry no information (empty strings, empty arrays, level
 * equal to the default of 1) are omitted so the URL stays clean.
 */
export function filterStateToParams(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.q && state.q.trim() !== "") {
    params.set("q", state.q.trim());
  }

  if (state.exp && state.exp.length > 0) {
    params.set("exp", state.exp.map((e) => e.toLowerCase()).join(","));
  }

  if (state.zone && state.zone.trim() !== "") {
    params.set("zone", state.zone.trim());
  }

  // Only write level when it differs from the default (1).
  if (state.level !== undefined && state.level !== 1) {
    params.set("level", String(state.level));
  }

  if (state.slots && state.slots.length > 0) {
    params.set("slots", state.slots.map((s) => s.toLowerCase()).join(","));
  }

  return params;
}

// ---------------------------------------------------------------------------
// Deserialise: URLSearchParams → FilterState
// ---------------------------------------------------------------------------

/**
 * Parse URLSearchParams into a FilterState.  Unknown or malformed values are
 * silently dropped so stale/bookmarked URLs degrade gracefully rather than
 * crashing.
 */
export function paramsToFilterState(params: URLSearchParams): FilterState {
  const state: FilterState = {};

  const q = params.get("q");
  if (q && q.trim() !== "") {
    state.q = q.trim();
  }

  const exp = params.get("exp");
  if (exp && exp.trim() !== "") {
    const values = exp
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length > 0) {
      state.exp = values;
    }
  }

  const zone = params.get("zone");
  if (zone && zone.trim() !== "") {
    state.zone = zone.trim();
  }

  const levelRaw = params.get("level");
  if (levelRaw !== null) {
    const parsed = Number.parseInt(levelRaw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      state.level = parsed;
    }
  }

  const slots = params.get("slots");
  if (slots && slots.trim() !== "") {
    const values = slots
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length > 0) {
      state.slots = values;
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a full shareable URL string from a FilterState and a base URL.
 * Uses the current window.location.origin + pathname when called client-side.
 *
 * @param state  - Current filter state
 * @param origin - Optional base, e.g. "https://example.com/path"; defaults to
 *                 window.location.origin + window.location.pathname when
 *                 running in a browser, or "/" otherwise.
 */
export function buildShareUrl(state: FilterState, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : "/");

  const params = filterStateToParams(state);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
