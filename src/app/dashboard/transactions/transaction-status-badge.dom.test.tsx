// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionStatusBadge } from "./transaction-status-badge";

describe("TransactionStatusBadge hint", () => {
  it("opens the claimed-vs-confirmed hint on tap, not just hover", async () => {
    const user = userEvent.setup();
    render(<TransactionStatusBadge status="claimed" />);
    expect(
      screen.queryByText(/check the money actually landed/i),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: 'What "Marked paid" means' }),
    );

    expect(
      await screen.findByText(/check the money actually landed/i),
    ).toBeInTheDocument();
  });

  it("shows the confirmed status's own hint", async () => {
    const user = userEvent.setup();
    render(<TransactionStatusBadge status="confirmed" />);

    await user.click(
      screen.getByRole("button", { name: 'What "Received" means' }),
    );

    expect(await screen.findByText(/can't be undone/i)).toBeInTheDocument();
  });
});
