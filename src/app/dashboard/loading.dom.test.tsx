// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("renders a hidden title block, two stat tiles and a five-row list", () => {
    const { container } = render(<DashboardLoading />);
    const title = container.querySelector('[aria-hidden="true"]');
    const skeletons = Array.from(
      title?.querySelectorAll('[data-slot="skeleton"]') ?? [],
    );
    expect(skeletons).toHaveLength(2);
    expect(skeletons[0]).toHaveClass("h-10", "w-56");
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });

  it("matches PageShell's list width", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.firstElementChild).toHaveClass("max-w-5xl");
  });
});
