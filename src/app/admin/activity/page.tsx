import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, FORM_LABEL_CLASS, PageHeader } from "@merqo/ui";
import { Button, cn, Input, Label } from "@merqo/ui/primitives";
import { requireAdmin } from "@/lib/admin";
import { auditLog, type AuditLogRow } from "@/lib/admin-data";
import { formatAction, KNOWN_ACTIONS } from "@/app/admin/action-labels";
import { ListError } from "@/components/list/list-error";
import { UrlPager } from "@/components/list/url-pager";
import { FILTER_SELECT_CLASS } from "@/components/list/filter-classes";
import {
  dayBounds,
  listHref,
  PAGE_SIZE,
  parseActivityParams,
} from "@/app/admin/list-params";
import { ActivitySection, type ActivityEntry } from "./activity-section";

export const metadata: Metadata = {
  title: "Activity",
};

export const revalidate = 0;

const PATH = "/admin/activity";

const SELECT_CLASS = cn(FILTER_SELECT_CLASS, "sm:w-56");

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

function toEntry(row: AuditLogRow): ActivityEntry {
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

  const { fromMs, toMs } = dayBounds(from, to);
  let result: Awaited<ReturnType<typeof auditLog>>;
  try {
    result = await auditLog({
      action: action || undefined,
      since: Number.isFinite(fromMs)
        ? new Date(fromMs).toISOString()
        : undefined,
      until: Number.isFinite(toMs) ? new Date(toMs).toISOString() : undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("Admin activity load failed", error);
    return (
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <PageHeader responsive title="Activity" className="mb-0" />
        <ListError retryHref={listHref(PATH, { ...active, page })} />
      </main>
    );
  }

  if (page > result.pageCount) {
    redirect(listHref(PATH, { ...active, page: result.pageCount }));
  }
  const actions =
    action && !KNOWN_ACTIONS.includes(action)
      ? [...KNOWN_ACTIONS, action]
      : KNOWN_ACTIONS;
  const filtering = Boolean(action || from || to);

  let body: ReactNode;
  if (result.total === 0 && !filtering) {
    body = (
      <EmptyState
        title="No activity yet"
        description="Admin and vendor actions are listed here as they happen."
      />
    );
  } else if (result.total === 0) {
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
          {result.total} {result.total === 1 ? "action" : "actions"}
        </p>
        <ActivitySection entries={result.rows.map(toEntry)} />
        <UrlPager
          page={result.page}
          pageCount={result.pageCount}
          href={(next) => listHref(PATH, { ...active, page: next })}
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
          <Label htmlFor="activity-action" className={FORM_LABEL_CLASS}>
            Action
          </Label>
          <select
            id="activity-action"
            name="action"
            defaultValue={action}
            className={SELECT_CLASS}
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
          <Label htmlFor="activity-from" className={FORM_LABEL_CLASS}>
            From
          </Label>
          <Input
            id="activity-from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-11 tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-to" className={FORM_LABEL_CLASS}>
            To
          </Label>
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
