// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingFilters } from "./booking-filters";

describe("BookingFilters search", () => {
  it("is named by its visible label and submits as q", () => {
    render(<BookingFilters params={{ q: "Jane", status: null, page: 1 }} />);
    const field = screen.getByLabelText("Search");
    expect(field).toHaveValue("Jane");
    expect(field).toHaveAttribute("name", "q");
  });

  it("clears with a tap on the clear button and returns focus to the field", async () => {
    const user = userEvent.setup();
    render(<BookingFilters params={{ q: "Jane", status: null, page: 1 }} />);
    const field = screen.getByLabelText("Search");
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Clear search" }),
    });
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
  });
});
