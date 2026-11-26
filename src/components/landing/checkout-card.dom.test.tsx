// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutCard } from "./checkout-card";

it("starts Waiting with a QR and amount in SGD", () => {
  const { container } = render(<CheckoutCard />);
  expect(container.querySelector("svg")).not.toBeNull();
  expect(screen.getByText("S$7.80")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Waiting" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("switches the phone between Waiting, Paid and Confirmed", async () => {
  render(<CheckoutCard />);
  await userEvent.click(screen.getByRole("button", { name: "Paid" }));
  expect(screen.getByRole("button", { name: "Paid" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText(/You said paid/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Confirmed" }));
  expect(screen.getByText(/confirmed it/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Waiting" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

it("keeps one small radius and no shadow on page content", () => {
  const { container } = render(<CheckoutCard />);
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
  expect(container.querySelector('[class*="shadow"]')).toBeNull();
});
