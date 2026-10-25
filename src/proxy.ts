import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, robotsHeaderFor, withNonceCsp } from "@merqo/ui/security";
import { updateSession } from "@/lib/supabase/middleware";
import {
  cspOptions,
  needsNonce,
  nonceCspOptions,
} from "@/lib/security-headers";

const CSP = "Content-Security-Policy";

// Browsers enforce frame-ancestors on localhost too, which blocks IDE preview panes.
const devCsp = (csp: string) => csp.replace("; frame-ancestors 'none'", "");

// next.config.ts cannot import the ESM-only @merqo/ui/security, so the CSP
// (nonce on per-request routes, static elsewhere) is set here for every route.
function contentSecurityPolicy(request: NextRequest): string | null {
  const isDev = process.env.NODE_ENV !== "production";
  // Dev renders the theme script differently and needs eval, so it keeps the static policy.
  if (isDev || !needsNonce(request.nextUrl.pathname)) {
    const csp = buildCsp(cspOptions(isDev));
    return isDev ? devCsp(csp) : csp;
  }
  // The nonce must be on the request before updateSession builds its response.
  return withNonceCsp(
    request,
    NextResponse.next(),
    nonceCspOptions(isDev),
  ).headers.get(CSP);
}

export async function proxy(request: NextRequest) {
  const csp = contentSecurityPolicy(request);
  const response = await updateSession(request);
  if (csp) response.headers.set(CSP, csp);
  const robots = robotsHeaderFor(process.env.VERCEL_ENV);
  if (robots) response.headers.set(robots.key, robots.value);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
