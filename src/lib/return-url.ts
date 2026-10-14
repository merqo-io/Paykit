const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Also the column's own length check (0024). */
export const RETURN_URL_MAX = 2000;

function parse(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function schemeAllowed(url: URL): boolean {
  if (url.protocol === "https:") return true;
  return (
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    LOCAL_HOSTS.has(url.hostname)
  );
}

/**
 * The address the pay page may send a customer back to, or null when `raw`
 * is not one for this kit.
 *
 * `registeredOrigin` is the calling kit's `kit_api_keys.return_origin`. The
 * two are compared as parsed origins (scheme, host and port), never as text:
 * `https://qkit.merqo.io.evil.com` and `https://qkit.merqo.io@evil.com` both
 * begin with a registered `https://qkit.merqo.io` and are on neither its
 * host nor its origin. Without this check the pay page would redirect to
 * any address a caller named.
 *
 * Accepted: an https URL with no credentials, at most 2000 characters, on
 * exactly the registered origin. Outside production, http on localhost is
 * accepted too, so the round trip can be run locally. A kit with no
 * registered origin has no valid return address.
 *
 * Returns the parsed URL's own serialisation, never the raw text.
 */
export function kitReturnUrl(
  raw: unknown,
  registeredOrigin: string | null | undefined,
): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw.length > RETURN_URL_MAX || !registeredOrigin) return null;

  const registered = parse(registeredOrigin);
  const url = parse(raw);
  if (!registered || !url) return null;
  if (!schemeAllowed(registered) || !schemeAllowed(url)) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.origin !== registered.origin) return null;
  return url.href.length <= RETURN_URL_MAX ? url.href : null;
}
