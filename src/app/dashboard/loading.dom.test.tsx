// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("renders a header skeleton followed by three card skeletons", () => {
    const { container } = render(<DashboardLoading />);
    const skeletons = Array.from(
      container.querySelectorAll('[data-slot="skeleton"]'),
    );
    expect(skeletons).toHaveLength(5);
    expect(skeletons[0]).toHaveClass("h-3", "w-24");
    expect(skeletons[1]).toHaveClass("h-10", "w-72");
    for (const card of skeletons.slice(2)) {
      expect(card).toHaveClass("h-28", "w-full", "rounded-xl");
    }
  });

  it("matches the page width and respects reduced motion", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.firstElementChild).toHaveClass(
      "max-w-7xl",
      "animate-pulse",
      "motion-reduce:animate-none",
    );
  });
});
