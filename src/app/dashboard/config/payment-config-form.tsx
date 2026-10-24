"use client";

import { useActionState, useState } from "react";
import { RadioOptionCard } from "./radio-option-card";
import Image from "next/image";
import QRCode from "react-qr-code";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  commitPendingImages,
  ImageUploader,
  isPendingImage,
  PendingImageUploadError,
} from "@merqo/ui";
import {
  removeUnsavedImages,
  uploadPaykitImage,
} from "@/lib/image-upload-adapter";
import { resizeToWebp } from "@merqo/ui";
import { buildPayNowPayload } from "@/lib/payments/paynow";
import { isHttpUrl } from "@/lib/schemas";
import { saveConfigAction, type SaveConfigState } from "./actions";
import {
  POINTER_PRESETS,
  POINTER_PRESET_ORDER,
  derivePointerPreset,
  type PointerPresetId,
} from "./pointer-presets";
import type { PaymentConfigKind, VendorPaymentConfig } from "@/lib/types";

type IdKind = "uen" | "mobile";
type PointerMode = "link" | "qr";

const KIND_OPTIONS: { k: PaymentConfigKind; label: string; hint: string }[] = [
  {
    k: "paynow",
    label: "PayNow QR",
    hint: "We generate a QR with the order amount already filled in.",
  },
  {
    k: "pointer",
    label: "Payment link or QR image",
    hint: "Qashier, HitPay, GrabPay for Business, Stripe Payment Links, or your bank's own QR: any of them work here.",
  },
];

function paynowDefaults(initial: VendorPaymentConfig | null) {
  return {
    idKind: (initial?.mobile ? "mobile" : "uen") as IdKind,
    idKindTouched: initial?.kind === "paynow",
    payeeName: initial?.payee_name ?? "",
    uen: initial?.uen ?? "",
    mobile: initial?.mobile ?? "",
  };
}

function pointerDefaults(initial: VendorPaymentConfig | null) {
  const pointer = initial?.kind === "pointer" ? initial : null;
  const preset: PointerPresetId = pointer
    ? derivePointerPreset(pointer)
    : "stripe";
  return {
    pointerMode: (pointer?.qr_image_url && !pointer.url
      ? "qr"
      : "link") as PointerMode,
    preset,
    // A brand-new config lands on the default preset's suggested label.
    label: initial?.label ?? POINTER_PRESETS[preset].labelSuggestion,
    labelTouched: Boolean(initial?.label),
    url: initial?.url ?? "",
  };
}

function formDefaults(initial: VendorPaymentConfig | null) {
  return {
    qrImageUrl: initial?.qr_image_url ?? null,
    kind: initial?.kind ?? "paynow",
    ...paynowDefaults(initial),
    ...pointerDefaults(initial),
  };
}

function PayNowFields({
  payeeName,
  onPayeeName,
  idKind,
  idKindTouched,
  onIdKind,
  uen,
  onUen,
  mobile,
  onMobile,
}: {
  payeeName: string;
  onPayeeName: (v: string) => void;
  idKind: IdKind;
  idKindTouched: boolean;
  onIdKind: (v: IdKind) => void;
  uen: string;
  onUen: (v: string) => void;
  mobile: string;
  onMobile: (v: string) => void;
}) {
  const identifier = idKind === "uen" ? uen : mobile;
  const previewPayload =
    payeeName && identifier
      ? buildPayNowPayload({
          uen: idKind === "uen" ? uen : undefined,
          mobile: idKind === "mobile" ? mobile : undefined,
          payeeName,
          amountCents: 100,
          reference: "PREVIEW",
        })
      : null;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="payee_name">Payee name</Label>
        <Input
          id="payee_name"
          name="payee_name"
          value={payeeName}
          onChange={(e) => onPayeeName(e.target.value)}
          placeholder="Kopitiam Cart"
        />
      </div>

      <RadioGroup
        value={idKindTouched ? idKind : ""}
        onValueChange={(v) => onIdKind(v as IdKind)}
        className="flex gap-4"
      >
        <span className="flex items-center gap-2">
          <RadioGroupItem value="uen" aria-label="Pay via UEN" /> UEN
        </span>
        <span className="flex items-center gap-2">
          <RadioGroupItem value="mobile" aria-label="Pay via mobile" /> Mobile
        </span>
      </RadioGroup>

      {idKind === "uen" ? (
        <div className="space-y-2">
          <Label htmlFor="uen">UEN</Label>
          <Input
            id="uen"
            name="uen"
            value={uen}
            onChange={(e) => onUen(e.target.value)}
            placeholder="53312345A"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            name="mobile"
            value={mobile}
            onChange={(e) => onMobile(e.target.value)}
            placeholder="+6591234567"
          />
        </div>
      )}

      {previewPayload && (
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Preview ($1.00 sample QR)
          </p>
          <QRCode value={previewPayload} size={160} />
        </div>
      )}
    </>
  );
}

