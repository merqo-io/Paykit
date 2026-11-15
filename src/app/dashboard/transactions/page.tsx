import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { freeListCutoff, isPaidPlan } from "@/lib/free-limits";
import { countTransactionsBefore, listTransactions } from "@/lib/transactions";
import { PageHeader } from "@merqo/ui";
import { TransactionTable } from "./transaction-table";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function TransactionsPage() {
  const { supabase, user } = await getVendorSession();

  const isPaid = isPaidPlan(await readVendorPlan(supabase, user.id));
  const cutoff = isPaid ? undefined : freeListCutoff();
  const [transactions, hiddenCount] = await Promise.all([
    listTransactions(user.id, cutoff),
    cutoff ? countTransactionsBefore(user.id, cutoff) : 0,
  ]);

  return (
    <div>
      <PageHeader
        responsive
        eyebrow="Ledger"
        title="Payments"
        description={
          isPaid
            ? "Your 200 most recent payments across every kit. Earnings reports include your full history."
            : "Your payments from the last 30 days across every kit."
        }
      />
      <TransactionTable transactions={transactions} isPro={isPaid} />
      {hiddenCount > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Older transactions are kept and show on Starter and Pro.
        </p>
      )}
    </div>
  );
}
