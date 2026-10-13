// The payment screenshot a calling kit may attach to a claim: its limits, and
// reading it out of a request. No database or storage access here.

export const PROOF_BUCKET = "paykit-payment-proofs";

/** Also enforced by the bucket's own `file_size_limit`. */
export const PROOF_MAX_BYTES = 1024 * 1024;

// Room for the multipart boundary and part headers around one file.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export type ProofMime = "image/jpeg" | "image/png" | "image/webp";

export type ProofFile = { bytes: Buffer; contentType: ProofMime };

export type ProofRead =
  | { ok: true; proof: ProofFile | null }
  | { ok: false; status: 400 | 413; error: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

/**
 * The image type a file's first bytes say it is, or null when they are not
 * JPEG, PNG or WebP. The type a caller declares is never trusted: a vendor
 * later opens this file from a link paykit signs.
 */
export function sniffImageType(bytes: Uint8Array): ProofMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8))
    return "image/webp";
  return null;
}

const TOO_LARGE: ProofRead = {
  ok: false,
  status: 413,
  error: "The proof file is too large (1 MB at most)",
};

function refuse(error: string): ProofRead {
  return { ok: false, status: 400, error };
}

/**
 * Reads the optional `proof` file from a claim request. A request that is
 * not `multipart/form-data` carries no proof (`proof: null`), which is the
 * claim every caller made before screenshots moved here. A multipart request
 * must carry exactly one `proof` file. Never throws.
 */
export async function readProofFromRequest(
  request: Request,
): Promise<ProofRead> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data"))
    return { ok: true, proof: null };

  const declared = Number(request.headers.get("content-length") ?? "");
  if (declared > PROOF_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) return TOO_LARGE;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse("Invalid multipart body");
  }

  const parts = form.getAll("proof");
  if (parts.length !== 1) return refuse("Send exactly one proof file");
  const part = parts[0];
  if (typeof part === "string") return refuse("proof must be a file");
  if (part.size === 0) return refuse("The proof file is empty");
  if (part.size > PROOF_MAX_BYTES) return TOO_LARGE;

  const bytes = Buffer.from(await part.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (!sniffed) return refuse("proof must be a JPEG, PNG or WebP image");
  return { ok: true, proof: { bytes, contentType: sniffed } };
}
