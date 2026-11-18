// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Benefits } from "./benefits";

it("surfaces use the kit rounded-lg radius", () => {
  const { container } = render(<Benefits />);
  expect(container.querySelector(".rounded-lg")).not.toBeNull();
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
});

it("has no pricing tile; the FAQ owns pricing", () => {
  const { queryByRole } = render(<Benefits />);
  expect(queryByRole("heading", { name: "Pricing" })).toBeNull();
});

it("states the proven QR engine as a vendor benefit", () => {
  const { getByRole, getByText } = render(<Benefits />);
  expect(
    getByRole("heading", { name: "A QR engine already in use" }),
  ).not.toBeNull();
  expect(
    getByText(
      "Your QR codes come from the same engine qkit already runs for vendors, not a brand-new one.",
    ),
  ).not.toBeNull();
});

it("keeps three tiles with no full-width row left over", () => {
  const { container } = render(<Benefits />);
  expect(container.querySelectorAll("h3")).toHaveLength(3);
  expect(container.querySelector(".sm\\:col-span-3")).toBeNull();
});
