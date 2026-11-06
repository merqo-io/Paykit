import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import StatsRedirect from "./page";

describe("StatsRedirect", () => {
  it("sends the old stats URL to the Reports overview tab", () => {
    expect(() => StatsRedirect()).toThrow("NEXT_REDIRECT:/dashboard/reports");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/reports");
  });
});
