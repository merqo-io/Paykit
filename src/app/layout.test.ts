import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces" }),
  Inter: () => ({ variable: "--font-inter" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono" }),
}));

const { metadata } = await import("./layout");

describe("root layout metadata", () => {
  it("sets the browser-tab title", () => {
    expect(metadata.title).toEqual({
      default: "paykit | Vendor payments",
      template: "%s | paykit",
    });
  });
});
