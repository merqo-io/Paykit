import { redirect } from "next/navigation";
import { parseReportsParams, reportsHref } from "../search-params";

// Earnings became a Reports tab; the old URL stays valid and keeps `year`.
export default async function EarningsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const raw = await searchParams;
  const { year } = parseReportsParams(raw);
  redirect(reportsHref("earnings", raw.year === undefined ? undefined : year));
}
