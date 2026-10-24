// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { claimMock, statusMock, leaveMock, resizeMock, toastError } = vi.hoisted(
  () => ({
    claimMock: vi.fn(),
    statusMock: vi.fn(),
    leaveMock: vi.fn(),
    resizeMock: vi.fn(),
    toastError: vi.fn(),
  }),
);

vi.mock("./actions", () => ({
  claimHostedPayment: claimMock,
  getHostedPaymentStatus: statusMock,
}));
vi.mock("./leave", () => ({ leaveTo: leaveMock }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@merqo/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@merqo/ui")>();
  return { ...actual, resizeToWebp: resizeMock };
});

import { PayPanel } from "./pay-panel";

const TX_ID = "22222222-2222-2222-8222-222222222222";
const TOKEN = "a".repeat(43);
const RETURN_URL = "https://qkit.merqo.io/order/b1/pay?t=abc";

type View = Parameters<typeof PayPanel>[0]["view"];
const QR: View = { type: "qr", payload: "00020101PAYLOAD" };
const LINK: View = {
  type: "link",
  url: "https://pay.example/kopitiam",
  label: "Pay with PayLah",
};
const IMAGE: View = { type: "image", url: "https://img.example/qr.png" };

function panel(view: View = QR, title: string | null = "Order from Kopi") {
  return render(
    <PayPanel
      id={TX_ID}
      token={TOKEN}
      title={title}
      amountCents={450}
      view={view}
    />,
  );
}

function shot(name = "shot.png", type = "image/png", size = 4) {
  return new File([new Uint8Array(size)], name, { type });
}

async function attach(file: File) {
  await userEvent.upload(
    screen.getByLabelText(/Upload .*screenshot/),
    file,
    // The input accepts image/*; the size and type rules are the panel's.
    { applyAccept: false },
  );
}

