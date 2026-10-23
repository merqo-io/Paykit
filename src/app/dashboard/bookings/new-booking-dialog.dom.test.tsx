// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewBookingDialog } from "./new-booking-dialog";
import type { BookingActionState } from "./actions";

const { createBookingActionMock } = vi.hoisted(() => ({
  createBookingActionMock: vi.fn(),
}));

vi.mock("./actions", () => ({
  createBookingAction: createBookingActionMock,
}));

beforeEach(() => {
  createBookingActionMock
    .mockReset()
    .mockResolvedValue({ status: "ok" } satisfies BookingActionState);
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Customer name"), "Jane Tan");
  await user.type(screen.getByLabelText("Event date"), "2026-12-01");
  await user.type(screen.getByLabelText("Balance due date"), "2026-11-24");
  await user.type(screen.getByLabelText("Total amount"), "1000");
  await user.type(screen.getByLabelText("Deposit"), "300");
}

describe("NewBookingDialog", () => {
  it("converts an inquiry: prefilled client details and the inquiry id", async () => {
    const user = userEvent.setup();
    render(
      <NewBookingDialog
        triggerLabel="Convert to booking"
        prefill={{
          inquiryId: "i1",
          customerName: "Ah Hock",
          customerPhone: "91234567",
          eventDate: "2026-12-12",
        }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Convert to booking" }),
    );
    expect(screen.getByLabelText("Customer name")).toHaveValue("Ah Hock");
    expect(screen.getByLabelText("Customer phone (optional)")).toHaveValue(
      "91234567",
    );
    expect(screen.getByLabelText("Event date")).toHaveValue("2026-12-12");
    await user.type(screen.getByLabelText("Balance due date"), "2026-12-01");
    await user.type(screen.getByLabelText("Total amount"), "1000");
    await user.type(screen.getByLabelText("Deposit"), "300");
    await user.click(screen.getByRole("button", { name: "Create booking" }));
    await waitFor(() => expect(createBookingActionMock).toHaveBeenCalled());
    const fd = createBookingActionMock.mock.calls[0][1] as FormData;
    expect(fd.get("inquiry_id")).toBe("i1");
  });

  it("opens the dialog and submits a booking, then closes on success", async () => {
    const user = userEvent.setup();
    render(<NewBookingDialog />);

    await user.click(screen.getByRole("button", { name: "New booking" }));
    expect(
      screen.getByRole("heading", { name: "New booking" }),
    ).toBeInTheDocument();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create booking/i }));

    await waitFor(() => expect(createBookingActionMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "New booking" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("auto-derives the balance amount from total - deposit until the vendor edits it", async () => {
    const user = userEvent.setup();
    render(<NewBookingDialog />);
    await user.click(screen.getByRole("button", { name: "New booking" }));

    await user.type(screen.getByLabelText("Total amount"), "1000");
    await user.type(screen.getByLabelText("Deposit"), "300");
    expect(screen.getByLabelText("Balance")).toHaveValue(700);

    await user.clear(screen.getByLabelText("Balance"));
    await user.type(screen.getByLabelText("Balance"), "650");
    await user.type(screen.getByLabelText("Deposit"), "1");
    // Now touched — no longer overwritten by the total/deposit derivation.
    expect(screen.getByLabelText("Balance")).toHaveValue(650);
  });

  it("keeps the dialog open and shows an inline error on a failed submit", async () => {
    createBookingActionMock.mockResolvedValue({
      status: "error",
      message: "Could not create booking. Try again.",
    } satisfies BookingActionState);
    const user = userEvent.setup();
    render(<NewBookingDialog />);
    await user.click(screen.getByRole("button", { name: "New booking" }));

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /create booking/i }));

    expect(
      await screen.findByText("Could not create booking. Try again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New booking" }),
    ).toBeInTheDocument();
  });
});
