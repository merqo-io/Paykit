// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ResetPasswordForm } from "./reset-password-form";
import { PASSWORD_REQUIREMENTS_HINT } from "../login/weak-password";

const {
  getUserMock,
  updateUserMock,
  pushMock,
  refreshMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: getUserMock, updateUser: updateUserMock },
  }),
}));

const GOOD = "Str0ng!Passw0rd";

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirm: string,
) {
  await user.type(await screen.findByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    updateUserMock.mockResolvedValue({ error: null });
  });

  it("checks the session, then shows the form", async () => {
    render(<ResetPasswordForm />);
    expect(screen.getByText(/checking your reset link/i)).toBeInTheDocument();
    const field = await screen.findByLabelText("New password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(
      screen.getByRole("button", { name: "Update password" }),
    ).toBeDisabled();
  });

  it("shows the expired state with a link back to sign in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    render(<ResetPasswordForm />);
    expect(await screen.findByText("This link has expired")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to sign in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("shows a retry when the session lookup fails, then recovers", async () => {
    const user = userEvent.setup();
    getUserMock.mockRejectedValueOnce(new Error("offline"));
    render(<ResetPasswordForm />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not check your reset link. Try again.",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    expect(getUserMock).toHaveBeenCalledTimes(2);
  });

  it("treats a returned lookup error as a failure", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "boom" },
    });
    render(<ResetPasswordForm />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not check your reset link.",
    );
  });

  it("blocks a mismatch without calling updateUser", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await fillAndSubmit(user, GOOD, `${GOOD}x`);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match",
    );
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("blocks a too-short password without calling updateUser", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await fillAndSubmit(user, "abc", "abc");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 8 characters",
    );
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("updates the password, toasts and goes to the dashboard", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await fillAndSubmit(user, GOOD, GOOD);
    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ password: GOOD });
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Password updated");
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
    expect(refreshMock).toHaveBeenCalled();
  });

  it.each([
    [
      ["length"],
      "Password should be at least 12 characters.",
      "Password is too short. Use at least 12 characters.",
    ],
    [
      ["characters"],
      "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789",
      "Password must include a lowercase letter, an uppercase letter and a number.",
    ],
    [
      ["pwned"],
      "Password is known to be weak and easy to guess",
      "This password has appeared in a data breach. Choose a different one.",
    ],
  ])(
    "shows the mapped sentence inline for weak_password %j",
    async (reasons, rawMessage, expected) => {
      const user = userEvent.setup();
      updateUserMock.mockResolvedValue({
        error: { code: "weak_password", reasons, message: rawMessage },
      });
      render(<ResetPasswordForm />);
      await fillAndSubmit(user, GOOD, GOOD);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(expected);
      expect(screen.queryByText(rawMessage)).not.toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
    },
  );

  it("shows the generic copy for other update errors", async () => {
    const user = userEvent.setup();
    updateUserMock.mockResolvedValue({
      error: { message: "db exploded", code: "unexpected_failure" },
    });
    render(<ResetPasswordForm />);
    await fillAndSubmit(user, GOOD, GOOD);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update your password. Try again.",
    );
    expect(screen.queryByText(/db exploded/)).not.toBeInTheDocument();
  });

  it("shows connection copy when the update call throws", async () => {
    const user = userEvent.setup();
    updateUserMock.mockRejectedValue(new Error("network"));
    render(<ResetPasswordForm />);
    await fillAndSubmit(user, GOOD, GOOD);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not connect. Try again.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("reveals the requirements hint on tap", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await screen.findByLabelText("New password");
    await user.click(
      screen.getByRole("button", { name: "Password requirements" }),
    );
    expect(await screen.findByText(PASSWORD_REQUIREMENTS_HINT)).toBeVisible();
  });
});
