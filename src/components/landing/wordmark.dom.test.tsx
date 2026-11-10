// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Wordmark } from "./wordmark";

it("renders Pay with the mint accent followed by Kit", () => {
  const { container } = render(<Wordmark />);
  const mark = container.firstElementChild as HTMLElement;
  expect(mark).toHaveTextContent("PayKit");
  const accent = mark.querySelector("span");
  expect(accent).toHaveTextContent("Pay");
  expect(accent).toHaveClass("text-mint");
  expect(mark).toHaveClass("font-display", "font-semibold", "tracking-tight");
});

it("lets a caller size class win over the shared default size", () => {
  const { container } = render(<Wordmark className="text-3xl" />);
  const mark = container.firstElementChild as HTMLElement;
  expect(mark).toHaveClass("text-3xl");
  expect(mark).not.toHaveClass("text-xl");
});
