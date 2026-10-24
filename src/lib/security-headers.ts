import type { CspOptions } from "@merqo/ui/security";

// Routes that always render per request, so they can carry a CSP nonce.
export const NONCE_PREFIXES = [
  "/admin",
  "/mfa",
  "/dashboard",
  "/pay",
  "/inquire",
  "/auth",
  "/login",
  "/legal/accept",
] as const;

export function needsNonce(pathname: string): boolean {
  return NONCE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Hash of next-themes' minified inline bootstrap in a production build; e2e/csp.spec.ts fails on any CSP violation if a bump changes it.
export const THEME_SCRIPT_HASH =
  "'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk='";

const SUPABASE = ["https://*.supabase.co"];
const GOOGLE_AVATARS = "https://*.googleusercontent.com";

// The configured project origin too, so a local stack (http://127.0.0.1:54321) works in a production build.
function configuredSupabase(): { http: string[]; ws: string[] } {
  try {
    const { origin } = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { http: [origin], ws: [origin.replace(/^http/, "ws")] };
  } catch {
    return { http: [], ws: [] };
  }
}

// The Vercel toolbar on preview and staging; production never loads it.
function previewSources(): string[] {
  return process.env.VERCEL_ENV === "production" ? [] : ["https://vercel.live"];
}

export function cspOptions(isDev: boolean): Omit<CspOptions, "nonce"> {
  const configured = configuredSupabase();
  const preview = previewSources();
  return {
    isDev,
    connectSrc: [
      ...SUPABASE,
      "wss://*.supabase.co",
      ...configured.http,
      ...configured.ws,
      ...preview,
    ],
    imgSrc: [...SUPABASE, GOOGLE_AVATARS, ...configured.http, ...preview],
    frameSrc: preview,
    scriptSrc: preview,
  };
}

export function nonceCspOptions(isDev: boolean): Omit<CspOptions, "nonce"> {
  const base = cspOptions(isDev);
  return { ...base, scriptSrc: [...(base.scriptSrc ?? []), THEME_SCRIPT_HASH] };
}
