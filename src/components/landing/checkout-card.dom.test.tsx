// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CheckoutCard } from "./checkout-card";

it("surfaces use the kit rounded-lg radius", () => {
  const { container } = render(<CheckoutCard />);
  expect(container.querySelector(".rounded-lg")).not.toBeNull();
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
});

it("shows the screenshot step between the QR and the paid button", () => {
  const { container } = render(<CheckoutCard />);
  const labels = Array.from(container.querySelectorAll("button")).map((b) =>
    b.textContent?.trim(),
  );
  expect(labels).toEqual([
    "Save QR image",
    "Upload payment screenshot",
    "I've paid",
  ]);
});
