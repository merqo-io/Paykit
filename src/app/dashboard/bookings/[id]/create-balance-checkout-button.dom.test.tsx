// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { CreateBalanceCheckoutButton } from "./create-balance-checkout-button";
import type { BookingActionState } from "../actions";

const { createBalanceCheckoutActionMock } = vi.hoisted(() => ({
  createBalanceCheckoutActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  createBalanceCheckoutAction: createBalanceCheckoutActionMock,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  createBalanceCheckoutActionMock
    .mockReset()
    .mockResolvedValue({ status: "ok" } satisfies BookingActionState);
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("CreateBalanceCheckoutButton", () => {
  it("calls the action with the booking id and toasts on success", async () => {
    const user = userEvent.setup();
    render(<CreateBalanceCheckoutButton bookingId="b1" />);
    await user.click(
      screen.getByRole("button", { name: /create balance payment/i }),
    );
    await waitFor(() =>
      expect(createBalanceCheckoutActionMock).toHaveBeenCalledWith("b1"),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it("toasts the error message on failure", async () => {
    createBalanceCheckoutActionMock.mockResolvedValue({
      status: "error",
      message: "Create the deposit payment before the balance payment.",
    } satisfies BookingActionState);
    const user = userEvent.setup();
    render(<CreateBalanceCheckoutButton bookingId="b1" />);
    await user.click(
      screen.getByRole("button", { name: /create balance payment/i }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Create the deposit payment before the balance payment.",
      ),
    );
  });
});
