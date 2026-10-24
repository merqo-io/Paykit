import { test, expect, type Page } from "@playwright/test";

function watchCsp(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) {
      problems.push(m.text());
    }
  });
  page.on("pageerror", (e) => problems.push(e.message));
  return problems;
}

// Dev keeps the static policy (React needs eval); CI serves the production build.
test.describe("CSP", () => {
  // Intentional, conditional skip: the nonce policy only exists in a production build.
  test.skip(!process.env.CI, "nonce CSP is production-only");

  test("a per-request page runs its scripts under a nonce CSP", async ({
    page,
  }) => {
    const problems = watchCsp(page);
    const response = await page.goto("/login");
    const csp = response?.headers()["content-security-policy"] ?? "";

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(await page.locator("script[nonce]").count()).toBeGreaterThan(0);
    await expect(
      page.getByRole("button", { name: /Continue with Google/ }),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a static page keeps the static CSP and still runs", async ({
    page,
  }) => {
    const problems = watchCsp(page);
    const response = await page.goto("/");

    expect(response?.headers()["content-security-policy"]).toMatch(
      /script-src 'self' 'unsafe-inline'/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /One payment setup/ }),
    ).toBeVisible();
    expect(problems).toEqual([]);
  });
});
