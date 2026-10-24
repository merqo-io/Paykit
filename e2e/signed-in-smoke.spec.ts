import type { Server } from "node:http";
import { test, expect } from "@playwright/test";
import { signedInCookie, startSupabaseMock } from "./mock-supabase";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const USER_ID = "6df824a1-9da2-4608-ad13-2400a9114ec0";

// Signed in as an admin vendor with MFA cleared, against a stand-in for
// Supabase: every dashboard and admin page must render without a 5xx, an error
// boundary, a page error, a CSP violation or a 404. The stand-in answers with
// empty data, so this proves rendering, not seeded content.
test.describe("signed-in render smoke", () => {
  // One worker owns the stand-in's port for both tests.
  test.describe.configure({ mode: "serial" });

  let server: Server;
  let listening = false;

  test.beforeAll(async () => {
    const url = new URL(SUPABASE_URL);
    server = startSupabaseMock({ tables: { admins: [{ user_id: USER_ID }] } });
    listening = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(Number(url.port), url.hostname, () => resolve(true));
    });
  });

  test.afterAll(async () => {
    if (listening)
      await new Promise<void>((done) => server.close(() => done()));
  });

  test.beforeEach(() => {
    // Intentional, conditional skip: a real stack already owns the port.
    test.skip(!listening, "the Supabase stand-in could not bind its port");
  });

  test("every dashboard and admin page renders", async ({
    context,
    page,
    baseURL,
  }) => {
    const { name, value } = signedInCookie(SUPABASE_URL);
    await context.addCookies([
      { name, value, url: baseURL ?? "http://localhost:3000" },
    ]);

    const notFound: string[] = [];
    page.on("response", (response) => {
      if (
        response.request().isNavigationRequest() &&
        response.status() === 404
      ) {
        notFound.push(response.url());
      }
    });

    // Dynamic: Playwright loads specs as CJS and the helper is ESM-only.
    const { renderSmoke } = await import("@merqo/ui/testing");
    const failures = await renderSmoke(page, [
      "/dashboard",
      "/dashboard/bookings",
      "/dashboard/config",
      "/dashboard/plan",
      "/dashboard/profile",
      "/dashboard/reports/earnings",
      "/dashboard/stats",
      "/dashboard/transactions",
      "/admin",
      "/admin/activity",
      "/admin/vendors",
    ]);

    expect(failures).toEqual([]);
    expect(notFound).toEqual([]);
  });

  test("a password-only admin session is sent to /mfa", async ({
    context,
    page,
    baseURL,
  }) => {
    const { name, value } = signedInCookie(SUPABASE_URL, { aal: "aal1" });
    await context.addCookies([
      { name, value, url: baseURL ?? "http://localhost:3000" },
    ]);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/mfa/);
  });
});
