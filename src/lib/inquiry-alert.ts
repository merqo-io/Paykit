import { formatDate } from "@/lib/utils";

function merqoBaseUrl(): string {
  return process.env.MERQO_BASE_URL ?? "https://www.merqo.io";
}

/** Plain text: merqo sends it with no parse mode. No link, so a forged inquiry cannot carry one. */
export function inquiryAlertText(
  customerName: string,
  eventDate: string | undefined,
): string {
  const when = eventDate ? `, event ${formatDate(eventDate)}` : "";
  return `New paykit inquiry from ${customerName}${when}. Open Bookings in paykit to reply.`;
}

/**
 * Fire and forget through merqo's vendor Telegram bot. Never throws: the
 * inquiry is already stored, and a vendor with no linked Telegram simply
 * gets no message.
 */
export async function sendInquiryAlert(
  vendorId: string,
  customerName: string,
  eventDate: string | undefined,
): Promise<void> {
  const secret = process.env.MERQO_CUSTOMER_SECRET;
  if (!secret) return;
  try {
    const res = await fetch(`${merqoBaseUrl()}/api/merqo/notify-vendor`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        vendor_id: vendorId,
        message: inquiryAlertText(customerName, eventDate),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("sendInquiryAlert: merqo answered", res.status);
  } catch {
    console.error("sendInquiryAlert unavailable");
  }
}
