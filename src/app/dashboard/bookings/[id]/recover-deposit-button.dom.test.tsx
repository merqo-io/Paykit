// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { RecoverDepositButton } from "./recover-deposit-button";
const { recover } = vi.hoisted(() => ({ recover: vi.fn() }));
vi.mock("../deposit-actions", () => ({
  recoverDepositCheckoutAction: recover,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  recover.mockReset().mockResolvedValue({ status: "ok" });
});
describe("RecoverDepositButton", () => {
  it("retries the selected booking and reports success", async () => {
    const user = userEvent.setup();
    render(<RecoverDepositButton bookingId="b1" />);
    await user.click(
      screen.getByRole("button", { name: "Retry deposit payment" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Deposit payment ready"),
    );
    expect(recover).toHaveBeenCalledWith("b1");
  });
  it("shows the actionable server error instead of a success toast", async () => {
    recover.mockResolvedValue({
      status: "error",
      message: "Refresh and try again.",
    });
    const user = userEvent.setup();
    render(<RecoverDepositButton bookingId="b1" />);
    await user.click(
      screen.getByRole("button", { name: "Retry deposit payment" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Refresh and try again"),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
  it("handles a rejected action and enables retry", async () => {
    recover.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<RecoverDepositButton bookingId="b1" />);
    await user.click(
      screen.getByRole("button", { name: "Retry deposit payment" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not recover the deposit payment. Try again",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Retry deposit payment" }),
    ).toBeEnabled();
  });
});
