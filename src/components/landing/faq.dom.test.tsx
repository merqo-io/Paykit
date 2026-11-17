// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Faq } from "./faq";

it("surfaces use the kit rounded-lg radius", () => {
  const { container } = render(<Faq />);
  expect(container.querySelector(".rounded-lg")).not.toBeNull();
  expect(container.querySelector('[class*="rounded-2"]')).toBeNull();
});
