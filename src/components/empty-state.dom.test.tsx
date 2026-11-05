// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the headline and sentence without actions", () => {
    render(
      <EmptyState title="No payments yet" description="They show here." />,
    );
    expect(
      screen.getByRole("heading", { name: "No payments yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("They show here.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders up to two action slots", () => {
    render(
      <EmptyState
        title="T"
        description="D"
        primaryAction={<a href="/a">First</a>}
        secondaryAction={<a href="/b">Second</a>}
      />,
    );
    expect(screen.getByRole("link", { name: "First" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Second" })).toBeInTheDocument();
  });
});
