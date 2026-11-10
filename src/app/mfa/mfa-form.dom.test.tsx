// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      mfa: {
        enroll: mocks.enroll,
        challengeAndVerify: mocks.challengeAndVerify,
        unenroll: mocks.unenroll,
      },
    },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
import { MfaForm } from "./mfa-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.replace.mockReset();
  mocks.challengeAndVerify.mockResolvedValue({ error: null });
  mocks.enroll.mockResolvedValue({
    data: {
      id: "new-factor",
      totp: { qr_code: "data:image/svg+xml;utf8,<svg/>", secret: "JBSWY3DP" },
    },
    error: null,
  });
  mocks.unenroll.mockResolvedValue({ error: null });
});

it("verifies an enrolled factor and enters the console", async () => {
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
    factorId: "f1",
    code: "123456",
  });
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin"));
});

it("shows a wrong-code error and stays on the page", async () => {
  mocks.challengeAndVerify.mockResolvedValue({ error: { message: "bad" } });
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "000000");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "That code did not work",
  );
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("enrols a new factor, shows its QR and secret, then verifies it", async () => {
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId={null} staleFactorIds={["old"]} />);
  await user.click(
    screen.getByRole("button", { name: "Set up authenticator" }),
  );
  expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "old" });
  expect(await screen.findByText("JBSWY3DP")).toBeInTheDocument();
  expect(screen.getByAltText("Authenticator QR code")).toBeInTheDocument();
  await user.type(screen.getByLabelText("6-digit code"), "654321");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
    factorId: "new-factor",
    code: "654321",
  });
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/admin"));
});

it("rejects a non-numeric code before calling Supabase", async () => {
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "12ab");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(mocks.challengeAndVerify).not.toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Enter the 6-digit code from your authenticator app.",
  );
});

it("shows the setup error when enrolment fails", async () => {
  mocks.enroll.mockResolvedValue({ data: null, error: { message: "no" } });
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId={null} staleFactorIds={[]} />);
  await user.click(
    screen.getByRole("button", { name: "Set up authenticator" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not start setup. Try again.",
  );
  expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
});

it("shows the setup error when enrolment throws", async () => {
  mocks.enroll.mockRejectedValue(new Error("network down"));
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId={null} staleFactorIds={[]} />);
  await user.click(
    screen.getByRole("button", { name: "Set up authenticator" }),
  );
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Could not start setup. Try again.");
  expect(alert).not.toHaveTextContent("network down");
});

it("keeps the wrong-code copy for a rate-limit style verify error", async () => {
  mocks.challengeAndVerify.mockResolvedValue({
    error: { code: "unlisted_code", message: "Too many requests, slow down" },
  });
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "111111");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "That code did not work. Check the time on your phone and try again.",
  );
});

it("verifies a pasted code containing a space", async () => {
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.click(screen.getByLabelText("6-digit code"));
  await user.paste("123 456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
    factorId: "f1",
    code: "123456",
  });
});

it("shows the wrong-code copy when verify throws", async () => {
  mocks.challengeAndVerify.mockRejectedValue(new Error("offline"));
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "That code did not work",
  );
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("maps an unknown raw error to the wrong-code copy", async () => {
  mocks.replace.mockImplementation(() => {
    throw new Error("raw router failure");
  });
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("That code did not work");
  expect(alert).not.toHaveTextContent("raw router failure");
});

it("stays pending after a successful verify until the route changes", async () => {
  const user = userEvent.setup();
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  await user.type(screen.getByLabelText("6-digit code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  const button = screen.getByRole("button", { name: "Verifying" });
  expect(button).toBeDisabled();
  expect(screen.getByLabelText("6-digit code")).toBeDisabled();
  expect(mocks.challengeAndVerify).toHaveBeenCalledTimes(1);
});

it("keeps one-time-code autofill and the numeric keypad on the input", () => {
  render(<MfaForm verifiedFactorId="f1" staleFactorIds={[]} />);
  const input = screen.getByLabelText("6-digit code");
  expect(input).toHaveAttribute("autocomplete", "one-time-code");
  expect(input).toHaveAttribute("inputmode", "numeric");
});
