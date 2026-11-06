// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingStatusBadge } from "./booking-badges";
import type { BookingStatus } from "@/lib/types";

describe("BookingStatusBadge", () => {
  it.each<[BookingStatus, string]>([
    ["pending_deposit", "Awaiting deposit"],
    ["deposit_paid", "Deposit paid"],
    ["fully_paid", "Fully paid"],
    ["cancelled", "Cancelled"],
  ])("labels %s in sentence case", (status, label) => {
    render(<BookingStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
