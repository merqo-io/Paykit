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
