"use client";

import Link from "next/link";
import { useState } from "react";

import { BilledBar } from "@/components/BilledBar";
import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/feedback";
import { useIssuePurchaseOrder } from "@/components/IssuePurchaseOrder";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  StatusBadge,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";

const STATUSES = ["", "draft", "issued", "acknowledged", "complete", "void"];

export default function PurchaseOrdersPage() {
  const [status, setStatus] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const pos = useAsync(
    () =>
      api.listPurchaseOrders({
        status: status || undefined,
        job_id: jobFilter || undefined,
        vendor_id: vendorFilter || undefined,
        overdue_only: overdueOnly || undefined,
      }),
    [status, jobFilter, vendorFilter, overdueOnly],
  );
  const summary = useAsync(() => api.purchaseOrderSummary(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const [newOpen, setNewOpen] = useState(false);

  const reloadAll = () => {
    pos.reload();
    summary.reload();
  };
  const { issue, dialog } = useIssuePurchaseOrder(reloadAll);

  const vendor = byId(vendors.data);
  const job = byId(jobs.data);
  const all = pos.data ?? [];
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Issuing a PO is the moment money becomes committed. Drafts are not commitments. A trade that is not cleared, or a PO that breaks the budget, is refused — and any override is written onto the PO with the reason."
        action={
          <Button variant="primary" icon="purchaseOrders" onClick={() => setNewOpen(true)}>
            New purchase order
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Committed"
          value={s ? <AnimatedNumber value={Number(s.committed)} format={(v) => money(v)} /> : "—"}
          hint="Issued, acknowledged or complete"
        />
        <StatTile
          label="Billed to date"
          value={s ? money(s.billed_to_date) : "—"}
          tone="ok"
          hint={s ? `${money(s.remaining_to_bill)} still to be invoiced` : undefined}
        />
        <StatTile
          label="Drafts"
          value={s?.drafts ?? "—"}
          hint={s ? `${money(s.draft_value)} not yet committed` : undefined}
        />
        <StatTile
          label="Open"
          value={s?.open ?? "—"}
          hint={s ? `${s.awaiting_acknowledgement} awaiting the trade's acknowledgement` : undefined}
        />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Late"
          value={s?.overdue ?? "—"}
          tone={s?.overdue ? "danger" : "ok"}
          hint="Past required-by, still open"
        />
        <StatTile
          label="Issued with an override"
          value={s?.overrides ?? "—"}
          tone={s?.overrides ? "warn" : "ok"}
          hint="Compliance or budget gate overridden"
        />
        <StatTile label="Total POs" value={s?.total ?? "—"} />
        <StatTile label="Void" value={s?.by_status.void ?? 0} hint="Released back to budget" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((st) => (
          <button
            key={st || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setStatus(st)}
            style={status === st ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {st === "" ? "All" : st}
            {st && s?.by_status[st] ? ` (${s.by_status[st]})` : ""}
          </button>
        ))}
        <span className="mx-1" />
        <select className="input" style={{ width: "auto" }} value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
          <option value="">All homes</option>
          {(jobs.data ?? []).map((j) => (
            <option key={j.id} value={j.id}>{j.job_number}</option>
          ))}
        </select>
        <select className="input" style={{ width: "auto" }} value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
          <option value="">All trades</option>
          {(vendors.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Late only
        </label>
      </div>

      <Card padded={false}>
        {pos.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "po", label: "PO" },
              { key: "job", label: "Home" },
              { key: "vendor", label: "Trade" },
              { key: "status", label: "Status" },
              { key: "req", label: "Required by" },
              { key: "total", label: "Total", align: "right" },
              { key: "billed", label: "Billed" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No purchase orders."
          >
            {all.map((po) => (
              <tr key={po.id} style={po.is_overdue ? { background: "var(--danger-soft)" } : undefined}>
                <td className="font-medium">
                  <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                    {po.po_number}
                  </Link>
                </td>
                <td>
                  <Link href={`/jobs/${po.job_id}`} style={{ color: "var(--brand)" }}>
                    {job.get(po.job_id)?.job_number ?? "—"}
                  </Link>
                </td>
                <td>{vendor.get(po.vendor_id)?.name ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={po.status} />
                    {(po.compliance_override || po.budget_override) && (
                      <Badge tone="warn">Override</Badge>
                    )}
                    {po.is_overdue && <Badge tone="danger">Late</Badge>}
                  </div>
                </td>
                <td className="text-sm">{day(po.required_by)}</td>
                <td className="num">{money(po.total)}</td>
                <td>{po.status === "draft" || po.status === "void" ? <span style={{ color: "var(--fg-subtle)" }}>—</span> : <BilledBar po={po} />}</td>
                <td className="num">
                  <div className="flex justify-end gap-1">
                    {po.status === "draft" && (
                      <Button variant="primary" size="sm" onClick={() => issue(po)}>
                        Issue
                      </Button>
                    )}
                    <Link href={`/purchase-orders/${po.id}`} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <NewPurchaseOrder
        open={newOpen}
        jobs={jobs.data ?? []}
        vendors={vendors.data ?? []}
        onClose={() => setNewOpen(false)}
        onDone={() => {
          setNewOpen(false);
          reloadAll();
        }}
      />
      {dialog}
    </>
  );
}

type LineDraft = { cost_code_id: string; amount: string; description: string };

/** Draft a PO with the job's remaining budget per cost code in view as you type. */
function NewPurchaseOrder({
  open,
  jobs,
  vendors,
  onClose,
  onDone,
}: {
  open: boolean;
  jobs: { id: string; job_number: string }[];
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ cost_code_id: "", amount: "", description: "" }]);
  const [retainage, setRetainage] = useState("0");
  const [requiredBy, setRequiredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = useAsync(() => (jobId ? api.jobCost(jobId) : Promise.resolve(null)), [jobId]);
  const codes = useAsync(() => api.listCostCodes(), []);
  const budget = new Map((cost.data?.lines ?? []).map((l) => [l.cost_code_id, l]));

  const total = lines.reduce((t, l) => t + (Number(l.amount) || 0), 0);

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = lines.filter((l) => l.cost_code_id && Number(l.amount) > 0);
    if (clean.length === 0) {
      setError("Add at least one line with a cost code and an amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createPurchaseOrder({
        job_id: jobId,
        vendor_id: vendorId,
        lines: clean.map((l) => ({ cost_code_id: l.cost_code_id, amount: l.amount, description: l.description || undefined })),
        retainage_percent: retainage,
        required_by: requiredBy || undefined,
        notes: notes || undefined,
      });
      setLines([{ cost_code_id: "", amount: "", description: "" }]);
      setNotes("");
      setRequiredBy("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the purchase order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="New purchase order" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home">
            <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
              <option value="">Select…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.job_number}</option>
              ))}
            </select>
          </Field>
          <Field label="Trade">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              <option value="">Select…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">Lines</p>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const b = budget.get(l.cost_code_id);
              const over = b && Number(l.amount) > Number(b.uncommitted);
              return (
                <div key={i} className="rounded-lg p-2" style={{ background: "var(--surface-2)" }}>
                  <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_auto]">
                    <select className="input" value={l.cost_code_id} onChange={(e) => setLine(i, { cost_code_id: e.target.value })}>
                      <option value="">Cost code…</option>
                      {(codes.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                    <input className="input text-right" inputMode="decimal" placeholder="0.00" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                    <button type="button" className="btn btn-ghost btn-sm" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </div>
                  <input className="input mt-2" placeholder="Description (optional)" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  {b && (
                    <p className="mt-1 text-xs" style={{ color: over ? "var(--danger)" : "var(--fg-subtle)" }}>
                      {money(b.uncommitted)} uncommitted on this code
                      {over ? " — this line breaks the budget and will need an override to issue" : ""}
                    </p>
                  )}
                  {jobId && l.cost_code_id && !b && (
                    <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>Not in this home&apos;s budget.</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((ls) => [...ls, { cost_code_id: "", amount: "", description: "" }])}>
              Add a line
            </button>
            <span className="text-sm">
              Total <strong className="tnum">{money(total)}</strong>
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Required by" hint="When the materials or work are needed.">
            <input type="date" className="input" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
          </Field>
          <Field label="Retainage %" hint="Held from each payment. 0 for materials.">
            <input className="input" inputMode="decimal" value={retainage} onChange={(e) => setRetainage(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save as draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
