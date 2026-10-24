import { createServer, type Server } from "node:http";

// Stands in for GoTrue and PostgREST on the CI dummy project URL, where the
// smoke job has no database.

const USER_ID = "6df824a1-9da2-4608-ad13-2400a9114ec0";
const USER_EMAIL = "e2e-vendor@merqo.test";
const OBJECT_ACCEPT = "application/vnd.pgrst.object+json";

export type MockFixtures = {
  /** Rows PostgREST returns per table; a table not listed is empty. */
  tables?: Record<string, unknown[]>;
  /** JSON an RPC returns; an RPC not listed returns null. */
  rpc?: Record<string, unknown>;
};

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const user = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: USER_EMAIL,
  app_metadata: { provider: "email" },
  user_metadata: {},
  factors: [],
  created_at: "2026-01-01T00:00:00Z",
};

/** The Supabase auth cookie for a signed-in, MFA-cleared (`aal2`) session. */
export function signedInCookie(
  supabaseUrl: string,
  { aal = "aal2" }: { aal?: "aal1" | "aal2" } = {},
): {
  name: string;
  value: string;
} {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600;
  const accessToken = [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({
      sub: USER_ID,
      email: USER_EMAIL,
      role: "authenticated",
      aal,
      amr: [{ method: "totp", timestamp: expiresAt - 3600 }],
      session_id: "5f1f0f6e-0d6e-4d3e-9a8e-0c4f2f6d2b11",
      exp: expiresAt,
    }),
    "mock-signature",
  ].join(".");
  const session = {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    refresh_token: "mock-refresh-token",
    user,
  };
  return {
    name: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
    value: `base64-${base64url(session)}`,
  };
}

export function startSupabaseMock(fixtures: MockFixtures = {}): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "https://mock.invalid");
    const send = (status: number, body: unknown, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };

    if (url.pathname === "/auth/v1/user") {
      return req.headers.authorization
        ? send(200, user)
        : send(401, { code: 401, msg: "no session" });
    }

    if (url.pathname === "/auth/v1/admin/users") {
      return send(200, { users: [user], aud: "authenticated" });
    }

    const rpc = /^\/rest\/v1\/rpc\/(.+)$/.exec(url.pathname);
    if (rpc) return send(200, fixtures.rpc?.[rpc[1]] ?? null);

    const table = /^\/rest\/v1\/([^/]+)$/.exec(url.pathname)?.[1];
    if (!table) return send(404, { message: "not mocked" });

    if (req.method !== "GET" && req.method !== "HEAD") {
      return send(204, undefined);
    }
    const rows = fixtures.tables?.[table] ?? [];
    const range = {
      "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
    };
    if (req.method === "HEAD") return send(200, undefined, range);
    if (req.headers.accept?.includes(OBJECT_ACCEPT)) {
      return rows.length === 1
        ? send(200, rows[0], range)
        : send(406, { code: "PGRST116", message: "no single row" });
    }
    return send(200, rows, range);
  });
}
