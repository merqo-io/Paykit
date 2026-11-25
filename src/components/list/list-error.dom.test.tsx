// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListError } from "./list-error";

describe("ListError", () => {
  it("alerts with the default message and a retry link", () => {
    render(<ListError retryHref="/x?page=2" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load this list.",
    );
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/x?page=2",
    );
  });

  it("shows a page-specific message", () => {
    render(<ListError retryHref="/x" message="Couldn't load payments" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load payments",
    );
  });
});
