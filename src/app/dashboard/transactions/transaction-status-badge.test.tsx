import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { TransactionStatusBadge } from "./transaction-status-badge";

describe("TransactionStatusBadge", () => {
  it("gives claimed the mint accent, not confirmed/pending's tone", () => {
    const claimed = renderToStaticMarkup(
      createElement(TransactionStatusBadge, { status: "claimed" }),
    );
    expect(claimed).toContain("text-mint");
    expect(claimed).toContain("Marked paid");

    const confirmed = renderToStaticMarkup(
      createElement(TransactionStatusBadge, { status: "confirmed" }),
    );
    expect(confirmed).not.toContain("text-mint");
    expect(confirmed).toContain("Received");

    const pending = renderToStaticMarkup(
      createElement(TransactionStatusBadge, { status: "pending" }),
    );
    expect(pending).not.toContain("text-mint");
    expect(pending).toContain("Awaiting payment");
  });
});
