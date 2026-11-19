// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { setStatusMock, deleteMock, pushMock, toastMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  deleteMock: vi.fn(),
  pushMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../inquiry-actions", () => ({
  setInquiryStatusAction: setStatusMock,
  deleteInquiryAction: deleteMock,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { InquiryDetailActions } from "./inquiry-detail-actions";

beforeEach(() => {
  vi.clearAllMocks();
  setStatusMock.mockResolvedValue({ status: "ok" });
  deleteMock.mockResolvedValue({ status: "ok" });
});

describe("InquiryDetailActions", () => {
  it("marks a new inquiry contacted", async () => {
    render(<InquiryDetailActions inquiryId="i1" status="new" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Mark contacted" }),
    );
    await waitFor(() =>
      expect(setStatusMock).toHaveBeenCalledWith("i1", "contacted"),
    );
    expect(toastMock.success).toHaveBeenCalledWith("Marked contacted");
  });

  it("declines, and shows the error when it fails", async () => {
    setStatusMock.mockResolvedValue({ status: "error", message: "Nope" });
    render(<InquiryDetailActions inquiryId="i1" status="contacted" />);
    expect(screen.queryByRole("button", { name: "Mark contacted" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Nope"));
  });

  it("opens the shared confirm by touch and cancel does nothing", async () => {
    const user = userEvent.setup();
    render(<InquiryDetailActions inquiryId="i1" status="declined" />);
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Delete" }),
    });
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Keep inquiry" }),
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deleteMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("deletes once after confirming by touch, then goes back to Bookings", async () => {
    const user = userEvent.setup();
    render(<InquiryDetailActions inquiryId="i1" status="declined" />);
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Delete" }),
    });
    await user.pointer({
      keys: "[TouchA]",
      target: await screen.findByRole("button", { name: "Delete inquiry" }),
    });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/dashboard/bookings"),
    );
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith("i1");
    expect(toastMock.success).toHaveBeenCalledWith("Inquiry deleted");
  });

  it("stays open and does not navigate when delete fails", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValue({ status: "error", message: "Could not" });
    render(<InquiryDetailActions inquiryId="i1" status="new" />);
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Delete" }),
    });
    await user.pointer({
      keys: "[TouchA]",
      target: await screen.findByRole("button", { name: "Delete inquiry" }),
    });
    expect(await screen.findByText("Could not")).toBeTruthy();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
