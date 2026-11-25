import { Download, ImageUp } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@merqo/ui/primitives";

// A deliberately non-payable payload: the card is a picture of the pay page,
// so scanning it must never lead anywhere near a real PayNow account.
const SAMPLE_QR_VALUE = "https://paykit.merqo.io/faq";

/**
 * A static copy of the QR step of the real pay page (`/pay/[id]`): same
 * header, amount, QR size and button labels. The buttons are inert, and the
 * heading is a paragraph so the landing keeps a single h1.
 */
export function CheckoutCard() {
  return (
    <figure
      className="w-full max-w-sm rounded-lg border bg-card"
      aria-label="Sample paykit pay page"
    >
      <div className="space-y-5 px-6 py-5">
        <header className="space-y-1 text-center">
          <p className="font-display text-xl font-semibold text-balance">
            Scan to pay with PayNow
          </p>
          <p className="break-words text-sm text-muted-foreground">
            Order #A82F
          </p>
        </header>

        <div className="space-y-1 text-center">
          <p className="break-words text-lg font-semibold">
            Paying Ah Seng Kopi
          </p>
          <p className="font-mono text-3xl font-bold">S$7.80</p>
        </div>

        <div className="mx-auto w-fit rounded-lg border border-border bg-white p-4">
          <QRCode value={SAMPLE_QR_VALUE} size={220} />
        </div>
        <Button
          variant="outline"
          disabled
          className="mx-auto flex h-12 w-fit items-center gap-2 rounded-lg disabled:opacity-100"
        >
          <Download className="size-4" aria-hidden />
          Save QR image
        </Button>
        <p className="mx-auto max-w-xs text-center text-xs text-muted-foreground">
          On this phone? Save the QR, then open your banking app and scan it
          from your photos.
        </p>

        <Button
          disabled
          className="h-12 w-full rounded-lg disabled:opacity-100"
        >
          <ImageUp className="size-4" aria-hidden />
          Upload payment screenshot
        </Button>

        <div className="space-y-2">
          <Button
            variant="outline"
            disabled
            className="h-12 w-full rounded-lg disabled:opacity-100"
          >
            I&apos;ve paid
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            The seller checks your screenshot, then you go back to your order.
          </p>
        </div>
      </div>
    </figure>
  );
}
