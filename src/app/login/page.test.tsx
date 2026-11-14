import LoginPage from "./page";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  useSearchParamsMock,
  useRouterMock,
  signInWithOAuthMock,
  signInWithPasswordMock,
  signUpMock,
  resetPasswordForEmailMock,
} = vi.hoisted(() => ({
  useSearchParamsMock: vi.fn(),
  useRouterMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: signInWithOAuthMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  })),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

beforeEach(() => {
  useRouterMock.mockReset().mockReturnValue({
    push: vi.fn(),
    refresh: vi.fn(),
  });
  useSearchParamsMock.mockReset().mockReturnValue(new URLSearchParams());
  signInWithOAuthMock.mockReset().mockResolvedValue({ error: null });
  signInWithPasswordMock.mockReset().mockResolvedValue({ error: null });
  signUpMock
    .mockReset()
    .mockResolvedValue({ data: { session: {} }, error: null });
  resetPasswordForEmailMock.mockReset().mockResolvedValue({ error: null });
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("LoginPage", () => {
  it("shows an error message when the URL has ?error=oauth", async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("error=oauth"));

    render(<LoginPage />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Could not sign in with Google. Try again.",
    );
  });

  it("does not show an error message when there is no error param", async () => {
    render(<LoginPage />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("requests an English consent screen when signing in with Google", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: expect.objectContaining({ queryParams: { hl: "en" } }),
    });
  });

  it("shows a check-your-email state instead of redirecting when signUp returns no session", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const push = vi.fn();
    useRouterMock.mockReturnValue({ push, refresh: vi.fn() });

    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/new@example\.com/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to the dashboard when signUp returns a session", async () => {
    const push = vi.fn();
    const refresh = vi.fn();
    useRouterMock.mockReturnValue({ push, refresh });

    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it("shows Forgot password only in signin mode and sends a reset email", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /forgot password/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), "vendor@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() => {
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
        "vendor@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/dashboard/profile"),
        }),
      );
    });

    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );
    expect(
      screen.queryByRole("button", { name: /forgot password/i }),
    ).not.toBeInTheDocument();
  });

  it("asks for an email and sends no reset email when the email field is empty", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter your email first",
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("announces a reset link with a toast and keeps the form usable", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "vendor@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Password reset link sent to vendor@example.com",
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("signs in with the typed credentials and redirects to the dashboard", async () => {
    const push = vi.fn();
    const refresh = vi.fn();
    useRouterMock.mockReturnValue({ push, refresh });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "vendor@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Sign in" }),
    });

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "vendor@example.com",
      password: "password123",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("starts Google sign-in on touch and returns through /auth/callback", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: /continue with google/i }),
    });

    await waitFor(() =>
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: expect.objectContaining({
          redirectTo: expect.stringMatching(/\/auth\/callback$/),
        }),
      }),
    );
  });

  it("switches the heading with the mode toggle", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: /create an account/i }),
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeInTheDocument();
  });

  it("shows a plain sentence instead of the raw Supabase error on a wrong password", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: {
        message: "Invalid login credentials",
        code: "invalid_credentials",
      },
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "vendor@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Wrong email or password. Try again.",
      );
    });
  });

  it("shows a plain rate-limit sentence when resetPasswordForEmail fails", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: { message: "Too many requests" },
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "vendor@example.com");
    await user.click(screen.getByRole("button", { name: /forgot password/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Too many attempts. Wait a minute and try again.",
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("returns to the sign-in form from the check-your-email state via Back to sign in", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /back to sign in/i }));

    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /welcome back/i }),
    ).toBeInTheDocument();
  });
});

describe("check-your-email card", () => {
  async function reachCard(user: ReturnType<typeof userEvent.setup>) {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });
    await user.click(
      screen.getByRole("button", { name: /create an account/i }),
    );
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByText(/check your email/i);
  }

  it("drops the ?error=oauth line after the card is shown and dismissed", async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("error=oauth"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await reachCard(user);
    await user.click(screen.getByRole("button", { name: /back to sign in/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the typed address and keeps a 44px Back to sign in button", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await reachCard(user);

    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to sign in/i }),
    ).toHaveClass("h-11");
  });

  it("sends the confirmation link back through /auth/callback", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await reachCard(user);

    expect(signUpMock).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });
});

describe("auth transport recovery", () => {
  it.each(["signin", "signup", "reset", "oauth"])(
    "re-enables controls after %s network rejection",
    async (mode) => {
      const failure = new Error("offline");
      signInWithPasswordMock.mockRejectedValue(failure);
      signUpMock.mockRejectedValue(failure);
      resetPasswordForEmailMock.mockRejectedValue(failure);
      signInWithOAuthMock.mockRejectedValue(failure);
      const user = userEvent.setup();

      render(<LoginPage />);
      await user.type(screen.getByLabelText("Email"), "vendor@example.com");
      if (mode === "signup")
        await user.click(
          screen.getByRole("button", { name: "Create an account" }),
        );
      if (mode === "signin" || mode === "signup") {
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.click(
          screen.getByRole("button", {
            name: mode === "signin" ? "Sign in" : "Create account",
          }),
        );
      } else
        await user.click(
          screen.getByRole("button", {
            name:
              mode === "reset" ? "Forgot password?" : "Continue with Google",
          }),
        );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not connect",
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Continue with Google" }),
        ).toBeEnabled(),
      );
      expect(useRouterMock.mock.results[0].value.push).not.toHaveBeenCalled();
    },
  );
});

it("honors the landing page signup link", async () => {
  useSearchParamsMock.mockReturnValue(new URLSearchParams("mode=signup"));
  const { default: LoginPage } = await import("./page");
  render(<LoginPage />);
  expect(
    screen.getByRole("button", { name: /create account/i }),
  ).toBeInTheDocument();
});
