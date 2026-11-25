"use client";

import { useRouter } from "next/navigation";
import { DataTablePager } from "@merqo/ui";
import { listHref } from "./list-params";

/** Page links keep the active filters so paging never drops a search. */
export function ListPager({
  path,
  params,
  page,
  pageCount,
}: {
  path: string;
  params: Record<string, string>;
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  if (pageCount <= 1) return null;
  return (
    <DataTablePager
      page={page}
      pageCount={pageCount}
      onPageChange={(next) =>
        router.push(listHref(path, { ...params, page: next }))
      }
    />
  );
}
