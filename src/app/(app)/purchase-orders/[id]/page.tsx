"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { BilledBar } from "@/components/BilledBar";
import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { useIssuePurchaseOrder } from "@/components/IssuePurchaseOrder";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { PurchaseOrder } from "@/types/api";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span style={{ color: "var(--fg-subtle)" }}>{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const po = useAsync(() => api.getPurchaseOrder(id), [id]);
  const invoices = useAsync(() => api.listInvoices({ purchase_order_id: id }), [id]);
  const vendors = useAsync(() => api.listVendors(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const users = useAsync(() => api.listUsers().then((p) => p.items), []);
  const toast = useToast();
  const { confirm: ask, dialog: confirmDialog } = useConfirm();
  const [editing, setEditing] = useState(false);

  const reload = () => {
    po.reload();
    invoices.reload();
  };
  const { issue, dialog: issueDialog } = useIssuePurchaseOrder(reload);

  if (po.loading) return <Loading label="Loading purchase order" variant="text" />;
  if (!po.data) return <ErrorNote message={po.error ?? "Not found"} />;

  const p = po.data;
  const vendor = byId(vendors.data);
  const job = byId(jobs.data);
  const code = byId(codes.data);
  const user = byId(users.data);

  async function act(fn: () => Promise<unknown>, success: string, fail: string) {
    await toast.promise(fn(), { success, error: fail });
    reload();
  }

  function askVoid() {
    ask({
      title: `Void ${p.po_number}?`,
      tone: "danger",
      confirmLabel: "Void",
      body: `${money(p.total)} of committed cost is released back to the budget. Voiding cannot be undone.`,
      onConfirm: () => act(() => api.voidPurchaseOrder(p.id), `${p.po_number} voided`, "Could not void"),
    });
  }

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/purchase-orders" className="hover:underline" style={{ color: "var(--fg-muted)" }}>
          ← All purchase orders
        </Link>
      </div>
      <PageHeader
        title={`${p.po_number} — ${vendor.get(p.vendor_id)?.name ?? "Trade"}`}
        subtitle={[job.get(p.job_id)?.job_number, p.notes].filter(Boolean).join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {p.is_overdue && <Badge tone="danger">Late</Badge>}
            {(p.compliance_override || p.budget_override) && <Badge tone="warn">Issued with override</Badge>}
            <StatusBadge status={p.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Lines"
            padded={false}
            action={
              p.status === "draft" ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                  Edit draft
                </button>
              ) : undefined
            }
          >
            <DataTable
              columns={[
                { key: "code", label: "Cost code" },
                { key: "desc", label: "Description" },
                { key: "amt", label: "Amount", align: "right" },
              ]}
            >
              {p.lines.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">
                    {code.get(l.cost_code_id)?.code ?? "—"}
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {code.get(l.cost_code_id)?.name}
                    </div>
                  </td>
                  <td style={{ color: "var(--fg-muted)" }}>{l.description ?? "—"}</td>
                  <td className="num tnum">{money(l.amount)}</td>
                </tr>
              ))}
            </DataTable>
            <div className="flex justify-end gap-6 px-5 py-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--fg-muted)" }}>
                Retainage {Number(p.retainage_percent)}% = {money(p.retainage_on_total)}
              </span>
              <span>
                Total <strong className="tnum">{money(p.total)}</strong>
              </span>
            </div>
          </Card>

          <Card title={`Invoices against this PO (${(invoices.data ?? []).length})`} padded={false}>
            {invoices.loading ? (
              <Loading />
            ) : (
              <DataTable
                columns={[
                  { key: "no", label: "Invoice" },
                  { key: "date", label: "Date" },
                  { key: "status", label: "Status" },
                  { key: "ret", label: "Retained", align: "right" },
                  { key: "total", label: "Total", align: "right" },
                ]}
                empty={
                  ["draft", "void"].includes(p.status)
                    ? "Invoices can only be received once the PO is issued."
                    : "Nothing invoiced yet."
                }
              >
                {(invoices.data ?? []).map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium">
                      <Link href="/invoices" className="hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="text-sm">{day(inv.invoice_date)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="num tnum text-sm">{money(inv.retainage_amount)}</td>
                    <td className="num tnum">{money(inv.total)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Actions">
            <div className="space-y-2">
              {p.status === "draft" && (
                <Button variant="primary" block onClick={() => issue(p)}>
                  Issue — commit the money
                </Button>
              )}
              {p.status === "issued" && (
                <Button
                  variant="ghost"
                  block
                  onClick={() =>
                    act(() => api.acknowledgePurchaseOrder(p.id), "Acknowledgement recorded", "Could not record")
                  }
                >
                  Record trade acknowledgement
                </Button>
              )}
              {["issued", "acknowledged"].includes(p.status) && (
                <Button
                  variant="ghost"
                  block
                  onClick={() => act(() => api.completePurchaseOrder(p.id), `${p.po_number} complete`, "Could not complete")}
                >
                  Mark scope complete
                </Button>
              )}
              {p.status !== "void" && (
                <Button variant="danger" block onClick={askVoid}>
                  Void
                </Button>
              )}
              {p.status === "void" && (
                <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
                  Void — its cost was released back to the budget.
                </p>
              )}
            </div>
            {p.status === "issued" && (
              <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
                The trade can also acknowledge this themselves from their portal.
              </p>
            )}
          </Card>

          {!["draft", "void"].includes(p.status) && (
            <Card title="Billing">
              <BilledBar po={p} wide />
              <div className="mt-3">
                <Row label="Committed">{money(p.total)}</Row>
                <Row label="Invoiced">{money(p.invoiced_total)}</Row>
                <Row label="Approved (actual cost)">{money(p.billed_to_date)}</Row>
                <Row label="Still to invoice">{money(p.remaining_to_bill)}</Row>
              </div>
              {Number(p.remaining_to_bill) < 0 && (
                <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
                  Invoiced beyond the commitment by {money(Math.abs(Number(p.remaining_to_bill)))}.
                </p>
              )}
            </Card>
          )}

          <Card title="Dates">
            <Row label="Required by">
              <span style={{ color: p.is_overdue ? "var(--danger)" : undefined }}>{day(p.required_by)}</span>
            </Row>
            <Row label="Issued">{day(p.issued_date)}</Row>
            {p.issued_by_id && <Row label="Issued by">{user.get(p.issued_by_id)?.full_name ?? "—"}</Row>}
            <Row label="Acknowledged">{day(p.acknowledged_on)}</Row>
            <Row label="Completed">{day(p.completed_on)}</Row>
          </Card>

          {(p.compliance_override || p.budget_override) && (
            <Card title="Override on record">
              <div className="flex flex-wrap gap-1.5">
                {p.compliance_override && <Badge tone="warn">Compliance gate</Badge>}
                {p.budget_override && <Badge tone="warn">Budget gate</Badge>}
              </div>
              <p className="mt-2 text-sm">{p.override_reason ?? "No reason was given."}</p>
              <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
                Issued past a gate that refused it, by {user.get(p.issued_by_id ?? "")?.full_name ?? "a user"} on {day(p.issued_date)}.
              </p>
            </Card>
          )}
        </div>
      </div>

      <EditDraft
        po={p}
        open={editing}
        codes={codes.data ?? []}
        onClose={() => setEditing(false)}
        onDone={() => {
          setEditing(false);
          reload();
        }}
      />
      {issueDialog}
      {confirmDialog}
    </>
  );
}

function EditDraft({
  po,
  open,
  codes,
  onClose,
  onDone,
}: {
  po: PurchaseOrder;
  open: boolean;
  codes: { id: string; code: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [lines, setLines] = useState(
    po.lines.map((l) => ({ cost_code_id: l.cost_code_id, amount: l.amount, description: l.description ?? "" })),
  );
  const [notes, setNotes] = useState(po.notes ?? "");
  const [requiredBy, setRequiredBy] = useState(po.required_by ?? "");
  const [retainage, setRetainage] = useState(po.retainage_percent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = lines.filter((l) => l.cost_code_id && Number(l.amount) > 0);
    if (clean.length === 0) {
      setError("A purchase order needs at least one line.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updatePurchaseOrder(po.id, {
        notes: notes || undefined,
        required_by: requiredBy || undefined,
        retainage_percent: retainage,
        lines: clean.map((l) => ({ ...l, description: l.description || undefined })),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={`Edit ${po.po_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1.3fr_0.8fr_auto]">
              <select
                className="input"
                value={l.cost_code_id}
                onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, cost_code_id: e.target.value } : x)))}
              >
                <option value="">Cost code…</option>
                {codes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
              <input
                className="input text-right"
                inputMode="decimal"
                value={l.amount}
                onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setLines((ls) => [...ls, { cost_code_id: "", amount: "", description: "" }])}
          >
            Add a line
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required by">
            <input type="date" className="input" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
          </Field>
          <Field label="Retainage %">
            <input className="input" inputMode="decimal" value={retainage} onChange={(e) => setRetainage(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
