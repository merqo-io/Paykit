// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the eyebrow, a level-one title and the description", () => {
    render(
      <PageHeader eyebrow="Billing" title="Plan" description="Your plan." />,
    );
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan");
    expect(screen.getByText("Your plan.")).toBeInTheDocument();
  });

  it("renders the actions slot only when given", () => {
    const { rerender } = render(<PageHeader eyebrow="A" title="B" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <PageHeader eyebrow="A" title="B" actions={<button>Export</button>} />,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });
});
