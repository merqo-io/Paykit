// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("renders the Privacy Policy via LegalPage", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText("Our roles: controller and data intermediary"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /kit/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
