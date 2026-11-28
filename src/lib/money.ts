import { dollarsToCents as parseCents } from "@merqo/ui";

/**
 * Integer cents from a form field, or null for blank, invalid or file input.
 * The action schemas coerce null to 0 and reject it as not positive, so the
 * vendor sees the same "Enter a valid ... amount." message as for a typo.
 */
export function dollarsToCents(raw: FormDataEntryValue | null): number | null {
  return typeof raw === "string" ? parseCents(raw) : null;
}
