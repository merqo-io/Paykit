// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardError from "./error";

describe("DashboardError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("shows the branded error message and logs the caught error", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<DashboardError error={error} reset={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/could not load this page/i)).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Dashboard error boundary caught",
      error,
    );
  });

  it("calls reset() when Try again is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<DashboardError error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("links back to the dashboard", () => {
    render(<DashboardError error={new Error("boom")} reset={vi.fn()} />);

    expect(
      screen.getByRole("link", { name: /back to dashboard/i }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
