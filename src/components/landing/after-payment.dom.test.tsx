// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionStatusBadge } from "@/app/dashboard/transactions/transaction-status-badge";
import { AfterPayment, STATUS, type Status } from "./after-payment";

it("labels the block as sample data and makes three points", () => {
  const { container } = render(<AfterPayment />);
  expect(screen.getByText(/Sample data/)).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  expect(container.textContent).not.toMatch(/analytics|insight|\bAI\b/i);
});

it("shows ledger rows with the dashboard's status labels", () => {
  render(<AfterPayment />);
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(6);
  for (const label of ["Awaiting payment", "Marked paid", "Received"]) {
    expect(within(table).getAllByText(label).length).toBeGreaterThan(0);
  }
});

it("searches the sample ledger by reference", async () => {
  render(<AfterPayment />);
  await userEvent.type(screen.getByLabelText("Search sample payments"), "A82E");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  await userEvent.clear(screen.getByLabelText("Search sample payments"));
  await userEvent.type(screen.getByLabelText("Search sample payments"), "zzz");
  expect(screen.getByText("No payments match.")).toBeInTheDocument();
});

it("derives the report tiles from the sample days", () => {
  render(<AfterPayment />);
  expect(screen.getByText("S$412.60")).toBeInTheDocument();
  expect(screen.getByText("S$58.94")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /bar chart/ })).toBeInTheDocument();
});

it("uses one small radius and no shadow", () => {
  const { container } = render(<AfterPayment />);
  expect(container.querySelector('[class*="shadow"]')).toBeNull();
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
  expect(container.querySelector('[class*="rounded-sm"]')).toBeNull();
});

it("keeps its status labels in step with the dashboard's badge", () => {
  for (const status of Object.keys(STATUS) as Status[]) {
    const { container, unmount } = render(
      <TransactionStatusBadge status={status} />,
    );
    expect(container.textContent).toContain(STATUS[status].label);
    unmount();
  }
});

it("uses the dashboard badge's tone for each status", () => {
  const tones: Record<Status, string> = {
    pending: "secondary",
    claimed: "mint",
    confirmed: "primary",
  };
  for (const status of Object.keys(STATUS) as Status[]) {
    const { container, unmount } = render(
      <TransactionStatusBadge status={status} />,
    );
    expect(container.innerHTML).toContain(`border-${tones[status]}/35`);
    expect(STATUS[status].className).toContain(`border-${tones[status]}/35`);
    unmount();
  }
});

it("counts payments from the chart's days", () => {
  render(<AfterPayment />);
  expect(screen.getByText("38")).toBeInTheDocument();
});
