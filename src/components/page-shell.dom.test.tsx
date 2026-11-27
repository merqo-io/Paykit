// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageShell } from "./page-shell";

describe("PageShell", () => {
  it("renders one h1 with the title and the description", () => {
    render(
      <PageShell title="Payments" description="Every payment, newest first.">
        <p>body</p>
      </PageShell>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Payments" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Every payment, newest first."),
    ).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("uses the list width by default and the narrow width for forms", () => {
    const { container, rerender } = render(<PageShell title="A">x</PageShell>);
    expect(container.firstElementChild).toHaveClass("max-w-5xl");
    rerender(
      <PageShell title="A" width="form">
        x
      </PageShell>,
    );
    expect(container.firstElementChild).toHaveClass("max-w-2xl");
  });

  it("renders the action beside the title and again anchored for phones", () => {
    render(
      <PageShell title="Bookings" action={<button>New booking</button>}>
        x
      </PageShell>,
    );
    expect(screen.getAllByRole("button", { name: "New booking" })).toHaveLength(
      2,
    );
    expect(screen.getByTestId("page-shell-mobile-action")).toHaveClass(
      "sm:hidden",
      "print:hidden",
    );
  });

  it("renders no anchored bar without an action, and shows sub-tabs", () => {
    render(
      <PageShell title="Reports" tabs={<nav aria-label="Report tabs" />}>
        x
      </PageShell>,
    );
    expect(
      screen.queryByTestId("page-shell-mobile-action"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Report tabs" }),
    ).toBeInTheDocument();
  });
});
