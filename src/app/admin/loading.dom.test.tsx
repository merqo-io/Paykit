// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminLoading from "./loading";

describe("AdminLoading", () => {
  it("keeps the main landmark and announces loading to assistive tech", () => {
    render(<AdminLoading />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(3);
    for (const status of statuses) {
      expect(status).toHaveAttribute("aria-busy", "true");
      expect(status).toHaveTextContent("Loading");
    }
  });

  it("renders a hidden header skeleton above three shared tile skeletons", () => {
    const { container } = render(<AdminLoading />);
    const header = container.querySelector('main > [aria-hidden="true"]');
    expect(header?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
  });
});