function LinkFields({
  preset,
  url,
  onUrl,
}: {
  preset: PointerPresetId;
  url: string;
  onUrl: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="url">Payment link</Label>
      <Input
        id="url"
        name="url"
        value={url}
        onChange={(e) => onUrl(e.target.value)}
        placeholder="https://…"
      />
      <p className="text-xs text-muted-foreground">
        {POINTER_PRESETS[preset].instructions}
      </p>
      {POINTER_PRESETS[preset].urlPattern &&
        url &&
        !POINTER_PRESETS[preset].urlPattern!.test(url) && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-500">
            {POINTER_PRESETS[preset].urlWarning}
          </p>
        )}
      {isHttpUrl(url) && (
        <a
          // Re-serialized through URL rather than the raw input: an
          // explicit sanitizing step CodeQL's dataflow can see,
          // on top of isHttpUrl's existing http(s)-only guard.
          href={new URL(url).href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Open link
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

function QrFields({
  preset,
  vendorId,
  qrImageUrl,
  onQrImageUrl,
}: {
  preset: PointerPresetId;
  vendorId: string;
  qrImageUrl: string | null;
  onQrImageUrl: (v: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>QR image</Label>
      <ImageUploader
        bucket="vendor-images"
        pathPrefix={vendorId}
        value={qrImageUrl}
        onChange={onQrImageUrl}
        onUpload={uploadPaykitImage}
        resizeImage={resizeToWebp}
        imageComponent={Image}
        variant="thumb"
        deferUpload
      />
      <input type="hidden" name="qr_image_url" value={qrImageUrl ?? ""} />
      <p className="text-xs text-muted-foreground">
        {POINTER_PRESETS[preset].instructions}
      </p>
    </div>
  );
}

function SaveStatus({
  state,
  returnTo,
}: {
  state: SaveConfigState;
  returnTo: string | null;
}) {
  return (
    <>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "ok" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm font-medium text-mint">Saved.</p>
          {returnTo && (
            <a
              href={returnTo}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Back to your booth
            </a>
          )}
        </div>
      )}
    </>
  );
}

export function PaymentConfigForm({
  initial,
  vendorId,
  returnTo = null,
}: {
  initial: VendorPaymentConfig | null;
  vendorId: string;
  // The page in another Merqo app that sent the vendor here, already checked
  // by the page (`familyReturnUrl`). Offered as the way back after a save.
  returnTo?: string | null;
}) {
  const d = formDefaults(initial);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(d.qrImageUrl);

  // The QR uploader defers its upload, so a vendor who picks an image and
  // leaves without saving leaves nothing in storage. The pending QR uploads
  // here, on Save, and is deleted again if the save fails.
  const [state, formAction, pending] = useActionState<
    SaveConfigState,
    FormData
  >(
    async (previous, formData) => {
      const qr = formData.get("qr_image_url");
      if (typeof qr !== "string" || !isPendingImage(qr))
        return saveConfigAction(previous, formData);

      let committed;
      try {
        committed = await commitPendingImages([qr]);
      } catch (error) {
        if (error instanceof PendingImageUploadError)
          void removeUnsavedImages(error.uploaded);
        return {
          status: "error",
          message: "Could not upload the QR image. Try again.",
        };
      }
      const uploadedQr = committed.urls[0] ?? "";
      formData.set("qr_image_url", uploadedQr);
      const result = await saveConfigAction(previous, formData);
      if (result.status === "ok") setQrImageUrl(uploadedQr);
      else void removeUnsavedImages(committed.uploaded);
      return result;
    },
    { status: "idle" },
  );

  const [kind, setKind] = useState<PaymentConfigKind>(d.kind);

  // PayNow fields.
  const [idKind, setIdKind] = useState<IdKind>(d.idKind);
  const [idKindTouched, setIdKindTouched] = useState(d.idKindTouched);
  const [payeeName, setPayeeName] = useState(d.payeeName);
  const [uen, setUen] = useState(d.uen);
  const [mobile, setMobile] = useState(d.mobile);

  // Pointer fields.
  const [pointerMode, setPointerMode] = useState<PointerMode>(d.pointerMode);
  const [preset, setPreset] = useState<PointerPresetId>(d.preset);
  const [label, setLabel] = useState(d.label);
  // Tracks a vendor-typed label so a preset switch never clobbers it.
  const [labelTouched, setLabelTouched] = useState(d.labelTouched);
  const [url, setUrl] = useState(d.url);

  function handlePresetChange(id: PointerPresetId) {
    setPreset(id);
    const next = POINTER_PRESETS[id];
    if (next.mode !== "choice") {
      setPointerMode(next.mode);
    }
    if (!labelTouched) {
      setLabel(next.labelSuggestion);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />

      <RadioGroup
        value={kind}
        onValueChange={(v) => setKind(v as PaymentConfigKind)}
        className="gap-2.5"
      >
        {KIND_OPTIONS.map(({ k, label: optLabel, hint }) => {
          const selected = kind === k;
          return (
            <RadioOptionCard
              key={k}
              value={k}
              label={optLabel}
              hint={hint}
              selected={selected}
            />
          );
        })}
      </RadioGroup>

      {kind === "paynow" && (
        <PayNowFields
          payeeName={payeeName}
          onPayeeName={setPayeeName}
          idKind={idKind}
          idKindTouched={idKindTouched}
          onIdKind={(v) => {
            setIdKind(v);
            setIdKindTouched(true);
          }}
          uen={uen}
          onUen={setUen}
          mobile={mobile}
          onMobile={setMobile}
        />
      )}

      {kind === "pointer" && (
        <>
          <div className="space-y-2">
            <Label>Preset</Label>
            <RadioGroup
              value={preset}
              onValueChange={(v) => handlePresetChange(v as PointerPresetId)}
              className="grid grid-cols-2 gap-2.5"
            >
              {POINTER_PRESET_ORDER.map((id) => {
                const p = POINTER_PRESETS[id];
                const selected = preset === id;
                return (
                  <RadioOptionCard
                    key={id}
                    value={id}
                    label={p.cardLabel}
                    selected={selected}
                    compact
                  />
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Button label</Label>
            <Input
              id="label"
              name="label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelTouched(true);
              }}
              placeholder="Pay with PayLah"
            />
          </div>

          {preset === "other" && (
            <RadioGroup
              value={pointerMode}
              onValueChange={(v) => setPointerMode(v as PointerMode)}
              className="flex gap-4"
            >
              <span className="flex items-center gap-2">
                <RadioGroupItem value="link" aria-label="Use a payment link" />{" "}
                Payment link
              </span>
              <span className="flex items-center gap-2">
                <RadioGroupItem value="qr" aria-label="Use a QR image" /> QR
                image
              </span>
            </RadioGroup>
          )}

          {pointerMode === "link" ? (
            <LinkFields preset={preset} url={url} onUrl={setUrl} />
          ) : (
            <QrFields
              preset={preset}
              vendorId={vendorId}
              qrImageUrl={qrImageUrl}
              onQrImageUrl={setQrImageUrl}
            />
          )}
        </>
      )}

      <SaveStatus state={state} returnTo={returnTo} />

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save payment config"}
      </Button>
    </form>
  );
}
