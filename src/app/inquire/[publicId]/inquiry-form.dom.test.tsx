// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./actions", () => ({ submitInquiryAction: vi.fn() }));

import { InquiryForm } from "./inquiry-form";

const base = {
  publicId: "0123456789abcdef",
  businessName: "Kopi Cart Co",
  terms: null,
  startedAt: 1_700_000_000_000,
};

describe("InquiryForm", () => {
  it("shows the business, the fields and the collection notice", () => {
    render(<InquiryForm {...base} />);
    expect(
      screen.getByRole("heading", { name: "Kopi Cart Co" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeRequired();
    expect(screen.getByLabelText("Phone number")).toBeRequired();
    expect(screen.getByLabelText("Event date (optional)")).not.toBeRequired();
    expect(screen.getByLabelText("About your event")).toBeRequired();
    expect(
      screen.getByText(
        /We use your phone number and name to pass your inquiry to Kopi Cart Co so they can reply/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("has no marketing consent box", () => {
    render(<InquiryForm {...base} />);
    expect(screen.queryByText(/marketing|promotion|newsletter/i)).toBeNull();
  });

  it("asks for the vendor's terms with a link and the version", () => {
    render(
      <InquiryForm
        {...base}
        terms={{ url: "https://example.com/terms.pdf", version: "v2" }}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "booking terms" })).toHaveAttribute(
      "href",
      "https://example.com/terms.pdf",
    );
    expect(screen.getByText(/\(version v2\)/)).toBeInTheDocument();
  });

  it("carries the render time and a hidden honeypot", () => {
    const { container } = render(<InquiryForm {...base} />);
    expect(container.querySelector('input[name="started_at"]')).toHaveAttribute(
      "value",
      "1700000000000",
    );
    expect(container.querySelector('input[name="website"]')).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
