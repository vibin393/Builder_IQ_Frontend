"use client";

import { useState } from "react";

import {
  Badge,
  Card,
  ErrorNote,
  Loading,
  PageHeader,
  StatTile,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { BuyerInvoice } from "@/types/api";

export default function MyInvoicesPage() {
  const inv = useAsync(() => api.homeownerInvoices(), []);
  const [openId, setOpenId] = useState<string | null>(null);

  if (inv.loading) return <Loading label="Loading your invoices" />;
  if (inv.error) return <ErrorNote message={inv.error} />;

  const rows = inv.data ?? [];
  const outstanding = rows
    .filter((r) => !r.is_paid)
    .reduce((s, r) => s + Number(r.balance_due), 0);
  const invoiced = rows.reduce((s, r) => s + Number(r.total_price), 0);
  const paid = rows.reduce((s, r) => s + Number(r.amount_paid), 0);

  return (
    <>
      <PageHeader title="My invoices" subtitle="What you have been invoiced, paid, and still owe." />

      {rows.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
            You have no invoices yet.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatTile label="Invoiced to date" value={money(invoiced)} />
            <StatTile label="Paid" value={money(paid)} tone="ok" />
            <StatTile
              label="Balance due"
              value={money(outstanding)}
              tone={outstanding > 0 ? "warn" : "ok"}
            />
          </div>

          <div className="grid gap-4">
            {rows.map((r) => (
              <InvoiceCard
                key={r.id}
                row={r}
                open={openId === r.id}
                onToggle={() => setOpenId(openId === r.id ? null : r.id)}
              />
            ))}
          </div>

          <p className="mt-6 text-xs" style={{ color: "var(--fg-subtle)" }}>
            To make a payment, contact your builder. Online card payment is coming soon.
          </p>
        </>
      )}
    </>
  );
}

function InvoiceCard({
  row,
  open,
  onToggle,
}: {
  row: BuyerInvoice;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={onToggle}>
        <div>
          <div className="text-base font-semibold">
            {row.title}{" "}
            <span className="text-xs font-normal" style={{ color: "var(--fg-subtle)" }}>
              {row.invoice_number} · {titleCase(row.kind)}
            </span>
          </div>
          {row.due_date && (
            <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              Due {day(row.due_date)}
            </div>
          )}
        </div>
        <div className="text-right">
          <StatusBadge status={row.status} />
          <div className="tnum mt-1 text-sm font-semibold">{money(row.balance_due)}</div>
          <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            balance due
          </div>
        </div>
      </button>

      {open && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          {row.invoice_description && <p className="mb-3 text-sm">{row.invoice_description}</p>}

          {row.lines.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--fg-subtle)" }}>
                  <th className="pb-1 text-left font-medium">Item</th>
                  <th className="pb-1 text-right font-medium">Qty</th>
                  <th className="pb-1 text-right font-medium">Price</th>
                  <th className="pb-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {row.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1">{l.description}</td>
                    <td className="num py-1 text-right">
                      {l.quantity}
                      {l.unit ? ` ${l.unit}` : ""}
                    </td>
                    <td className="num py-1 text-right">{money(l.unit_price)}</td>
                    <td className="num py-1 text-right">{money(l.extended_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-3 space-y-1 text-sm">
            <Row label="Total" value={money(row.total_price)} />
            {Number(row.tax_amount) > 0 && <Row label="Tax (incl.)" value={money(row.tax_amount)} />}
            {Number(row.retainage_amount) > 0 && (
              <Row label="Retainage held" value={money(row.retainage_amount)} />
            )}
            <Row label="Paid" value={money(row.amount_paid)} />
            <Row label="Balance due" value={<strong>{money(row.balance_due)}</strong>} />
            {row.payment_terms && <Row label="Terms" value={row.payment_terms} />}
          </div>

          {row.payments.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
                Payments
              </div>
              {row.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {day(p.paid_on)} · {titleCase(p.method)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="num">{money(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {row.closing_text && (
            <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
              {row.closing_text}
            </p>
          )}
          {row.is_paid && (
            <div className="mt-3">
              <Badge tone="ok">Paid in full</Badge>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="tnum text-right">{value}</span>
    </div>
  );
}
