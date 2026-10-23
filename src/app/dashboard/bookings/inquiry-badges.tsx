import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Inquiry, InquiryStatus } from "@/lib/types";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "Inquiry",
  contacted: "Contacted",
  converted: "Converted",
  declined: "Declined",
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <Badge
      variant={status === "declined" ? "outline" : "secondary"}
      className={cn(
        status === "new" &&
          "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-400",
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** The client's acknowledgment, as recorded when they sent the inquiry. */
export function TermsSnapshot({
  inquiry,
}: {
  inquiry: Pick<Inquiry, "terms_url" | "terms_version" | "terms_accepted_at">;
}) {
  if (!inquiry.terms_url || !inquiry.terms_accepted_at) {
    return <span className="text-muted-foreground">Not asked</span>;
  }
  const at = new Date(inquiry.terms_accepted_at).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <span>
      Accepted{" "}
      <a
        href={inquiry.terms_url}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        version {inquiry.terms_version}
      </a>{" "}
      on {at}
    </span>
  );
}
