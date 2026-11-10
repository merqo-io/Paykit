// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MfaLoading from "./loading";

describe("MfaLoading", () => {
  it("keeps the main landmark and announces loading to assistive tech", () => {
    render(<MfaLoading />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading");
  });

  it("renders three skeleton rows that respect reduced motion", () => {
    const { container } = render(<MfaLoading />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      3,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
      "animate-pulse",
      "motion-reduce:animate-none",
    );
  });
});
