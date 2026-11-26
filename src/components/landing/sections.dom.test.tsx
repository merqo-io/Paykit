// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingClosing, LandingFaq } from "./sections";

it("shows exactly three FAQ rows and links to the full FAQ", () => {
  const { container } = render(<LandingFaq />);
  expect(container.querySelectorAll("details")).toHaveLength(3);
  expect(
    screen.getByRole("link", { name: "More questions and answers" }),
  ).toHaveAttribute("href", "/faq");
  expect(screen.queryByText("What will it cost?")).toBeNull();
});

it("opens a FAQ row by its summary", async () => {
  render(<LandingFaq />);
  const row = screen
    .getByText("Does paykit hold my money?")
    .closest("details") as HTMLDetailsElement;
  expect(row.open).toBe(false);
  await userEvent.click(screen.getByText("Does paykit hold my money?"));
  expect(row.open).toBe(true);
});

it("closes with the pilot pricing line, the funds statement and one waitlist CTA", () => {
  const { container } = render(<LandingClosing />);
  expect(container.textContent).toContain("Free during the pilot");
  expect(screen.getByText(/never holds funds/)).toBeInTheDocument();
  expect(
    screen.getAllByRole("link", { name: "Join the waitlist" }),
  ).toHaveLength(1);
});
