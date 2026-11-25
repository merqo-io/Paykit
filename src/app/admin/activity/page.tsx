import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, type AuditLogEntry } from "@merqo/ui";
import { Button, Input, Label } from "@merqo/ui/primitives";
import { requireAdmin } from "@/lib/admin";
import { auditLog, type AuditLogRow } from "@/lib/admin-data";
import { formatAction } from "@/app/admin/action-labels";
import { ListError } from "@/app/admin/list-error";
import { ListPager } from "@/app/admin/list-pager";
import {
  dayBounds,
  listHref,
  paginate,
  parseActivityParams,
} from "@/app/admin/list-params";
import { ActivitySection } from "./activity-section";

export const metadata: Metadata = {
  title: "Activity",
};

export const revalidate = 0;

const PATH = "/admin/activity";

// The audit read is a single newest-first query, so filtering and paging
// happen over this window rather than the whole table.
const FETCH_CAP = 1000;

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

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const filters = parseActivityParams(await searchParams);
  const { action, from, to, page } = filters;
  const active = { action, from, to };

  let rows: AuditLogRow[];
  try {
    rows = await auditLog(FETCH_CAP);
  } catch (error) {
    console.error("Admin activity load failed", error);
    return (
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <PageHeader responsive title="Activity" className="mb-0" />
        <ListError retryHref={listHref(PATH, { ...active, page })} />
      </main>
    );
  }

  const actions = [...new Set(rows.map((r) => r.action))].sort();
  const { fromMs, toMs } = dayBounds(from, to);
  const filtered = rows.filter((r) => {
    const at = Date.parse(r.created_at);
    return (!action || r.action === action) && at >= fromMs && at <= toMs;
  });
  const paged = paginate(filtered, page);
  if (paged.overflow) {
    redirect(listHref(PATH, { ...active, page: paged.pageCount }));
  }
  const filtering = Boolean(action || from || to);

  let body: ReactNode;
  if (rows.length === 0) {
    body = (
      <EmptyState
        title="No activity yet"
        description="Admin and vendor actions are listed here as they happen."
      />
    );
  } else if (paged.total === 0) {
    body = (
      <EmptyState
        title="No activity matches"
        description="Widen the dates or choose another action."
      />
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {paged.total} {paged.total === 1 ? "action" : "actions"}
          {rows.length >= FETCH_CAP && !filtering
            ? `, latest ${FETCH_CAP}`
            : ""}
        </p>
        <ActivitySection entries={paged.rows.map(toEntry)} />
        <ListPager
          path={PATH}
          params={active}
          page={paged.page}
          pageCount={paged.pageCount}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <PageHeader responsive title="Activity" className="mb-0" />

      <form
        method="get"
        action={PATH}
        role="search"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="activity-action">Action</Label>
          <select
            id="activity-action"
            name="action"
            defaultValue={action}
            className="h-11 w-full rounded-md border bg-background px-3 text-sm sm:w-56"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {formatAction(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-from">From</Label>
          <Input
            id="activity-from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-11 tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-to">To</Label>
          <Input
            id="activity-to"
            name="to"
            type="date"
            defaultValue={to}
            className="h-11 tabular-nums"
          />
        </div>
        <Button type="submit" className="h-11">
          Apply filters
        </Button>
        {filtering && (
          <Button asChild variant="ghost" className="h-11">
            <Link href={PATH}>Clear</Link>
          </Button>
        )}
      </form>

      {body}
    </main>
  );
}
