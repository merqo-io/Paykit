"use client";

import { useRouter } from "next/navigation";
import { DataTablePager } from "@merqo/ui";
import { transactionsHref, type TransactionsParams } from "./search-params";

/** The ui pager reports page changes through a callback, so navigation lives in this client wrapper. */
export function TransactionsPager({
  params,
  pageCount,
}: {
  params: TransactionsParams;
  pageCount: number;
}) {
  const router = useRouter();
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4">
      <DataTablePager
        page={params.page}
        pageCount={pageCount}
        onPageChange={(page) =>
          router.push(transactionsHref({ ...params, page }))
        }
      />
    </div>
  );
}
