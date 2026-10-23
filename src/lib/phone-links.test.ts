import { describe, it, expect } from "vitest";
import { whatsappLink } from "./phone-links";

describe("whatsappLink", () => {
  it("adds 65 to a bare 8-digit Singapore number", () => {
    expect(whatsappLink("9123 4567")).toBe("https://wa.me/6591234567");
  });

  it("keeps a number that already has a country code", () => {
    expect(whatsappLink("+65 9123-4567")).toBe("https://wa.me/6591234567");
    expect(whatsappLink("+60 12 345 6789")).toBe("https://wa.me/60123456789");
  });
});
