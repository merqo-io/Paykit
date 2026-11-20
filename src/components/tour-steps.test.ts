import { describe, expect, it, vi } from "vitest";

import { tourSteps } from "./tour-steps";

describe("tourSteps", () => {
  it("returns 6 steps on desktop, 3 on mobile", () => {
    expect(tourSteps(false)).toHaveLength(6);
    expect(tourSteps(true)).toHaveLength(3);
  });

  it("anchors every step to a data-tour selector", () => {
    for (const mode of [false, true]) {
      for (const step of tourSteps(mode)) {
        expect(step.element).toMatch(/^\[data-tour="[a-z-]+"\]$/);
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("opens on the transaction-count stat and ends on the replay button in both modes", () => {
    for (const mode of [false, true]) {
      const steps = tourSteps(mode);
      expect(steps[0].element).toBe('[data-tour="tx-count"]');
      expect(steps[steps.length - 1].element).toBe('[data-tour="tour-replay"]');
    }
  });

  it("renders the real TransactionStatusBadge markup for the example, not a hand-copied color", () => {
    const description = tourSteps(false)[0].description;
    expect(description).toContain("text-mint");
    expect(description).not.toContain('class="tour-example-pill"');
  });

  it("desktop spotlights each nav landmark; mobile spotlights the menu instead", () => {
    const desktop = tourSteps(false).map((s) => s.element);
    expect(desktop).toEqual([
      '[data-tour="tx-count"]',
      '[data-tour="nav-transactions"]',
      '[data-tour="nav-bookings"]',
      '[data-tour="nav-reports"]',
      '[data-tour="nav-account"]',
      '[data-tour="tour-replay"]',
    ]);

    const mobile = tourSteps(true).map((s) => s.element);
    expect(mobile).toContain('[data-tour="nav-menu"]');
    expect(mobile).not.toContain('[data-tour="nav-config"]');
  });

  it("covers Bookings and Reports, and points Payment setup at the account menu", () => {
    const steps = tourSteps(false);
    const bookings = steps.find(
      (s) => s.element === '[data-tour="nav-bookings"]',
    );
    const reports = steps.find(
      (s) => s.element === '[data-tour="nav-reports"]',
    );
    const account = steps.find(
      (s) => s.element === '[data-tour="nav-account"]',
    );
    expect(bookings?.description).toMatch(/deposit|balance/i);
    expect(reports?.description).toMatch(/revenue|earnings/i);
    expect(account?.description).toMatch(/Payment setup/);
  });
});

describe("tour-steps module load", () => {
  // The module is imported by a server-rendered Client Component. Rendering the
  // hook-using badge at import time threw "Invalid hook call" during SSR and
  // 500'd every dashboard page, so nothing may render until a tour starts.
  it("does not render markup on import, only when steps are requested", async () => {
    vi.resetModules();
    const render = vi.fn(() => "<span></span>");
    vi.doMock("react-dom/server", () => ({ renderToStaticMarkup: render }));
    const fresh = await import("./tour-steps");
    expect(render).not.toHaveBeenCalled();
    fresh.tourSteps(false);
    expect(render).toHaveBeenCalledTimes(1);
    vi.doUnmock("react-dom/server");
  });
});
