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

/**
 * Reads the text out of an image with Tesseract, in this process. The
 * language data is the repo's own `ocr-data/eng.traineddata.gz`, so nothing
 * is fetched at run time. Throws when the image cannot be read or the read
 * takes longer than 20 seconds; the worker is stopped either way.
 */
export async function recognizeText(image: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
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
    const { data } = await Promise.race([worker.recognize(image), timedOut]);
    return data.text;
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}
