import "server-only";
import os from "node:os";
import path from "node:path";
// Tesseract starts a worker thread that loads these by name at run time.
// Importing them here is what puts them in the deployed function; see
// `outputFileTracingIncludes` in next.config.ts for the files no import
// reaches (the worker script, the wasm core, the language data).
import "bmp-js";
import "zlibjs";
import "wasm-feature-detect";
import "tesseract.js-core/package.json";

// A phone screenshot reads in about a second. Past this the image is not
// one Tesseract can handle and the worker is stopped.
const OCR_TIMEOUT_MS = 20_000;

// The hosted pay page uploads a 1600px WebP, which smears the small grey
// raised cents of PayLah's history screen. Enlarging and stretching the
// contrast is what made them readable; see proof-amount-check.ts.
const ENHANCED_LONG_SIDE = 3200;
const CONTRAST_GAIN = 1.8;
const CONTRAST_OFFSET = -100;

export type OcrMode = "plain" | "highContrast";

async function highContrast(image: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(image)
    .resize({
      width: ENHANCED_LONG_SIDE,
      height: ENHANCED_LONG_SIDE,
      fit: "inside",
    })
    .greyscale()
    .normalise()
    .linear(CONTRAST_GAIN, CONTRAST_OFFSET)
    .png()
    .toBuffer();
}

/**
 * Reads the text out of an image with Tesseract, in this process. The
 * language data is the repo's own `ocr-data/eng.traineddata.gz`, so nothing
 * is fetched at run time. `highContrast` reads an enlarged, contrast-stretched
 * copy as sparse text, for screenshots the plain read garbles. Throws when the image
 * cannot be read or the read takes longer than 20 seconds; the worker is
 * stopped either way.
 */
export async function recognizeText(
  image: Buffer,
  mode: OcrMode = "plain",
): Promise<string> {
  const input = mode === "highContrast" ? await highContrast(image) : image;
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    langPath: path.join(process.cwd(), "ocr-data"),
    cachePath: os.tmpdir(),
    cacheMethod: "none",
    gzip: true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("OCR timed out")),
      OCR_TIMEOUT_MS,
    );
  });
  try {
    if (mode === "highContrast")
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await Promise.race([worker.recognize(input), timedOut]);
    return data.text;
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}
