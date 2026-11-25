import { redirectPathSchema } from "@/lib/schemas";

const FAMILY_APEX = "merqo.io";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const MAX_LENGTH = 2000;

function isFamilyHost(url: URL): boolean {
  if (url.protocol !== "https:" || url.port !== "") return false;
  return (
    url.hostname === FAMILY_APEX || url.hostname.endsWith(`.${FAMILY_APEX}`)
  );
}

function isLocalDevHost(url: URL): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
}

/**
 * The address a page may offer as a way back to the Merqo app that sent the
 * vendor here, or null when the value is not one. The value comes from the
 * query string, so anyone can put anything in it: without this check a link
 * to paykit could carry a "Back" button to any site.
 *
 * Accepted: an https URL on merqo.io or one of its subdomains, with no
 * credentials and no explicit port. Outside production, http on localhost is
 * accepted too, so the round trip can be run locally. A preview deployment on
 * vercel.app is not a family host, because anyone can deploy there.
 *
 * Returns the parsed URL's own serialisation, never the raw text.
 */
export function familyReturnUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH)
    return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username !== "" || url.password !== "") return null;
  return isFamilyHost(url) || isLocalDevHost(url) ? url.href : null;
}

/**
 * The page's own address with `return_to` kept only when it passes
 * `familyReturnUrl`, so it can ride through sign-in as a same-origin relative
 * path. An invalid value is dropped, never forwarded.
 */
export function pathWithReturnTo(path: string, raw: unknown): string {
  const checked = familyReturnUrl(raw);
  if (!checked) return path;
  return `${path}?${new URLSearchParams({ return_to: checked }).toString()}`;
}

const PLACEHOLDER_ORIGIN = "https://paykit.invalid";
const UNSAFE_PATH_CHARS = /[\u0000- \u007f\\]/;

/**
 * A post-sign-in destination that is certain to stay on this site, or null.
 * The URL parser drops tabs and newlines and reads a backslash as a slash, so
 * a plain "starts with one slash" test lets `/<tab>/evil.example` through as a
 * scheme-relative URL. Rejecting those characters, resolving against a fixed
 * origin and requiring the same origin back closes that, and a percent-encoded
 * `//` or backslash is refused too because some browsers and proxies decode it.
 * Returns pathname, query and hash only, never the raw text.
 */
export function safeNextPath(raw: unknown): string | null {
  const parsed = redirectPathSchema.safeParse(raw);
  if (!parsed.success || UNSAFE_PATH_CHARS.test(parsed.data)) return null;
  let url: URL;
  try {
    url = new URL(parsed.data, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Where to send a signed-out visitor: `/login`, carrying `next` only when
 * `safeNextPath` accepts it (the same guard `/auth/callback` and the login
 * page apply).
 */
export function loginRedirectPath(next?: string): string {
  const safe = safeNextPath(next);
  if (!safe) return "/login";
  return `/login?${new URLSearchParams({ next: safe }).toString()}`;
}

/**
 * A page's own path plus its current query string, for use as the `returnTo`
 * of a gate redirect. Repeated keys are kept; undefined values are dropped.
 */
export function pathWithSearch(
  path: string,
  search: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  const text = qs.toString();
  return text ? `${path}?${text}` : path;
}
