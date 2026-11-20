// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: toastMock }));

import { BookingIdCopy } from "./booking-id-copy";

describe("BookingIdCopy", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    toastMock.error.mockReset();
  });

  it("copies the booking id by touch", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    render(<BookingIdCopy bookingId="b1" />);
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: /copy booking id/i }),
    });
    expect(writeText).toHaveBeenCalledWith("b1");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("toasts when the clipboard rejects", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    render(<BookingIdCopy bookingId="b1" />);
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: /copy booking id/i }),
    });
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Could not copy the booking ID",
      ),
    );
  });
});
