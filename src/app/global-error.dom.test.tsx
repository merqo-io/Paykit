// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import GlobalErrorPage from "./global-error";

it("offers a retry when the root layout fails", async () => {
  const reset = vi.fn();
  const user = userEvent.setup();
  render(<GlobalErrorPage reset={reset} />);

  expect(
    screen.getByRole("heading", { name: /something went wrong/i }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /try again/i }));
  expect(reset).toHaveBeenCalledTimes(1);
});

it("renders its own html and body so it can replace the root layout", () => {
  const markup = renderToStaticMarkup(<GlobalErrorPage reset={() => {}} />);
  expect(markup).toMatch(/^<html lang="en">(<head><\/head>)?<body[^>]*><main/);
});
