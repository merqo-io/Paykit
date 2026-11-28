import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { listVendors, type VendorRow } from "@/lib/admin-data";
import { EmptyState, PageHeader, SearchField } from "@merqo/ui";
import { Button, Label } from "@merqo/ui/primitives";
import { VendorsTable } from "@/app/admin/vendors/vendors-table";
import { ListError } from "@/components/list/list-error";
import { UrlPager } from "@/components/list/url-pager";
import { listHref, paginate, parseVendorParams } from "@/app/admin/list-params";

export const metadata: Metadata = {
  title: "Vendors",
};

export const revalidate = 0;

const PATH = "/admin/vendors";

function matches(vendor: VendorRow, needle: string): boolean {
  return [vendor.email, vendor.payee_name, vendor.label, vendor.vendor_id].some(
    (field) => field?.toLowerCase().includes(needle),
  );
}

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const { q, page } = parseVendorParams(await searchParams);

  let vendors: VendorRow[];
  try {
    vendors = await listVendors();
  } catch (error) {
    console.error("Admin vendors load failed", error);
    return (
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <PageHeader responsive title="Vendors" className="mb-0" />
        <ListError retryHref={listHref(PATH, { q, page })} />
      </main>
    );
  }

  const needle = q.toLowerCase();
  const filtered = needle ? vendors.filter((v) => matches(v, needle)) : vendors;
  const paged = paginate(filtered, page);
  if (paged.overflow) {
    redirect(listHref(PATH, { q, page: paged.pageCount }));
  }

  let body: ReactNode;
  if (vendors.length === 0) {
    body = (
      <EmptyState
        title="No vendors yet"
        description="Vendors appear here once they add payment details."
      />
    );
  } else if (paged.total === 0) {
    body = (
      <EmptyState
        title="No vendors match"
        description={`Nothing found for "${q}". Check the spelling or clear the search.`}
      />
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {paged.total} {paged.total === 1 ? "vendor" : "vendors"}
        </p>
        <div className="overflow-x-auto">
          <VendorsTable rows={paged.rows} />
        </div>
        <UrlPager
          page={paged.page}
          pageCount={paged.pageCount}
          href={(next) => listHref(PATH, { q, page: next })}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <PageHeader responsive title="Vendors" className="mb-0" />

      <form
        method="get"
        action={PATH}
        role="search"
        className="flex flex-wrap items-end gap-2"
      >
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-sm">
          <Label id="vendor-search-label" htmlFor="vendor-search">
            Search by stall name or email
          </Label>
          <SearchField
            id="vendor-search"
            aria-labelledby="vendor-search-label"
            name="q"
            defaultValue={q}
            maxLength={100}
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11">
          Search
        </Button>
        {q && (
          <Button asChild variant="ghost" className="h-11">
            <Link href={PATH}>Clear</Link>
          </Button>
        )}
      </form>

      {body}
    </main>
  );
}
