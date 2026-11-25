// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  params: { current: new URLSearchParams() },
  push: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
  useSearchParams: () => mocks.params.current,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signInWithOAuth: mocks.signInWithOAuth,
      resetPasswordForEmail: vi.fn(),
    },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@merqo/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@merqo/ui")>()),
  navigatingAway: () => Promise.resolve(),
}));

import LoginPage from "./page";

const NEXT = "/dashboard/config?return_to=https%3A%2F%2Fqkit.merqo.io%2Fx";
const ORIGIN = window.location.origin;

function setParams(params: Record<string, string>) {
  mocks.params.current = new URLSearchParams(params);
}

async function fillAndSubmit(button: RegExp | string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "v@business.sg");
  await user.type(screen.getByLabelText("Password"), "Str0ng-Passw0rd!");
  await user.click(screen.getByRole("button", { name: button }));
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.signUp
    .mockReset()
    .mockResolvedValue({ data: { session: {} }, error: null });
  mocks.signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  setParams({});
});

describe("LoginPage next handling", () => {
  it("pushes a valid next after password sign-in", async () => {
    setParams({ next: NEXT });
    render(<LoginPage />);
    await fillAndSubmit("Sign in");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(NEXT));
  });

  it("pushes a valid next after signup and carries it in emailRedirectTo", async () => {
    setParams({ next: NEXT, mode: "signup" });
    render(<LoginPage />);
    await fillAndSubmit(/create account|sign up/i);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(NEXT));
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${ORIGIN}/auth/callback?next=${encodeURIComponent(NEXT)}`,
    );
  });

  it("carries a valid next in the Google redirectTo", async () => {
    setParams({ next: NEXT });
    render(<LoginPage />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalled());
    expect(mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(
      `${ORIGIN}/auth/callback?next=${encodeURIComponent(NEXT)}`,
    );
  });

  it("falls back to /dashboard with no next in the callback URL when next is absent", async () => {
    render(<LoginPage />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalled());
    expect(mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(
      `${ORIGIN}/auth/callback`,
    );
  });

  it.each([
    "/\t/evil.com",
    "/\n/evil.com",
    "/%2F%2Fevil.com",
    "/\\evil.com",
    "/%5Cevil.com",
    "//evil.com",
    "https://evil.com",
  ])("falls back to /dashboard for hostile next %j", async (hostile) => {
    setParams({ next: hostile });
    render(<LoginPage />);
    await fillAndSubmit("Sign in");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalled());
    expect(mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(
      `${ORIGIN}/auth/callback`,
    );
  });
});
