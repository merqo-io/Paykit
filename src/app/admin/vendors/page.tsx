import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { listVendors } from "@/lib/admin-data";
import { ElevatedCard } from "@merqo/ui";
import { VendorsTable } from "@/app/admin/vendors/vendors-table";

export const metadata: Metadata = {
  title: "Vendors",
};

export const revalidate = 0;

export default async function AdminVendorsPage() {
  await requireAdmin();

  const vendors = await listVendors();

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every vendor with a payment config, across every kit — most urgent
          first.
        </p>
      </div>

      {vendors.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No vendors yet.
        </p>
      ) : (
        <ElevatedCard className="overflow-x-auto">
          <VendorsTable rows={vendors} />
        </ElevatedCard>
      )}
    </main>
  );
}
