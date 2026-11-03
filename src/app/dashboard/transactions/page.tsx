import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { listTransactions } from "@/lib/transactions";
import { TransactionTable } from "./transaction-table";

export const metadata: Metadata = {
  title: "Transactions",
};

export default async function TransactionsPage() {
  const { supabase, user } = await getVendorSession();

  const plan = await readVendorPlan(supabase, user.id);
  const transactions = await listTransactions(user.id);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your 200 most recent checkouts across every kit. Earnings reports
        include your full history.
      </p>
      <div className="mt-6">
        <TransactionTable transactions={transactions} isPro={plan === "pro"} />
      </div>
    </div>
  );
}
