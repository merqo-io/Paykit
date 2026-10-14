"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { Download, ImageUp } from "lucide-react";
import { resizeToWebp } from "@merqo/ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/use-async-action";
import { cn, formatCents } from "@/lib/utils";
import type { HostedPayment } from "@/lib/hosted-pay";
import { claimHostedPayment, getHostedPaymentStatus } from "./actions";
import { leaveTo } from "./leave";
import { renderSvgToPngBlob } from "./qr-image";

const POLL_MS = 5000;
const PROOF_ERROR_ID = "payment-proof-error";
const PROOF_MAX_BYTES = 1024 * 1024;
const PROOF_TYPES = ["image/webp", "image/jpeg", "image/png"];

interface Proof {
  file: File;
  // Null where the browser cannot make one; the file name still shows.
  previewUrl: string | null;
}

function previewUrlFor(file: File): string | null {
  return typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : null;
}

function releasePreview(proof: Proof | null) {
  if (proof?.previewUrl) URL.revokeObjectURL(proof.previewUrl);
}

// The same limits the server enforces, checked here so an unsupported or
// oversized file is refused before the upload round trip.
function proofProblem(file: File): string | null {
  if (file.size === 0) return "The payment screenshot is empty.";
  if (file.size > PROOF_MAX_BYTES)
    return "That image is too large. Try a screenshot instead of a photo.";
  if (!PROOF_TYPES.includes(file.type))
    return "Upload a screenshot or photo (JPEG, PNG or WebP).";
  return null;
}

function headingFor(view: NonNullable<HostedPayment["view"]>): string {
  if (view.type === "link") return "Pay to complete your order";
  if (view.type === "qr") return "Scan with your PayNow banking app to pay";
  return "Scan with your banking or payment app to pay";
}

