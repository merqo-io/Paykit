import type { Metadata } from "next";
import { type AuditLogEntry } from "@merqo/ui";
import { requireAdmin } from "@/lib/admin";
import { auditLog, type AuditLogRow } from "@/lib/admin-data";
import { PageHeader } from "@merqo/ui";
import { ActivitySection } from "./activity-section";

export const metadata: Metadata = {
  title: "Activity",
};

export const revalidate = 0;

function formatDetail(detail: AuditLogRow["detail"]): string | null {
  if (detail === null || detail === undefined) return null;
  if (typeof detail !== "object" || Array.isArray(detail))
    return String(detail);
  const entries = Object.entries(detail).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return null;
  return entries
    .map(([key, value]) => `${key}: ${value === null ? "None" : String(value)}`)
    .join(", ");
}

function toEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actor: row.email ?? row.admin_id,
    action: row.action,
    target: row.target_id,
    detail: formatDetail(row.detail),
    createdAt: row.created_at,
  };
}

export default async function AdminActivityPage() {
  await requireAdmin();

  const rows = await auditLog(100);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <PageHeader
        responsive
        eyebrow="Admin"
        title="Activity"
        description="Recent actions by admins and vendors, across every vendor."
        className="mb-0"
      />

      <ActivitySection entries={rows.map(toEntry)} />
    </main>
  );
}
