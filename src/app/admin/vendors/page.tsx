import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { listVendors } from "@/lib/admin-data";
import { PageHeader } from "@merqo/ui";
import { EmptyState } from "@merqo/ui";
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
      <PageHeader
        responsive
        eyebrow="Admin"
        title="Vendors"
        description="Every vendor with payment details, across every kit, most urgent first."
        className="mb-0"
      />

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Vendors appear here once they add payment details."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <VendorsTable rows={vendors} />
        </div>
      )}
    </main>
  );
}