export function PayPanel({
  id,
  token,
  title,
  amountCents,
  view,
}: {
  id: string;
  token: string;
  title: string | null;
  amountCents: number;
  view: HostedPayment["view"];
}) {
  const { pending: busy, run } = useAsyncAction();
  const [imgError, setImgError] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<Proof | null>(null);

  function replaceProof(next: Proof | null) {
    releasePreview(proofRef.current);
    proofRef.current = next;
    setProof(next);
  }

  useEffect(() => () => releasePreview(proofRef.current), []);

  // The payment can be confirmed from somewhere else while this page is
  // open (the seller's own screen). When that happens the customer is done
  // here, so the page moves them on without waiting for a tap.
  useEffect(() => {
    if (recorded) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const current = await getHostedPaymentStatus(id, token).catch(() => null);
      if (stopped || !current || current.status === "pending") return;
      stopped = true;
      clearInterval(timer);
      if (current.returnUrl) leaveTo(current.returnUrl);
      else setRecorded(true);
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id, token, recorded]);

  async function saveQrImage() {
    const svg = qrWrapperRef.current?.querySelector("svg");
    if (!svg) {
      toast.error("Couldn't prepare the QR to save.");
      return;
    }
    setSaving(true);
    try {
      const blob = await renderSvgToPngBlob(svg as SVGSVGElement);
      const file = new File([blob], "payment-qr.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "payment-qr.png";
      // Some browsers need the anchor in the document for the click to
      // start a download.
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking at once can cancel a download that is still starting.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      toast.error("Couldn't prepare the QR to save. Screenshot it instead.");
    } finally {
      setSaving(false);
    }
  }

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setPhotoError(null);
    // The only resize the screenshot gets: the server cannot run a canvas.
    const resized = await resizeToWebp(selected, 1600);
    const file =
      resized.blob instanceof File
        ? resized.blob
        : new File([resized.blob], selected.name, {
            type: resized.type,
            lastModified: selected.lastModified,
          });
    const problem = proofProblem(file);
    if (problem) {
      replaceProof(null);
      setPhotoError(problem);
      return;
    }
    replaceProof({ file, previewUrl: previewUrlFor(file) });
  }

  function submit() {
    if (!proof) {
      setPhotoError("A payment screenshot is required.");
      return;
    }
    return run(async () => {
      const body = new FormData();
      body.append("proof", proof.file, "proof");
      const res = await claimHostedPayment(id, token, body);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      if (res.returnUrl) leaveTo(res.returnUrl);
      else setRecorded(true);
    });
  }

  if (recorded) {
    return (
      <section className="space-y-3 px-6 py-5 text-center">
        <h1 className="font-display text-xl font-semibold">Payment recorded</h1>
        <p className="text-sm text-muted-foreground">
          The seller has been told. You can close this page.
        </p>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="space-y-3 px-6 py-5 text-center">
        <h1 className="font-display text-xl font-semibold">
          Couldn&apos;t load payment right now
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask the seller how to pay for this order.
        </p>
      </section>
    );
  }

  // One filled button at a time, on the step the customer is up to: pay,
  // then attach the screenshot, then say so.
  const payIsNext = view.type === "link" && !proof;
  const attachIsNext = view.type !== "link" && !proof;

  return (
    <section className="space-y-5 px-6 py-5">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-xl font-semibold text-balance">
          {headingFor(view)}
        </h1>
        {title && (
          <p className="break-words text-sm text-muted-foreground">{title}</p>
        )}
      </header>

      <p className="text-center font-mono text-3xl font-bold">
        {formatCents(amountCents)}
      </p>

      {view.type === "qr" && (
        <>
          <div
            ref={qrWrapperRef}
            className="mx-auto w-fit rounded-xl bg-white p-4"
          >
            <QRCode value={view.payload} size={220} />
          </div>
          <Button
            variant="outline"
            className="mx-auto flex h-11 w-fit items-center gap-2 rounded-xl"
            disabled={saving}
            onClick={saveQrImage}
          >
            <Download className="size-4" aria-hidden />
            Save QR image
          </Button>
          <p className="mx-auto max-w-xs text-center text-xs text-muted-foreground">
            On this phone? Save the QR, then open your banking app and scan it
            from your photos.
          </p>
        </>
      )}
      {view.type === "image" &&
        (imgError ? (
          <p className="mx-auto max-w-xs text-center text-sm text-muted-foreground">
            The payment QR couldn&apos;t load. Check your connection and
            refresh, or ask the seller to show their QR.
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.url}
            alt="Payment QR"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="mx-auto w-44 rounded-xl border border-border"
          />
        ))}
      {view.type === "link" && (
        <Button
          asChild
          variant={payIsNext ? "default" : "outline"}
          className="h-12 w-full rounded-xl"
        >
          <a href={view.url} target="_blank" rel="noopener noreferrer">
            {view.label}
          </a>
        </Button>
      )}

      <div className="space-y-2">
        {proof && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
            {proof.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proof.previewUrl}
                alt=""
                className="h-14 w-11 shrink-0 rounded-md object-cover"
              />
            )}
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold">Screenshot attached</p>
              <p className="truncate text-xs text-muted-foreground">
                {proof.file.name}
              </p>
            </div>
          </div>
        )}
        {/* A real file input, hidden from sight and reached through its
            label, so the phone offers the photo library as well as the
            camera: a payment made on this phone is a saved screenshot. */}
        <input
          id="payment-proof"
          type="file"
          accept="image/*"
          onChange={onFileSelected}
          aria-invalid={photoError ? true : undefined}
          aria-describedby={photoError ? PROOF_ERROR_ID : undefined}
          className="peer sr-only"
        />
        <label
          htmlFor="payment-proof"
          className={cn(
            buttonVariants({ variant: attachIsNext ? "default" : "outline" }),
            "h-12 w-full cursor-pointer rounded-xl peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring",
          )}
        >
          <ImageUp className="size-4" aria-hidden />
          {proof
            ? "Upload a different screenshot"
            : "Upload payment screenshot"}
        </label>
        {photoError && (
          <p
            id={PROOF_ERROR_ID}
            role="alert"
            className="text-center text-sm font-medium text-destructive"
          >
            {photoError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Button
          variant={proof ? "default" : "outline"}
          className="h-12 w-full rounded-xl"
          disabled={busy}
          onClick={submit}
        >
          I&apos;ve paid
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          The seller checks your screenshot, then you go back to your order.
        </p>
      </div>
    </section>
  );
}
