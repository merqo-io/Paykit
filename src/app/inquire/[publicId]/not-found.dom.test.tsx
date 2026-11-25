// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InquireNotFound, { metadata } from "./not-found";

describe("InquireNotFound", () => {
  it("explains the dead end and what to do next", () => {
    render(<InquireNotFound />);
    expect(
      screen.getByText(/This inquiry form is not available/),
    ).toBeVisible();
    expect(screen.getByText(/contact the business directly/i)).toBeVisible();
  });

  it("stays out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
