// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QkitPhone } from "./qkit-phone";

it("shows the stall, the order total and a QR", () => {
  const { container } = render(<QkitPhone />);
  expect(screen.getByText("Kopitiam Cart")).toBeInTheDocument();
  expect(screen.getByText("Kaya Toast")).toBeInTheDocument();
  expect(screen.getByText("S$4.30")).toBeInTheDocument();
  expect(container.querySelector("svg")).not.toBeNull();
});

it("has no state toggle or status pill", () => {
  render(<QkitPhone />);
  expect(screen.queryByRole("group", { name: "Payment status" })).toBeNull();
  expect(screen.queryByText("Awaiting payment")).toBeNull();
});

it("records the payment on I've paid and can undo it", async () => {
  render(<QkitPhone />);
  await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
  expect(
    screen.getByText("Payment sent. The stall is checking it."),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Tapped by mistake? Undo" }),
  );
  expect(screen.getByRole("button", { name: "I've paid" })).toBeInTheDocument();
});

it("keeps one small radius and no shadow on page content", () => {
  const { container } = render(<QkitPhone />);
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
  expect(container.querySelector('[class*="shadow"]')).toBeNull();
});
