// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UrlPager } from "./url-pager";

const href = (p: number) => `/list?q=a&page=${p}`;

describe("UrlPager", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(
      <UrlPager page={1} pageCount={1} href={href} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("first page: Next is a link, Previous is not", () => {
    render(<UrlPager page={1} pageCount={3} href={href} label="Things" />);
    expect(screen.getByRole("navigation", { name: "Things" })).toBeVisible();
    expect(screen.getByText("Page 1 of 3")).toBeVisible();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/list?q=a&page=2",
    );
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
  });

  it("middle page links both ways, keeping filters", () => {
    render(<UrlPager page={2} pageCount={3} href={href} />);
    const prev = screen.getByRole("link", { name: "Previous" });
    expect(prev).toHaveAttribute("href", "/list?q=a&page=1");
    expect(prev).toHaveAttribute("rel", "prev");
    const next = screen.getByRole("link", { name: "Next" });
    expect(next).toHaveAttribute("href", "/list?q=a&page=3");
    expect(next).toHaveAttribute("rel", "next");
  });

  it("last page: Previous is a link, Next is not", () => {
    render(<UrlPager page={3} pageCount={3} href={href} />);
    expect(screen.getByRole("link", { name: "Previous" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByText("Next")).toBeVisible();
  });
});
