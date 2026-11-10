// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminLoading from "./loading";

describe("AdminLoading", () => {
  it("keeps the main landmark and announces loading to assistive tech", () => {
    render(<AdminLoading />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
  });

  it("renders a header skeleton and three card skeletons, hidden from readers", () => {
    const { container } = render(<AdminLoading />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      5,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
      "animate-pulse",
      "motion-reduce:animate-none",
    );
  });
});
