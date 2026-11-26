// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutCard } from "./checkout-card";

it("starts Awaiting payment with a QR and amount in SGD", () => {
  const { container } = render(<CheckoutCard />);
  expect(container.querySelector("svg")).not.toBeNull();
  expect(screen.getByText("S$7.80")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Awaiting payment" }),
  ).toHaveAttribute("aria-pressed", "true");
});

it("walks the order through the dashboard's three statuses", async () => {
  render(<CheckoutCard />);
  await userEvent.click(screen.getByRole("button", { name: "Marked paid" }));
  expect(screen.getByRole("button", { name: "Marked paid" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("Payment recorded")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Received" }));
  expect(screen.getByText("Payment recorded")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Awaiting payment" }),
  ).toHaveAttribute("aria-pressed", "false");
});

it("keeps one small radius and no shadow on page content", () => {
  const { container } = render(<CheckoutCard />);
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
  expect(container.querySelector('[class*="shadow"]')).toBeNull();
});
