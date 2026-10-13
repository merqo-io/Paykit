// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  saveConfigActionMock,
  commitPendingImagesMock,
  removeUnsavedImagesMock,
} = vi.hoisted(() => ({
  saveConfigActionMock: vi.fn(),
  commitPendingImagesMock: vi.fn(),
  removeUnsavedImagesMock: vi.fn(),
}));

vi.mock("./actions", () => ({ saveConfigAction: saveConfigActionMock }));
vi.mock("@/lib/image-upload-adapter", () => ({
  uploadPaykitImage: vi.fn(),
  removeUnsavedImages: removeUnsavedImagesMock,
}));
vi.mock("@merqo/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@merqo/ui")>();
  return {
    ...actual,
    commitPendingImages: commitPendingImagesMock,
    isPendingImage: (url: unknown) => url === PREVIEW,
    // Stands in for picking a QR in deferred mode: onChange receives the
    // local preview URL, and nothing is uploaded.
    ImageUploader: ({
      onChange,
      bucket,
    }: {
      onChange: (url: string) => void;
      bucket: string;
    }) => (
      <button
        type="button"
        data-bucket={bucket}
        onClick={() => onChange(PREVIEW)}
      >
        pick qr
      </button>
    ),
  };
});

import { PendingImageUploadError } from "@merqo/ui";
import { PaymentConfigForm } from "./payment-config-form";

const PREVIEW = "blob:http://localhost/qr";
const UPLOADED =
  "https://abc.supabase.co/storage/v1/object/public/vendor-images/v1/qr.webp";

beforeEach(() => {
  vi.clearAllMocks();
  saveConfigActionMock.mockResolvedValue({ status: "ok" });
  commitPendingImagesMock.mockResolvedValue({
    urls: [UPLOADED],
    uploaded: [UPLOADED],
  });
});

async function pickQrAndSave() {
  const user = userEvent.setup();
  render(<PaymentConfigForm initial={null} vendorId="v1" />);
  await user.click(
    screen.getByRole("radio", { name: /payment link or qr image/i }),
  );
  await user.click(screen.getByRole("radio", { name: "PayLah! QR" }));
  await user.click(screen.getByRole("button", { name: "pick qr" }));
  await user.click(
    screen.getByRole("button", { name: /save payment config/i }),
  );
}

// The QR uploader defers its upload, so the only moment an image reaches
// storage is here, on Save.
describe("PaymentConfigForm deferred QR upload", () => {
  it("uploads the picked QR on save and submits its public URL", async () => {
    await pickQrAndSave();
    await waitFor(() => expect(saveConfigActionMock).toHaveBeenCalled());
    expect(commitPendingImagesMock).toHaveBeenCalledWith([PREVIEW]);
    const formData = saveConfigActionMock.mock.calls[0]?.[1] as FormData;
    expect(formData.get("qr_image_url")).toBe(UPLOADED);
    expect(removeUnsavedImagesMock).not.toHaveBeenCalled();
  });

  it("deletes the fresh upload when the save fails", async () => {
    saveConfigActionMock.mockResolvedValue({
      status: "error",
      message: "Could not save. Try again.",
    });
    await pickQrAndSave();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not save. Try again.",
      ),
    );
    expect(removeUnsavedImagesMock).toHaveBeenCalledWith([UPLOADED]);
  });

  it("stops the save and deletes what did upload when the upload fails", async () => {
    commitPendingImagesMock.mockRejectedValue(
      new PendingImageUploadError([UPLOADED], new Error("denied")),
    );
    await pickQrAndSave();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not upload the QR image. Try again.",
      ),
    );
    expect(saveConfigActionMock).not.toHaveBeenCalled();
    expect(removeUnsavedImagesMock).toHaveBeenCalledWith([UPLOADED]);
  });

  it("uploads the QR to the bucket paykit's own pages use, not a calling kit's", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);
    await user.click(
      screen.getByRole("radio", { name: /payment link or qr image/i }),
    );
    await user.click(screen.getByRole("radio", { name: "PayLah! QR" }));

    expect(screen.getByRole("button", { name: "pick qr" })).toHaveAttribute(
      "data-bucket",
      "vendor-images",
    );
  });

  it("uploads nothing when no QR is pending", async () => {
    const user = userEvent.setup();
    render(<PaymentConfigForm initial={null} vendorId="v1" />);
    await user.click(
      screen.getByRole("button", { name: /save payment config/i }),
    );
    await waitFor(() => expect(saveConfigActionMock).toHaveBeenCalled());
    expect(commitPendingImagesMock).not.toHaveBeenCalled();
  });
});
