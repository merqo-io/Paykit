import { test, expect } from "@playwright/test";

// The hosted pay page is public, so what it refuses matters more than what it
// shows. There is no database behind this run: a link that gets as far as a
// read can only show the retry notice.
const ID = "22222222-2222-2222-2222-222222222222";
const TOKEN = "A".repeat(43);

test.describe("hosted pay page", () => {
  for (const [name, path] of [
    ["no token", `/pay/${ID}`],
    ["an empty token", `/pay/${ID}?k=`],
    ["a token that is too short", `/pay/${ID}?k=${TOKEN.slice(1)}`],
    ["a token with padding", `/pay/${ID}?k=${TOKEN.slice(1)}%3D`],
    ["a token given twice", `/pay/${ID}?k=${TOKEN}&k=${TOKEN}`],
    ["an id that is not a uuid", `/pay/not-a-uuid?k=${TOKEN}`],
  ] as const) {
    test(`${name} is a 404 that shows no payment`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("button", { name: "I've paid" })).toHaveCount(
        0,
      );
    });
  }

  test("a well-formed link shows nothing it could not read", async ({
    page,
  }) => {
    const response = await page.goto(`/pay/${ID}?k=${TOKEN}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Couldn't load payment right now" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "I've paid" })).toHaveCount(
      0,
    );
  });

  test("the page tells nothing it links to where the customer came from", async ({
    page,
  }) => {
    const response = await page.goto(`/pay/${ID}?k=${TOKEN}`);
    const headers = response?.headers() ?? {};
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  });
});
