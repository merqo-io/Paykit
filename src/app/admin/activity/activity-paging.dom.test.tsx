// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { redirectMock, DATA } = vi.hoisted(() => {
  // 60 newest-first rows: refunds and plan changes alternate, one per hour.
  const base = Date.parse("2026-08-30T12:00:00Z");
  const data = Array.from({ length: 60 }, (_, i) => ({
    id: `row-${i + 1}`,
    admin_id: "u1",
    email: "admin@example.com",
    action: i % 2 === 0 ? "record_refund" : "set_vendor_plan",
    target_id: `target-${i + 1}`,
    detail: null,
    created_at: new Date(base - i * 3_600_000).toISOString(),
  }));
  return {
    DATA: data,
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT ${url}`);
    }),
  };
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/admin", () => ({ requireAdmin: vi.fn(async () => ({})) }));

// Mirrors auditLog's contract: filter, newest-first, slice, clamp the page.
vi.mock("@/lib/admin-data", () => ({
  auditLog: vi.fn(
    async (q: {
      action?: string;
      since?: string;
      before?: string;
      page: number;
      pageSize: number;
    }) => {
      const matched = DATA.filter(
        (r) =>
          (!q.action || r.action === q.action) &&
          (!q.since || r.created_at >= q.since) &&
          (!q.before || r.created_at < q.before),
      );
      const pageCount = Math.max(1, Math.ceil(matched.length / q.pageSize));
      const page = Math.min(q.page, pageCount);
      const start = (q.page - 1) * q.pageSize;
      return {
        rows: matched.slice(start, start + q.pageSize),
        total: matched.length,
        page,
        pageCount,
      };
    },
  ),
}));

import AdminActivityPage from "./page";

async function renderPage(params: Record<string, string>) {
  render(await AdminActivityPage({ searchParams: Promise.resolve(params) }));
}

function targets(): string[] {
  return screen
    .getAllByRole("link", { name: /^target-\d+$/ })
    .map((a) => a.textContent ?? "");
}

describe("AdminActivityPage paging", () => {
  it("shows a Next link and no Previous link on the first page", async () => {
    await renderPage({});
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/activity?page=2",
    );
    expect(
      screen.queryByRole("link", { name: "Previous" }),
    ).not.toBeInTheDocument();
    expect(targets()).toHaveLength(25);
    expect(targets()[0]).toBe("target-1");
  });

  it("shows the second slice of rows on page 2", async () => {
    await renderPage({ page: "2" });
    const shown = targets();
    expect(shown).toHaveLength(25);
    expect(shown[0]).toBe("target-26");
    expect(shown[24]).toBe("target-50");
  });

  it("has no Next link on the last page", async () => {
    await renderPage({ page: "3" });
    expect(targets()).toHaveLength(10);
    expect(
      screen.queryByRole("link", { name: "Next" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/activity?page=2",
    );
  });

  it("renders no pager when the rows fit on one page", async () => {
    // Refunds from the 30th: 12:00Z back to 00:00Z is 7 rows, under a page.
    await renderPage({ action: "record_refund", from: "2026-08-30" });
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("keeps action and date filters in both paging links", async () => {
    await renderPage({
      action: "set_vendor_plan",
      from: "2026-08-25",
      to: "2026-08-31",
      page: "2",
    });
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/activity?action=set_vendor_plan&from=2026-08-25&to=2026-08-31",
    );
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });

  it("keeps filters in the Next link from the first filtered page", async () => {
    await renderPage({ action: "record_refund", from: "2026-08-20" });
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/admin/activity?action=record_refund&from=2026-08-20&page=2",
    );
  });

  it("only pages rows that match the filter", async () => {
    await renderPage({ action: "record_refund", page: "2" });
    // 30 refunds: page 2 holds refunds 26..30, i.e. rows 51, 53, ... 59.
    expect(targets()).toEqual([
      "target-51",
      "target-53",
      "target-55",
      "target-57",
      "target-59",
    ]);
    expect(screen.getByText("30 actions")).toBeInTheDocument();
  });

  it("redirects past the last page to the last page, keeping filters", async () => {
    await expect(
      AdminActivityPage({
        searchParams: Promise.resolve({ action: "record_refund", page: "9" }),
      }),
    ).rejects.toThrow("REDIRECT /admin/activity?action=record_refund&page=2");
  });
});
