// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("renders a title and description, two stat cards and five list rows", () => {
    const { container } = render(<DashboardLoading />);
    const skeletons = Array.from(
      container.querySelectorAll('[data-slot="skeleton"]'),
    );
    expect(skeletons).toHaveLength(9);
    expect(skeletons[0]).toHaveClass("h-10", "w-56");
    expect(skeletons[1]).toHaveClass("h-4");
    for (const card of skeletons.slice(2, 4)) {
      expect(card).toHaveClass("h-28", "w-full", "rounded-xl");
    }
    for (const row of skeletons.slice(4)) {
      expect(row).toHaveClass("h-14", "w-full");
    }
  });

  it("matches PageShell's list width and respects reduced motion", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.firstElementChild).toHaveClass(
      "max-w-5xl",
      "animate-pulse",
      "motion-reduce:animate-none",
    );
  });
});
