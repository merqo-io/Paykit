// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionFilters } from "./transaction-filters";

describe("TransactionFilters search", () => {
  it("clears with a tap on the clear button when the plan includes search", async () => {
    const user = userEvent.setup();
    render(<TransactionFilters params={{ q: "A82", page: 1 }} isPaid />);
    const field = screen.getByLabelText("Search");
    expect(field).toHaveValue("A82");
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Clear search" }),
    });
    expect(field).toHaveValue("");
  });

  it("stays disabled and points to the plans on the free plan", () => {
    render(
      <TransactionFilters params={{ q: "A82", page: 1 }} isPaid={false} />,
    );
    expect(screen.getByLabelText("Search")).toBeDisabled();
    expect(screen.getByRole("link", { name: "See plans" })).toBeInTheDocument();
  });
});
