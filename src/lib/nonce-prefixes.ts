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
