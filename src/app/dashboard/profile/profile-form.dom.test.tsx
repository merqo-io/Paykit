// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileForm } from "./profile-form";

const {
  updateStallNameMock,
  updateSocialLinksMock,
  updateUserMock,
  refreshMock,
  removeReplacedAvatarMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  updateStallNameMock: vi.fn(),
  updateSocialLinksMock: vi.fn(),
  updateUserMock: vi.fn(),
  refreshMock: vi.fn(),
  removeReplacedAvatarMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: vi.fn() },
}));

vi.mock("./actions", () => ({
  updateStallName: updateStallNameMock,
  updateSocialLinks: updateSocialLinksMock,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: updateUserMock } }),
}));
vi.mock("@/lib/image-upload-adapter", () => ({
  uploadPaykitImage: vi.fn(),
  removeReplacedAvatar: removeReplacedAvatarMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock("@merqo/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@merqo/ui")>();
  return {
    ...actual,
    // Stands in for a finished upload (or a Remove click) by calling
    // onChange directly, which is all the avatar save handler sees.
    ImageUploader: ({
      onChange,
    }: {
      onChange: (url: string | null) => void;
    }) => (
      <div data-testid="image-uploader">
        <button type="button" onClick={() => onChange(NEW_AVATAR)}>
          finish upload
        </button>
        <button type="button" onClick={() => onChange(null)}>
          remove icon
        </button>
      </div>
    ),
  };
});

const PUBLIC = "https://abc.supabase.co/storage/v1/object/public";
const OLD_AVATAR = `${PUBLIC}/vendor-images/v1/old.webp`;
const NEW_AVATAR = `${PUBLIC}/vendor-images/v1/new.webp`;

const DEFAULT_PROPS = {
  vendorId: "v1",
  stallName: "Kopitiam Cart",
  displayName: "Aisha",
  email: "aisha@example.com",
  avatarUrl: null,
  socialLinks: {},
};

function renderForm(props = {}) {
  return render(
    <TooltipProvider>
      <ProfileForm {...DEFAULT_PROPS} {...props} />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  updateStallNameMock.mockReset().mockResolvedValue({ success: true });
  updateSocialLinksMock.mockReset().mockResolvedValue({ success: true });
  updateUserMock.mockReset().mockResolvedValue({ error: null });
  refreshMock.mockReset();
  removeReplacedAvatarMock.mockReset().mockResolvedValue(undefined);
  toastSuccessMock.mockReset();
});

describe("ProfileForm", () => {
  it("renders the profile-icon upload widget", () => {
    renderForm();
    expect(screen.getByTestId("image-uploader")).toBeInTheDocument();
  });

  it("groups fields under Business and Account headings", () => {
    renderForm();
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("toasts a saved business name without a trailing period", async () => {
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByLabelText("Business name");
    await user.clear(input);
    await user.type(input, "New Cart Name");
    await user.click(
      screen.getByRole("button", { name: /save business name/i }),
    );
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("Business name saved"),
    );
  });

  it("saves a changed business name", async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText("Business name");
    await user.clear(input);
    await user.type(input, "New Cart Name");
    await user.click(
      screen.getByRole("button", { name: /save business name/i }),
    );

    await waitFor(() => {
      expect(updateStallNameMock).toHaveBeenCalledWith({
        name: "New Cart Name",
      });
    });
  });

  it("blocks saving the business name when cleared to empty", async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText("Business name");
    await user.clear(input);
    await user.click(
      screen.getByRole("button", { name: /save business name/i }),
    );

    expect(updateStallNameMock).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a business name")).toBeInTheDocument();
  });

  it("updates the display name via the browser auth client, not a server action", async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText("Display name");
    await user.clear(input);
    await user.type(input, "Bee");
    await user.click(
      screen.getByRole("button", { name: /save display name/i }),
    );

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        data: { display_name: "Bee" },
      });
    });
  });

  it("rejects a mismatched password confirmation without calling the auth client", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "password456",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(updateUserMock).not.toHaveBeenCalled();
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
  });

  it("saves social links through the server action", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByLabelText(/website/i),
      "https://kopitiam.example",
    );
    await user.click(screen.getByRole("button", { name: /save links/i }));

    await waitFor(() => {
      expect(updateSocialLinksMock).toHaveBeenCalledWith(
        expect.objectContaining({ website: "https://kopitiam.example" }),
      );
    });
  });
});

// Every upload gets a fresh random object name, so without these deletes each
// avatar change left the previous image behind in storage forever.
describe("ProfileForm avatar storage cleanup", () => {
  it("deletes the previous avatar once the new one is saved", async () => {
    const user = userEvent.setup();
    renderForm({ avatarUrl: OLD_AVATAR });
    await user.click(screen.getByRole("button", { name: "finish upload" }));
    await waitFor(() =>
      expect(removeReplacedAvatarMock).toHaveBeenCalledWith(OLD_AVATAR),
    );
    expect(removeReplacedAvatarMock).not.toHaveBeenCalledWith(NEW_AVATAR);
  });

  it("deletes the avatar when the vendor removes it", async () => {
    const user = userEvent.setup();
    renderForm({ avatarUrl: OLD_AVATAR });
    await user.click(screen.getByRole("button", { name: "remove icon" }));
    await waitFor(() =>
      expect(removeReplacedAvatarMock).toHaveBeenCalledWith(OLD_AVATAR),
    );
  });

  it("keeps the previous avatar and deletes the orphaned upload when the save fails", async () => {
    updateUserMock.mockResolvedValueOnce({ error: { message: "nope" } });
    const user = userEvent.setup();
    renderForm({ avatarUrl: OLD_AVATAR });
    await user.click(screen.getByRole("button", { name: "finish upload" }));
    await waitFor(() =>
      expect(removeReplacedAvatarMock).toHaveBeenCalledWith(NEW_AVATAR),
    );
    expect(removeReplacedAvatarMock).not.toHaveBeenCalledWith(OLD_AVATAR);
  });

  it("deletes nothing on a first upload, when there was no previous avatar", async () => {
    const user = userEvent.setup();
    renderForm({ avatarUrl: null });
    await user.click(screen.getByRole("button", { name: "finish upload" }));
    await waitFor(() => expect(updateUserMock).toHaveBeenCalled());
    expect(removeReplacedAvatarMock).not.toHaveBeenCalled();
  });
});