beforeEach(() => {
  claimMock
    .mockReset()
    .mockResolvedValue({ success: true, returnUrl: RETURN_URL });
  statusMock
    .mockReset()
    .mockResolvedValue({ status: "pending", returnUrl: RETURN_URL });
  leaveMock.mockReset();
  toastError.mockReset();
  resizeMock.mockReset().mockImplementation(async (file: File) => ({
    blob: file,
    type: file.type,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PayPanel", () => {
  it("shows the title, the amount and a PayNow QR with a save button", () => {
    const { container } = panel();
    expect(
      screen.getByRole("heading", {
        name: "Scan with your PayNow banking app to pay",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Order from Kopi")).toBeInTheDocument();
    expect(screen.getByText("$4.50")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Save QR image" }),
    ).toBeInTheDocument();
  });

  it("shows no title line when the kit sent none", () => {
    panel(QR, null);
    expect(screen.queryByText("Order from Kopi")).not.toBeInTheDocument();
  });

  it("shows a payment link as a button that opens a new tab and tells it nothing", () => {
    panel(LINK);
    const link = screen.getByRole("link", { name: "Pay with PayLah" });
    expect(link).toHaveAttribute("href", "https://pay.example/kopitiam");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.queryByRole("button", { name: "Save QR image" }),
    ).not.toBeInTheDocument();
  });

  it("shows the seller's own QR image, and says so when it cannot load", () => {
    panel(IMAGE);
    const img = screen.getByAltText("Payment QR");
    expect(img).toHaveAttribute("src", "https://img.example/qr.png");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    act(() => {
      img.dispatchEvent(new Event("error"));
    });
    expect(
      screen.getByText(/The payment QR couldn't load/),
    ).toBeInTheDocument();
  });

  it("says payment could not load when the checkout has no stored view", () => {
    panel(null);
    expect(
      screen.getByRole("heading", { name: "Couldn't load payment right now" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I've paid" }),
    ).not.toBeInTheDocument();
  });

  it("requires a screenshot before it claims", async () => {
    panel();
    await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A payment screenshot is required.",
    );
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("claims with the attached screenshot and leaves for the return address", async () => {
    panel();
    await attach(shot());
    expect(await screen.findByText("Screenshot attached")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
    await waitFor(() => expect(leaveMock).toHaveBeenCalledWith(RETURN_URL));
    const [id, token, body] = claimMock.mock.calls[0]!;
    expect(id).toBe(TX_ID);
    expect(token).toBe(TOKEN);
    expect((body as FormData).getAll("proof")).toHaveLength(1);
    expect((body as FormData).get("proof")).toBeInstanceOf(File);
  });

  it("says the payment is recorded when there is nowhere to return to", async () => {
    claimMock.mockResolvedValue({ success: true, returnUrl: null });
    panel();
    await attach(shot());
    await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
    expect(
      await screen.findByRole("heading", { name: "Payment recorded" }),
    ).toBeInTheDocument();
    expect(leaveMock).not.toHaveBeenCalled();
  });

  it("shows the server's error and stays on the page when the claim fails", async () => {
    claimMock.mockResolvedValue({
      success: false,
      error: "Could not record payment. Try again.",
    });
    panel();
    await attach(shot());
    await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Could not record payment. Try again.",
      ),
    );
    expect(leaveMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "I've paid" })).toBeEnabled();
  });

  it.each([
    [
      "an empty file",
      shot("e.png", "image/png", 0),
      "The payment screenshot is empty.",
    ],
    [
      "a file over 1 MB",
      shot("big.png", "image/png", 1024 * 1024 + 1),
      "That image is too large. Try a screenshot instead of a photo.",
    ],
    [
      "a file that is not an accepted image",
      shot("a.gif", "image/gif"),
      "Upload a screenshot or photo (JPEG, PNG or WebP).",
    ],
  ])("refuses %s before any upload", async (_name, file, message) => {
    panel();
    await attach(file);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("Screenshot attached")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("names the resized file after the one the customer picked", async () => {
    resizeMock.mockResolvedValue({
      blob: new Blob([new Uint8Array(4)], { type: "image/webp" }),
      type: "image/webp",
    });
    panel();
    await attach(shot("receipt.png"));
    expect(await screen.findByText("receipt.png")).toBeInTheDocument();
  });

  describe("while it is open", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("asks for the status every 5 seconds and stays while pending", async () => {
      panel();
      expect(statusMock).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(5000));
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(statusMock).toHaveBeenCalledTimes(2);
      expect(statusMock).toHaveBeenCalledWith(TX_ID, TOKEN);
      expect(leaveMock).not.toHaveBeenCalled();
    });

    it("leaves once the payment is confirmed from elsewhere, and stops asking", async () => {
      statusMock.mockResolvedValue({
        status: "confirmed",
        returnUrl: RETURN_URL,
      });
      panel();
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(leaveMock).toHaveBeenCalledWith(RETURN_URL);
      await act(() => vi.advanceTimersByTimeAsync(15000));
      expect(statusMock).toHaveBeenCalledTimes(1);
    });

    it("says the payment is recorded when it is claimed with no return address", async () => {
      statusMock.mockResolvedValue({ status: "claimed", returnUrl: null });
      panel();
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(
        screen.getByRole("heading", { name: "Payment recorded" }),
      ).toBeInTheDocument();
    });

    it.each([
      ["answers nothing", () => Promise.resolve(null)],
      ["fails", () => Promise.reject(new Error("offline"))],
    ])("keeps asking when a status call %s", async (_name, answer) => {
      statusMock.mockImplementation(answer);
      panel();
      await act(() => vi.advanceTimersByTimeAsync(10000));
      expect(statusMock).toHaveBeenCalledTimes(2);
      expect(leaveMock).not.toHaveBeenCalled();
    });

    it("stops asking when the page is closed", async () => {
      const { unmount } = panel();
      unmount();
      await vi.advanceTimersByTimeAsync(15000);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });
});
