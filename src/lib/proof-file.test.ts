import { describe, it, expect } from "vitest";
import {
  PROOF_MAX_BYTES,
  readProofFile,
  readProofFromRequest,
  sniffImageType,
} from "./proof-file";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const WEBP = [..."RIFF"]
  .map((c) => c.charCodeAt(0))
  .concat(
    [0x24, 0x00, 0x00, 0x00],
    [..."WEBPVP8 "].map((c) => c.charCodeAt(0)),
  );
const GIF = [..."GIF89a"].map((c) => c.charCodeAt(0));

function file(bytes: number[], type: string, name = "proof") {
  return new File([new Uint8Array(bytes)], name, { type });
}

function multipart(build: (form: FormData) => void, headers = {}) {
  const form = new FormData();
  build(form);
  return new Request("http://localhost/claim", {
    method: "POST",
    body: form,
    headers,
  });
}

describe("sniffImageType", () => {
  it.each([
    ["a JPEG", JPEG, "image/jpeg"],
    ["a PNG", PNG, "image/png"],
    ["a WebP", WEBP, "image/webp"],
    ["a GIF", GIF, null],
    ["nothing", [], null],
    ["a cut-off PNG header", PNG.slice(0, 4), null],
    [
      "RIFF that is not WebP",
      [...WEBP.slice(0, 8), 0x57, 0x41, 0x56, 0x45],
      null,
    ],
  ])("reads %s", (_name, bytes, expected) => {
    expect(sniffImageType(new Uint8Array(bytes))).toBe(expected);
  });
});

describe("readProofFromRequest", () => {
  it("reports no proof for a request with no body", async () => {
    const result = await readProofFromRequest(
      new Request("http://localhost/claim", { method: "POST" }),
    );
    expect(result).toEqual({ ok: true, proof: null });
  });

  it("reports no proof for a JSON body", async () => {
    const result = await readProofFromRequest(
      new Request("http://localhost/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(result).toEqual({ ok: true, proof: null });
  });

  it("reads one valid file", async () => {
    const result = await readProofFromRequest(
      multipart((form) => form.append("proof", file(PNG, "image/png"))),
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !result.proof) throw new Error("expected a proof");
    expect(result.proof.contentType).toBe("image/png");
    expect(Array.from(result.proof.bytes)).toEqual(PNG);
  });

  it("goes by the bytes when the declared type disagrees", async () => {
    const result = await readProofFromRequest(
      multipart((form) => form.append("proof", file(PNG, "image/jpeg"))),
    );
    expect(result.ok && result.proof?.contentType).toBe("image/png");
  });

  it.each([
    ["no proof field", (form: FormData) => form.append("other", "x")],
    [
      "two proof files",
      (form: FormData) => {
        form.append("proof", file(PNG, "image/png"));
        form.append("proof", file(JPEG, "image/jpeg"));
      },
    ],
    ["a text proof field", (form: FormData) => form.append("proof", "hello")],
    [
      "an empty file",
      (form: FormData) => form.append("proof", file([], "image/png")),
    ],
    [
      "bytes that are not an image",
      (form: FormData) => form.append("proof", file(GIF, "image/png")),
    ],
  ])("refuses %s with 400", async (_name, build) => {
    const result = await readProofFromRequest(multipart(build));
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses a file over the limit with 413", async () => {
    const big = new Array(PROOF_MAX_BYTES + 1).fill(0);
    big.splice(0, PNG.length, ...PNG);
    const result = await readProofFromRequest(
      multipart((form) => form.append("proof", file(big, "image/png"))),
    );
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("accepts a file of exactly the limit", async () => {
    const full = new Array(PROOF_MAX_BYTES).fill(0);
    full.splice(0, PNG.length, ...PNG);
    const result = await readProofFromRequest(
      multipart((form) => form.append("proof", file(full, "image/png"))),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a declared length over the limit before reading the body", async () => {
    const request = new Request("http://localhost/claim", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
        "content-length": String(PROOF_MAX_BYTES * 3),
      },
      body: "not multipart at all",
    });
    const result = await readProofFromRequest(request);
    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(request.bodyUsed).toBe(false);
  });

  it("refuses a body that does not parse as multipart", async () => {
    const result = await readProofFromRequest(
      new Request("http://localhost/claim", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: "not multipart at all",
      }),
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});

describe("readProofFile", () => {
  it("reads a valid file and reports the type its bytes show", async () => {
    const read = await readProofFile(file(PNG, "image/jpeg"));
    expect(read).toMatchObject({
      ok: true,
      proof: { contentType: "image/png" },
    });
  });

  it.each([
    ["text", "proof"],
    ["nothing", null],
    ["undefined", undefined],
    ["a plain object", { size: 10 }],
  ])("refuses %s as not a file", async (_name, value) => {
    expect(await readProofFile(value)).toEqual({
      ok: false,
      status: 400,
      error: "proof must be a file",
    });
  });

  it("refuses an empty file", async () => {
    expect(await readProofFile(file([], "image/png"))).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("refuses a file over the limit with 413", async () => {
    const big = new File([new Uint8Array(PROOF_MAX_BYTES + 1)], "proof");
    expect(await readProofFile(big)).toMatchObject({ ok: false, status: 413 });
  });

  it("refuses bytes that are not an accepted image", async () => {
    expect(await readProofFile(file(GIF, "image/png"))).toEqual({
      ok: false,
      status: 400,
      error: "proof must be a JPEG, PNG or WebP image",
    });
  });

  it("refuses a file whose bytes cannot be read", async () => {
    const broken = file(JPEG, "image/jpeg");
    broken.arrayBuffer = () => Promise.reject(new Error("gone"));
    expect(await readProofFile(broken)).toEqual({
      ok: false,
      status: 400,
      error: "The proof file could not be read",
    });
  });
});
