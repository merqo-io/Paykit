import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const {
  createWorkerMock,
  recognizeMock,
  terminateMock,
  setParametersMock,
  sharpMock,
  resizeMock,
  linearMock,
  metadataMock,
} = vi.hoisted(() => ({
  createWorkerMock: vi.fn(),
  recognizeMock: vi.fn(),
  terminateMock: vi.fn(),
  setParametersMock: vi.fn(),
  sharpMock: vi.fn(),
  resizeMock: vi.fn(),
  linearMock: vi.fn(),
  metadataMock: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
  createWorker: createWorkerMock,
  PSM: { SPARSE_TEXT: "11" },
}));
vi.mock("sharp", () => ({ default: sharpMock }));
vi.mock("bmp-js", () => ({}));
vi.mock("zlibjs", () => ({}));
vi.mock("wasm-feature-detect", () => ({}));
vi.mock("tesseract.js-core/package.json", () => ({ default: {} }));

import { recognizeText } from "./proof-ocr";

const IMAGE = Buffer.from("image bytes");
const CONTRASTED = Buffer.from("enhanced bytes");
const SHARP_OPTIONS = { limitInputPixels: 25_000_000, failOn: "error" };

beforeEach(() => {
  recognizeMock.mockReset().mockResolvedValue({ data: { text: "SGD 12.50" } });
  terminateMock.mockReset().mockResolvedValue(undefined);
  setParametersMock.mockReset().mockResolvedValue(undefined);
  createWorkerMock.mockReset().mockResolvedValue({
    recognize: recognizeMock,
    terminate: terminateMock,
    setParameters: setParametersMock,
  });
  metadataMock.mockReset().mockResolvedValue({ width: 1600, height: 1000 });
  const picture = {
    metadata: metadataMock,
    resize: resizeMock,
    greyscale: () => picture,
    normalise: () => picture,
    linear: linearMock,
    png: () => picture,
    toBuffer: vi.fn().mockResolvedValue(CONTRASTED),
  };
  resizeMock.mockReset().mockReturnValue(picture);
  linearMock.mockReset().mockReturnValue(picture);
  sharpMock.mockReset().mockReturnValue(picture);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("recognizeText", () => {
  it("returns the text Tesseract reads and stops the worker", async () => {
    expect(await recognizeText(IMAGE)).toBe("SGD 12.50");
    expect(recognizeMock).toHaveBeenCalledWith(IMAGE);
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });

  it("loads the language data from the repo, never from the network", async () => {
    await recognizeText(IMAGE);
    expect(createWorkerMock).toHaveBeenCalledWith("eng", 1, {
      langPath: path.join(process.cwd(), "ocr-data"),
      cachePath: os.tmpdir(),
      cacheMethod: "none",
      gzip: true,
    });
  });

  it("reads the original image as-is by default, after checking its size", async () => {
    await recognizeText(IMAGE);
    expect(sharpMock).toHaveBeenCalledWith(IMAGE, SHARP_OPTIONS);
    expect(resizeMock).not.toHaveBeenCalled();
    expect(setParametersMock).not.toHaveBeenCalled();
  });

  it("reads an enlarged, contrast-stretched copy as sparse text in highContrast mode", async () => {
    await recognizeText(IMAGE, "highContrast");
    expect(sharpMock).toHaveBeenCalledWith(IMAGE, SHARP_OPTIONS);
    expect(resizeMock).toHaveBeenCalledWith({
      width: 3200,
      height: 3200,
      fit: "inside",
    });
    expect(linearMock).toHaveBeenCalledWith(1.8, -100);
    expect(setParametersMock).toHaveBeenCalledWith({
      tessedit_pageseg_mode: "11",
    });
    expect(recognizeMock).toHaveBeenCalledWith(CONTRASTED);
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["too many pixels", { width: 20_000, height: 20_000 }],
    ["no dimensions", {}],
  ])(
    "rejects an image with %s before any decode or OCR",
    async (_name, size) => {
      metadataMock.mockResolvedValue(size);
      await expect(recognizeText(IMAGE, "highContrast")).rejects.toThrow(
        "Image dimensions out of range",
      );
      expect(resizeMock).not.toHaveBeenCalled();
      expect(createWorkerMock).not.toHaveBeenCalled();
    },
  );

  it("stops the worker and rethrows when the image cannot be read", async () => {
    recognizeMock.mockRejectedValue(new Error("unreadable"));
    await expect(recognizeText(IMAGE)).rejects.toThrow("unreadable");
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after 20 seconds and stops the worker", async () => {
    vi.useFakeTimers();
    recognizeMock.mockImplementation(() => new Promise(() => {}));
    const pending = recognizeText(IMAGE);
    const outcome = expect(pending).rejects.toThrow("OCR timed out");
    await vi.advanceTimersByTimeAsync(19_999);
    expect(terminateMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(terminateMock).toHaveBeenCalledTimes(1);
  });
});

describe("deployment packaging for the OCR worker", () => {
  // The worker thread loads its script, the wasm core and the language file
  // by path, so the build only ships them because next.config.ts says so.
  // A wrong key fails silently on Vercel: every amount would stay unchecked.
  const config = readFileSync(
    path.join(process.cwd(), "next.config.ts"),
    "utf8",
  );

  it("attaches the extra files to the claim route, with [id] written as a glob", () => {
    expect(config).toContain('"/api/v1/checkout/*/claim": OCR_FILES');
    expect(config).not.toContain('"/api/v1/checkout/[id]/claim"');
  });

  it("attaches them to the pay page too, which runs the same check", () => {
    expect(config).toContain('"/pay/*": OCR_FILES');
    expect(config).not.toContain('"/pay/[id]"');
  });

  it.each([
    "./ocr-data/*",
    "node_modules/tesseract.js/**/*",
    "node_modules/tesseract.js-core/*",
    "./node_modules/wasm-feature-detect/**/*",
  ])("includes %s", (pattern) => {
    expect(config).toContain(pattern);
  });

  it("keeps the worker's packages out of the bundler", () => {
    for (const name of [
      "tesseract.js",
      "tesseract.js-core",
      "bmp-js",
      "zlibjs",
      "wasm-feature-detect",
    ])
      expect(config).toContain(`"${name}",`);
  });
});
