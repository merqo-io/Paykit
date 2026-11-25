import { whatsappLink } from "@/lib/phone-links";

/** Call and WhatsApp links for a customer number; shared by booking and inquiry pages. */
export function CustomerPhone({ phone }: { phone: string | null }) {
  if (!phone) return <span className="text-muted-foreground">Not set</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      <a
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        className="tabular-nums underline underline-offset-4"
      >
        {phone}
      </a>
      <a
        href={whatsappLink(phone)}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        WhatsApp
      </a>
    </span>
  );
}
