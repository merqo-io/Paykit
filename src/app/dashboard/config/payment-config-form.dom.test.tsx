// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentConfigForm } from "./payment-config-form";

const { saveConfigActionMock } = vi.hoisted(() => ({
  saveConfigActionMock: vi.fn(),
}));

vi.mock("./actions", () => ({
  saveConfigAction: saveConfigActionMock,
}));
vi.mock("@merqo/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@merqo/ui")>();
  return {
    ...actual,
    ImageUploader: () => <div data-testid="image-uploader" />,
  };
});

beforeEach(() => {
  saveConfigActionMock.mockReset();
});

describe("PaymentConfigForm", () => {
  it("defaults to the PayNow section, shows the UEN field, switches to mobile on toggle", () => {
    render(<PaymentConfigForm initial={null} vendorId="v1" />);
    expect(screen.getByLabelText("UEN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /mobile/i }));
    expect(screen.getByLabelText("Mobile")).toBeInTheDocument();
  });

  it("renders a QR preview once payee name + identifier are filled", () => {
    render(<PaymentConfigForm initial={null} vendorId="v1" />);
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Payee name"), {
      target: { value: "Kopitiam Cart" },
    });
    fireEvent.change(screen.getByLabelText("UEN"), {
      target: { value: "53312345A" },
    });
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a role=alert error message once the server action returns status: error", async () => {
    saveConfigActionMock.mockResolvedValue({
      status: "error",
      message: "Provide exactly one of UEN or mobile.",
    });
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /save payment config/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Provide exactly one of UEN or mobile.",
      );
    });
    expect(saveConfigActionMock).toHaveBeenCalledTimes(1);
  });

  it("switches to the pointer section and shows link/QR-image sub-options under the Other preset", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );
    await user.click(screen.getByRole("radio", { name: "Other / custom" }));

    expect(screen.getByLabelText("Button label")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment link")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Use a QR image" }));
    expect(screen.getByTestId("image-uploader")).toBeInTheDocument();
  });

  it("prefills the pointer section from an existing pointer config", () => {
    render(
      <PaymentConfigForm
        vendorId="v1"
        initial={{
          vendor_id: "v1",
          kind: "pointer",
          uen: null,
          mobile: null,
          payee_name: null,
          label: "Pay with PayLah",
          url: "https://pay.example/kopitiam",
          qr_image_url: null,
          verification_method: "manual",
          plan: "free",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByLabelText("Button label")).toHaveValue(
      "Pay with PayLah",
    );
    expect(screen.getByLabelText("Payment link")).toHaveValue(
      "https://pay.example/kopitiam",
    );
  });

  it("defaults the preset picker to Stripe for a brand-new pointer config, shows its instructions, and pre-fills the label", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );

    expect(
      screen.getByRole("radio", { name: "Stripe Payment Link" }),
    ).toBeChecked();
    expect(
      screen.getByText(/Stripe Dashboard → Payment Links/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Button label")).toHaveValue(
      "Pay with Stripe",
    );
    // Stripe/HitPay/PayLah! lock the mode — no link/QR toggle shown.
    expect(
      screen.queryByRole("radio", { name: "Use a payment link" }),
    ).not.toBeInTheDocument();
  });

  it("switching to HitPay shows HitPay instructions and pre-fills the label only when it was empty", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );
    await user.click(
      screen.getByRole("radio", { name: "HitPay Payment Link" }),
    );

    expect(
      screen.getByText(/HitPay Dashboard → Payment Links/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Button label")).toHaveValue(
      "Pay with HitPay",
    );

    await user.clear(screen.getByLabelText("Button label"));
    await user.type(screen.getByLabelText("Button label"), "My Stall");
    await user.click(
      screen.getByRole("radio", { name: "Stripe Payment Link" }),
    );

    // Label was already set by the vendor — switching presets must not clobber it.
    expect(screen.getByLabelText("Button label")).toHaveValue("My Stall");
  });

  it("selecting PayLah! locks QR mode, shows the image uploader, and hides the link field", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );
    await user.click(screen.getByRole("radio", { name: "PayLah! QR" }));

    expect(screen.getByTestId("image-uploader")).toBeInTheDocument();
    expect(screen.queryByLabelText("Payment link")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Open DBS PayLah! → your QR code screen/),
    ).toBeInTheDocument();
  });

  it("selecting Other shows the link/QR toggle exactly as today, with the generic instructions", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );
    await user.click(screen.getByRole("radio", { name: "Other / custom" }));

    expect(
      screen.getByRole("radio", { name: "Use a payment link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Use a QR image" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/GrabPay, ShopeePay, Qashier/)).toBeInTheDocument();
  });

  it("warns on a non-matching URL under Stripe without blocking save, and clears once it matches", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);

    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );
    await user.type(
      screen.getByLabelText("Payment link"),
      "https://example.com/pay",
    );

    expect(
      screen.getByText(/doesn't look like a Stripe Payment Link/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save payment config/i }),
    ).not.toBeDisabled();

    await user.clear(screen.getByLabelText("Payment link"));
    await user.type(
      screen.getByLabelText("Payment link"),
      "https://buy.stripe.com/test_abc123",
    );

    expect(
      screen.queryByText(/doesn't look like a Stripe Payment Link/),
    ).not.toBeInTheDocument();
  });

  it("re-derives the Stripe preset from an existing pointer config's URL on edit", () => {
    render(
      <PaymentConfigForm
        vendorId="v1"
        initial={{
          vendor_id: "v1",
          kind: "pointer",
          uen: null,
          mobile: null,
          payee_name: null,
          label: "Pay with Stripe",
          url: "https://buy.stripe.com/test_abc123",
          qr_image_url: null,
          verification_method: "manual",
          plan: "free",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "Stripe Payment Link" }),
    ).toBeChecked();
  });

  it("falls back to the Other preset on edit for a URL that matches no known preset", () => {
    render(
      <PaymentConfigForm
        vendorId="v1"
        initial={{
          vendor_id: "v1",
          kind: "pointer",
          uen: null,
          mobile: null,
          payee_name: null,
          label: "Pay with PayLah",
          url: "https://pay.example/kopitiam",
          qr_image_url: null,
          verification_method: "manual",
          plan: "free",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    expect(screen.getByRole("radio", { name: "Other / custom" })).toBeChecked();
    // Existing saved data still displays correctly under the Other fallback.
    expect(screen.getByLabelText("Payment link")).toHaveValue(
      "https://pay.example/kopitiam",
    );
  });
});

describe("PaymentConfigForm way back", () => {
  const RETURN_TO = "https://qkit.merqo.io/dashboard/booths/b1";

  async function save(returnTo: string | null, status: "ok" | "error") {
    saveConfigActionMock.mockResolvedValue(
      status === "ok" ? { status } : { status, message: "Nope" },
    );
    const user = userEvent.setup();
    render(
      <PaymentConfigForm initial={null} vendorId="v1" returnTo={returnTo} />,
    );
    await user.click(
      screen.getByRole("button", { name: /save payment config/i }),
    );
    await waitFor(() => expect(saveConfigActionMock).toHaveBeenCalled());
  }

  function backLink() {
    return screen.queryByRole("link", { name: "Back to your booth" });
  }

  it("offers the way back once a save succeeds", async () => {
    await save(RETURN_TO, "ok");

    expect(
      await screen.findByRole("link", { name: "Back to your booth" }),
    ).toHaveAttribute("href", RETURN_TO);
  });

  it("offers no way back before a save", () => {
    render(
      <PaymentConfigForm initial={null} vendorId="v1" returnTo={RETURN_TO} />,
    );

    expect(backLink()).toBeNull();
  });

  it("offers no way back when the save fails", async () => {
    await save(RETURN_TO, "error");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(backLink()).toBeNull();
  });

  it("offers no way back when the page was given none", async () => {
    await save(null, "ok");

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(backLink()).toBeNull();
  });
});
