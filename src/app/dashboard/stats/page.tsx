import { redirect } from "next/navigation";
import { reportsHref } from "../reports/search-params";

// Stats became the Reports overview tab; the old URL stays valid for bookmarks.
export default function StatsRedirect(): never {
  redirect(reportsHref("overview"));
}
