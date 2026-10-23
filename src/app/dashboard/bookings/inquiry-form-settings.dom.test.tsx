// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { InquiryForm } from "@/lib/types";

const { saveMock, toastMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./inquiry-actions", () => ({ saveInquiryFormAction: saveMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { InquiryFormSettings, inquiryLink } from "./inquiry-form-settings";

const FORM: InquiryForm = {
  vendor_id: "v1",
  public_id: "0123456789abcdef",
  business_name: "Kopi Cart Co",
  enabled: true,
  terms_url: "https://example.com/t",
  terms_version: "v3",
  created_at: "",
  updated_at: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  saveMock.mockResolvedValue({ status: "ok" });
});

describe("inquiryLink", () => {
  it("builds the public path from the page's origin", () => {
    expect(inquiryLink("https://paykit.merqo.io", "0123456789abcdef")).toBe(
      "https://paykit.merqo.io/inquire/0123456789abcdef",
    );
  });
});

describe("InquiryFormSettings", () => {
  it("offers set-up and no link before a form exists", () => {
    render(<InquiryFormSettings form={null} />);
    expect(
      screen.getByRole("button", { name: "Set up inquiry form" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy inquiry link/i }),
    ).toBeNull();
  });

  it("hides the link while the form is off", () => {
    render(<InquiryFormSettings form={{ ...FORM, enabled: false }} />);
    expect(
      screen.queryByRole("button", { name: /copy inquiry link/i }),
    ).toBeNull();
  });

  it("copies the public link", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    render(<InquiryFormSettings form={FORM} />);
    await user.click(
      screen.getByRole("button", { name: /copy inquiry link/i }),
    );
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/inquire/0123456789abcdef`,
    );
    expect(toastMock.success).toHaveBeenCalledWith("Inquiry link copied");
  });

  it("prefills the saved settings and saves", async () => {
    render(<InquiryFormSettings form={FORM} />);
    await userEvent.click(screen.getByRole("button", { name: "Inquiry form" }));
    expect(screen.getByLabelText("Business name")).toHaveValue("Kopi Cart Co");
    expect(screen.getByLabelText("Terms version")).toHaveValue("v3");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    const fd = saveMock.mock.calls[0][1] as FormData;
    expect(fd.get("business_name")).toBe("Kopi Cart Co");
    expect(fd.get("enabled")).toBe("on");
    expect(toastMock.success).toHaveBeenCalledWith("Inquiry form saved.");
  });

  it("shows a save error in the dialog", async () => {
    saveMock.mockResolvedValue({
      status: "error",
      message: "Use an https:// link",
    });
    render(<InquiryFormSettings form={FORM} />);
    await userEvent.click(screen.getByRole("button", { name: "Inquiry form" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use an https:// link",
    );
  });
});
