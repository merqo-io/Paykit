// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PayNotFound, { metadata } from "./not-found";
import { Notice } from "./notice";

describe("PayNotFound", () => {
  it("says what happened and gives the buyer a next step", () => {
    render(<PayNotFound />);
    expect(screen.getByText(/This payment link is not valid/)).toBeVisible();
    expect(screen.getByText(/Ask the stall to show a new QR/)).toBeVisible();
    expect(screen.getByText(/do not pay again/)).toBeVisible();
  });

  it("stays out of search results", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("Notice", () => {
  it("renders the optional next step only when given", () => {
    const { rerender } = render(<Notice title="T" detail="D" />);
    expect(screen.queryByText("Do this")).toBeNull();
    rerender(<Notice title="T" detail="D" next="Do this" />);
    expect(screen.getByText("Do this")).toBeInTheDocument();
  });
});
