// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ value: "/admin/vendors" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { AdminNav } from "./admin-nav";

describe("AdminNav", () => {
  it("marks only the active section with aria-current", () => {
    render(<AdminNav />);
    expect(
      screen.getByRole("navigation", { name: "Admin sections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vendors" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
