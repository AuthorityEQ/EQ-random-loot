/**
 * api-helpers.ts
 *
 * Shared utilities for all API route handlers:
 *   - Standard meta envelope
 *   - CORS headers
 *   - JSON response builder
 *   - Query param parsing helpers
 */

export const API_VERSION = "1.0";
export const API_SOURCE = "EQ-random-loot/0.2";

/** 24-hour revalidation for mostly-static loot data */
export const REVALIDATE_SECONDS = 86400;

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

export type ApiMeta = {
  version: string;
  timestamp: string;
  source: string;
};

export type ApiEnvelope<T> = {
  data: T;
  meta: ApiMeta;
};

function buildMeta(): ApiMeta {
  return {
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    source: API_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// CORS headers — open to all origins for third-party tooling
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function jsonOk<T>(payload: T, extra?: Record<string, string>): Response {
  const body: ApiEnvelope<T> = {
    data: payload,
    meta: buildMeta(),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
      ...CORS_HEADERS,
      ...(extra ?? {}),
    },
  });
}

export function jsonNotFound(message: string): Response {
  return new Response(
    JSON.stringify({
      error: message,
      meta: buildMeta(),
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    },
  );
}

export function jsonBadRequest(message: string): Response {
  return new Response(
    JSON.stringify({
      error: message,
      meta: buildMeta(),
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    },
  );
}

/** Respond to CORS preflight OPTIONS requests */
export function corsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ---------------------------------------------------------------------------
// Query param helpers
// ---------------------------------------------------------------------------

/**
 * Extract a trimmed lowercase string param, or null if absent/empty.
 */
export function strParam(url: URL, key: string): string | null {
  const raw = url.searchParams.get(key)?.trim();
  return raw ? raw.toLowerCase() : null;
}

/**
 * Extract an integer param, or null if absent/invalid.
 */
export function intParam(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
