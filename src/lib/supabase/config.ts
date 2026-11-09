import { publicEnv } from "@/lib/env";

/**
 * paykit's connection settings for the shared Supabase factories. Built per
 * call so a test or deployment can change `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`
 * without re-importing callers; the literal `process.env.NEXT_PUBLIC_*` read
 * is what Next inlines into the browser bundle.
 */
export function supabaseConfig() {
  return {
    url: publicEnv.supabaseUrl,
    publishableKey: publicEnv.supabasePublishableKey,
    schema: "paykit",
    cookieDomain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN || undefined,
  };
}
