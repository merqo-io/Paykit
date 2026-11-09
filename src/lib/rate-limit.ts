import {
  clientIp as sharedClientIp,
  rateLimit as sharedRateLimit,
  rateLimitCheck as sharedRateLimitCheck,
  rateLimitStrict as sharedRateLimitStrict,
  type RateLimitStore,
  type RateLimitVerdict,
} from "@merqo/ui/kit-api";
import type { createServiceClient } from "@/lib/supabase/server";

export type { RateLimitStore, RateLimitVerdict };

/** Every `/api/v1/checkout*` route shares this per-route fixed-window limit. */
export const PER_ROUTE_LIMIT = 60;
/** Window length (seconds) the limit above applies over. */
export const PER_ROUTE_WINDOW_SECONDS = 60;

// Vercel's edge overwrites x-vercel-forwarded-for; x-real-ip and the last
// x-forwarded-for hop (the one a proxy appended) are the fallbacks. Earlier
// hops are client-controlled and never used.
const TRUSTED_IP_HEADERS = [
  "x-vercel-forwarded-for",
  "x-real-ip",
  "x-forwarded-for",
];

/** Best-effort client IP, or the literal "unknown" when no trusted header holds a valid address. */
export function clientIp(hdrs: Headers): string {
  return (
    sharedClientIp(hdrs, { trustedHeaders: TRUSTED_IP_HEADERS }) ?? "unknown"
  );
}

type Supabase = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Counter store over the database fixed-window limiter (`check_rate_limit`).
 * An RPC error throws so the shared helpers can tell a limiter that could not
 * answer apart from a denied call.
 */
export function rpcRateLimitStore(supabase: Supabase): RateLimitStore {
  return {
    async hit(key, limit, windowSeconds) {
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) throw new Error(error.message);
      return data !== false;
    },
  };
}

/** `ok`, `limited`, or `error` when the limiter could not answer, so a caller that fails closed can say which. */
export function rateLimitCheck(
  supabase: Supabase,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  return sharedRateLimitCheck(
    rpcRateLimitStore(supabase),
    key,
    limit,
    windowSeconds,
  );
}

/**
 * Returns true when the call is allowed. Fails OPEN so a degraded limiter
 * never blocks a legitimate calling kit. Paths that take payment claims use
 * `rateLimitStrict` instead.
 */
export function rateLimit(
  supabase: Supabase,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return sharedRateLimit(
    rpcRateLimitStore(supabase),
    key,
    limit,
    windowSeconds,
  );
}

/**
 * Same check as `rateLimit` but fails CLOSED: a limiter error denies the call,
 * so an outage cannot be used to bypass the limit on pay and claim paths.
 */
export function rateLimitStrict(
  supabase: Supabase,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return sharedRateLimitStrict(
    rpcRateLimitStore(supabase),
    key,
    limit,
    windowSeconds,
  );
}
