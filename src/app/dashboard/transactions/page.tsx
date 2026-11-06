import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { listTransactions } from "@/lib/transactions";
import { PageHeader } from "@/components/page-header";
import { TransactionTable } from "./transaction-table";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function TransactionsPage() {
  const { supabase, user } = await getVendorSession();

  const plan = await readVendorPlan(supabase, user.id);
  const transactions = await listTransactions(user.id);

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Payments"
        description="Your 200 most recent payments across every kit. Earnings reports include your full history."
      />
      <TransactionTable transactions={transactions} isPro={plan === "pro"} />
    </div>
  );
}
