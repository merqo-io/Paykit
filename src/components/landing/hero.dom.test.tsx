// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Hero } from "./hero";

it("renders no decorative glow", () => {
  const { container } = render(<Hero />);
  expect(container.querySelector('[class*="blur-"]')).toBeNull();
  expect(container.querySelector('[style*="gradient"]')).toBeNull();
});
