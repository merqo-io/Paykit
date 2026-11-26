"use client";

import { useState } from "react";

import { CONTAINER, SECTION_PAD_Y } from "./rhythm";

type Status = "pending" | "claimed" | "confirmed";

// Same labels and tones as the dashboard's TransactionStatusBadge.
const STATUS: Record<Status, { label: string; className: string }> = {
  pending: {
    label: "Awaiting payment",
    className: "border-secondary/35 bg-secondary/12 text-secondary",
  },
  claimed: {
    label: "Marked paid",
    className: "border-mint/35 bg-mint/12 text-mint",
  },
  confirmed: {
    label: "Received",
    className: "border-primary/35 bg-primary/12 text-primary-text",
  },
};

const LEDGER: readonly {
  ref: string;
  amount: string;
  status: Status;
  at: string;
}[] = [
  { ref: "A82F", amount: "S$7.80", status: "confirmed", at: "26 Nov, 12:41" },
  { ref: "A82E", amount: "S$12.40", status: "claimed", at: "26 Nov, 12:38" },
  { ref: "A82D", amount: "S$5.60", status: "pending", at: "26 Nov, 12:36" },
  { ref: "A82C", amount: "S$9.00", status: "confirmed", at: "26 Nov, 12:30" },
  { ref: "A829", amount: "S$18.20", status: "confirmed", at: "26 Nov, 12:12" },
];

// Seven days of sample revenue in dollars; the tiles below are derived from it.
const DAYS: readonly { day: string; sgd: number }[] = [
  { day: "Fri", sgd: 62 },
  { day: "Sat", sgd: 48 },
  { day: "Sun", sgd: 71 },
  { day: "Mon", sgd: 39 },
  { day: "Tue", sgd: 88 },
  { day: "Wed", sgd: 55 },
  { day: "Thu", sgd: 49.6 },
];
const PAYMENTS = 38;

const total = DAYS.reduce((sum, d) => sum + d.sgd, 0);
const money = (n: number) => `S$${n.toFixed(2)}`;

const POINTS = [
  {
    title: "One ledger for every payment.",
    body: "Each payment across every kit sits in one list with its status. Search by reference.",
  },
  {
    title: "Reports from confirmed payments.",
    body: "Total revenue, payments and average per day, with a chart by day. Download the year as a CSV for your own records.",
  },
  {
    title: "Refunds are recorded, not paid.",
    body: "Refund tracking is on paid plans. You refund from your own bank, and paykit keeps the note.",
  },
];

function Ledger() {
  const [q, setQ] = useState("");
  const rows = LEDGER.filter((r) =>
    r.ref.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div className="min-w-0">
      <label className="block">
        <span className="text-sm font-medium text-muted-foreground">
          Search sample payments
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="A82"
          className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </label>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <caption className="sr-only">Sample payments ledger</caption>
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Kit</th>
              <th className="px-3 py-2.5 font-medium">Reference</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.ref}>
                <td className="px-3 py-2.5">qkit</td>
                <td className="px-3 py-2.5 font-mono">{r.ref}</td>
                <td className="px-3 py-2.5 text-right font-mono">{r.amount}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status].className}`}
                  >
                    {STATUS[r.status].label}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                  {r.at}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No payments match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Report() {
  const max = Math.max(...DAYS.map((d) => d.sgd));
  const tiles = [
    ["Total revenue", money(total)],
    ["Payments", String(PAYMENTS)],
    ["Avg / day", money(total / DAYS.length)],
  ];
  return (
    <div className="min-w-0">
      <dl className="grid grid-cols-3 gap-3">
        {tiles.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-lg border border-border p-2.5 sm:p-3"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-mono text-sm font-bold sm:text-lg">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div
        role="img"
        aria-label="Sample bar chart of revenue by day over seven days"
        className="mt-3 flex h-40 items-end gap-2 rounded-lg border border-border p-3"
      >
        {DAYS.map((d) => (
          <div
            key={d.day}
            className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5"
          >
            <div
              className="w-full rounded-t-sm bg-mint"
              style={{ height: `${(d.sgd / max) * 100}%` }}
            />
            <span className="text-center text-[11px] text-muted-foreground">
              {d.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AfterPayment() {
  return (
    <section id="after" className={`scroll-mt-20 border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <h2 className="max-w-[20ch] text-balance font-display text-[clamp(32px,4.2vw,52px)] font-semibold leading-[1.05] tracking-[-0.015em]">
          After the payment, a record.
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Sample data, drawn from the screens paykit gives a vendor.
        </p>
        <div className="mt-10 grid gap-10 min-[960px]:grid-cols-[1.3fr_1fr] min-[960px]:gap-14">
          <div className="min-w-0 space-y-6">
            <Ledger />
            <Report />
          </div>
          <ol className="divide-y divide-border border-y border-border min-[960px]:self-start">
            {POINTS.map((p, i) => (
              <li key={p.title} className="flex gap-4 py-6">
                <span className="w-6 shrink-0 font-display text-2xl font-semibold tabular-nums text-success">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-muted-foreground">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
