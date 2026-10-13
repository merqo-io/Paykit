# ocr-data

## Purpose

Language data for the server-side OCR that reads the amount out of a payment
screenshot (`src/lib/proof-ocr.ts`). Kept in the repo so nothing is fetched
at run time.

## Contents

- `eng.traineddata.gz` — Tesseract's English LSTM model, gzipped (about
  3 MB). The same file qkit shipped under `public/tesseract/` for its
  in-browser check. Read by `tesseract.js@5.1.1`; replace it only together
  with that package.

## Connectivity

`next.config.ts`'s `outputFileTracingIncludes` copies this folder into the
claim route's deployed function. Nothing imports it, so without that entry
the file would be missing on Vercel and every amount check would fail
(quietly: `amount_match` would stay `null`).

## Parent

See the repo root [README.md](../README.md) for the full layout.
