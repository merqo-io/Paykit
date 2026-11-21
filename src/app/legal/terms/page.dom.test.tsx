// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TermsPage from "./page";

describe("TermsPage", () => {
  it("renders the Terms of Service via LegalPage", () => {
    render(<TermsPage />);
    expect(screen.getByText("Who we are")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /kit/i })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
