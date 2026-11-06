// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { issueRefundActionMock } = vi.hoisted(() => ({
  issueRefundActionMock: vi.fn(),
}));

vi.mock("./actions", () => ({ issueRefundAction: issueRefundActionMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { RefundDialog } from "./refund-dialog";

beforeEach(() => {
  issueRefundActionMock.mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("RefundDialog", () => {
  it("opens and shows the refund form with the transaction id wired in", () => {
    render(<RefundDialog transactionId="tx1" />);
    fireEvent.click(screen.getByRole("button", { name: /refund/i }));
    const hidden = screen.getByDisplayValue("tx1") as HTMLInputElement;
    expect(hidden.name).toBe("transaction_id");
  });

  it("closes and clears the form after a successful refund", async () => {
    issueRefundActionMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(<RefundDialog transactionId="tx1" />);

    await user.click(screen.getByRole("button", { name: /refund/i }));
    await user.type(screen.getByLabelText("Amount"), "4.50");
    await user.click(screen.getByRole("button", { name: /record refund/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Refund recorded"),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: /issue a refund/i }),
      ).not.toBeInTheDocument(),
    );

    // Reopening shows a blank form, not the previously submitted amount.
    await user.click(screen.getByRole("button", { name: /refund/i }));
    expect(screen.getByLabelText("Amount")).toHaveValue(null);
  });

  it("keeps the dialog open and shows the error on failure", async () => {
    issueRefundActionMock.mockResolvedValue({
      status: "error",
      message: "Could not record refund.",
    });
    const user = userEvent.setup();
    render(<RefundDialog transactionId="tx1" />);

    await user.click(screen.getByRole("button", { name: /refund/i }));
    await user.type(screen.getByLabelText("Amount"), "4.50");
    await user.click(screen.getByRole("button", { name: /record refund/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not record refund.",
      ),
    );
    expect(
      screen.getByRole("heading", { name: /issue a refund/i }),
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
