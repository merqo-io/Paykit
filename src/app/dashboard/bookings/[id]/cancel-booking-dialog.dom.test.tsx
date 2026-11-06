// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { cancelBookingActionMock } = vi.hoisted(() => ({
  cancelBookingActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({ cancelBookingAction: cancelBookingActionMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import type { Transaction } from "@/lib/types";

const CONFIRMED_DEPOSIT: Transaction = {
  id: "tx-deposit",
  vendor_id: "v1",
  kit_slug: "paykit",
  order_ref: "booking:b1:deposit",
  amount_cents: 30000,
  status: "confirmed",
  qr_payload: "0002...",
  claimed_at: "2026-08-20T00:01:00Z",
  confirmed_at: "2026-08-20T00:02:00Z",
  created_at: "2026-08-20T00:00:00Z",
};

beforeEach(() => {
  cancelBookingActionMock.mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("CancelBookingDialog", () => {
  it("opens, submits the typed reason, toasts, and closes on success", async () => {
    cancelBookingActionMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(<CancelBookingDialog bookingId="b1" />);

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    await user.type(screen.getByLabelText(/reason/i), "Customer rescheduled");
    await user.click(
      screen.getByRole("button", { name: /confirm cancellation/i }),
    );

    await waitFor(() =>
      expect(cancelBookingActionMock).toHaveBeenCalledWith(
        "b1",
        "Customer rescheduled",
      ),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /cancel this booking/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps the dialog open and shows the error on failure", async () => {
    cancelBookingActionMock.mockResolvedValue({
      status: "error",
      message: "Could not cancel the booking. Try again.",
    });
    const user = userEvent.setup();
    render(<CancelBookingDialog bookingId="b1" />);

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    await user.click(
      screen.getByRole("button", { name: /confirm cancellation/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not cancel the booking. Try again.",
      ),
    );
    expect(
      screen.getByRole("heading", { name: /cancel this booking/i }),
    ).toBeInTheDocument();
  });

  it("hides the refund field when no single transaction is unambiguously refundable", async () => {
    const user = userEvent.setup();
    render(<CancelBookingDialog bookingId="b1" />);
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.queryByLabelText(/refund amount/i)).not.toBeInTheDocument();
  });

  it("shows a refund field for the one confirmed transaction and passes it through on submit", async () => {
    cancelBookingActionMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(
      <CancelBookingDialog bookingId="b1" depositTx={CONFIRMED_DEPOSIT} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    await user.type(screen.getByLabelText(/refund amount/i), "150.00");
    await user.click(
      screen.getByRole("button", { name: /confirm cancellation/i }),
    );

    await waitFor(() =>
      expect(cancelBookingActionMock).toHaveBeenCalledWith("b1", "", {
        transactionId: "tx-deposit",
        amountCents: 15000,
      }),
    );
  });
});

describe("CancelBookingDialog refund field", () => {
  it("labels the amount with an S$ prefix and a decimal keyboard", async () => {
    const user = userEvent.setup();
    render(
      <CancelBookingDialog bookingId="b1" depositTx={CONFIRMED_DEPOSIT} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const input = screen.getByLabelText("Refund amount (optional)");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByText("S$")).toBeInTheDocument();
  });

  it("rejects a non-positive refund inline without calling the action", async () => {
    const user = userEvent.setup();
    render(
      <CancelBookingDialog bookingId="b1" depositTx={CONFIRMED_DEPOSIT} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    const input = screen.getByLabelText("Refund amount (optional)");
    await user.type(input, "0");
    await user.click(
      screen.getByRole("button", { name: /confirm cancellation/i }),
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Enter an amount greater than 0.",
    );
    expect(cancelBookingActionMock).not.toHaveBeenCalled();
  });

  it("explains refund tracking is Pro for free vendors and sends no refund", async () => {
    cancelBookingActionMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(
      <CancelBookingDialog
        bookingId="b1"
        depositTx={CONFIRMED_DEPOSIT}
        isPro={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.queryByLabelText(/refund amount/i)).toBeNull();
    expect(
      screen.getByText(/Refund tracking is on the Pro plan/),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /confirm cancellation/i }),
    );
    await waitFor(() =>
      expect(cancelBookingActionMock).toHaveBeenCalledWith("b1", ""),
    );
  });

  it("closes with Keep booking", async () => {
    const user = userEvent.setup();
    render(<CancelBookingDialog bookingId="b1" />);
    await user.click(screen.getByRole("button", { name: "Cancel booking" }));
    await user.click(screen.getByRole("button", { name: "Keep booking" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
