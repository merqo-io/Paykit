// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AppLinks } from "./app-link-provider";

describe("AppLinks", () => {
  it("renders its children", () => {
    render(
      <AppLinks>
        <span>inside</span>
      </AppLinks>,
    );
    expect(screen.getByText("inside")).toBeInTheDocument();
  });
});
