import { storagePathFromPublicUrl } from "@merqo/ui";

// paykit's config form uploads a pointer config's QR image to `vendor-images`.
// `booth-images` is listed for images a vendor uploaded through qkit's booth
// form, which wrote there and saved the address through the kit API. Such an
// image stays where it is until the vendor replaces it, and this is what
// deletes it then.
const QR_IMAGE_BUCKETS = ["vendor-images", "booth-images"] as const;

type StorageRemover = {
  storage: {
    from(bucket: string): {
      remove(
        paths: string[],
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

/**
 * The storage object a config save stopped referencing, or null when there is
 * nothing to delete: no previous image, the same image kept, a URL outside our
 * buckets (a vendor may paste any image URL), or an object outside this
 * vendor's own folder. The folder check matters because the kit API route
 * deletes with the service-role client, which no storage policy constrains.
 */
export function replacedQrImage(
  vendorId: string,
  before: string | null | undefined,
  after: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!before || before === after) return null;
  for (const bucket of QR_IMAGE_BUCKETS) {
    const path = storagePathFromPublicUrl(before, bucket);
    if (!path) continue;
    return path.split("/")[0] === vendorId ? { bucket, path } : null;
  }
  return null;
}

/**
 * Best-effort delete of the QR image a successful config save replaced or
 * cleared. `ImageUploader` names every upload randomly, so without this each
 * QR change left the previous image in storage forever. Never throws: the
 * config is already saved, and a leftover object is only wasted storage.
 */
export async function removeReplacedQrImage(
  supabase: StorageRemover,
  vendorId: string,
  before: string | null | undefined,
  after: string | null | undefined,
): Promise<void> {
  const target = replacedQrImage(vendorId, before, after);
  if (!target) return;
  try {
    const { error } = await supabase.storage
      .from(target.bucket)
      .remove([target.path]);
    if (error) console.error("QR image cleanup failed", error.message);
  } catch (error) {
    console.error("QR image cleanup failed", error);
  }
}
