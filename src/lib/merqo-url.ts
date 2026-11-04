/**
 * Base URL of the Merqo platform. Read per call (not at import) so tests and
 * deployments can override `MERQO_BASE_URL` without re-importing callers.
 */
export function merqoBaseUrl(): string {
  return process.env.MERQO_BASE_URL ?? "https://www.merqo.io";
}
