"use client";

/**
 * Owner (client) invoices — the receivables side.
 *
 * The existing Invoices screen is vendor bills: money the builder owes. This is
 * its mirror — money the owner owes: deposits, progress draws and the final
 * payment. Balances are driven by recorded payments, so the status always matches
 * the cash that has actually come in.
 */

import { useEffect, useState } from "react";

import { useConfirm } from "@/components/feedback";
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
  StatTile,
  Tabs,
  Tone,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Job, OwnerInvoice, OwnerInvoiceStatus } from "@/types/api";

type Filter = "all" | OwnerInvoiceStatus;
const FILTERS: readonly Filter[] = ["all", "draft", "sent", "partial", "paid", "void"] as const;

function statusTone(s: OwnerInvoiceStatus): Tone {
  return s === "paid" ? "ok" : s === "void" ? "neutral" : s === "partial" ? "warn" : s === "draft" ? "neutral" : "brand";
}
function jobLabel(j: Job): string {
  return j.elevation ? `${j.job_number} · ${j.elevation}` : j.job_number;
}

export default function ClientInvoicesPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const jobs = useAsync(() => api.jobOptions(), []);
  const [jobId, setJobId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    if (!jobId && jobs.data?.length) setJobId(jobs.data[0].id);
  }, [jobs.data, jobId]);

  const jobParam = jobId || undefined;
  const summary = useAsync(() => api.ownerInvoiceSummary(jobParam), [jobId]);
  const rows = useAsync(
    () => api.listOwnerInvoices({ job_id: jobParam, invoice_status: filter === "all" ? undefined : filter, size: 100 }),
    [jobId, filter],
  );
  const reload = () => { summary.reload(); rows.reload(); };

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", kind: "progress", subtotal: "", tax_amount: "", retainage_amount: "", due_date: "" });
  const [busy, setBusy] = useState(false);

  // payment-schedule generator
  const [schedOpen, setSchedOpen] = useState(false);
  const [sched, setSched] = useState({
    contract_amount: "", deposit_percent: "10", progress_count: "3", final_percent: "10", interval_days: "30", retainage_percent: "0", first_due: "",
  });
  async function generateSchedule() {
    if (!jobId) return;
    setBusy(true);
    try {
      const created = await api.generatePaymentSchedule({
        job_id: jobId,
        contract_amount: sched.contract_amount ? Number(sched.contract_amount) : null,
        deposit_percent: Number(sched.deposit_percent) || 0,
        progress_count: Number(sched.progress_count) || 0,
        final_percent: Number(sched.final_percent) || 0,
        interval_days: Number(sched.interval_days) || 30,
        retainage_percent: Number(sched.retainage_percent) || 0,
        first_due: sched.first_due || null,
      });
      toast.success(`Created ${created.length} draft invoices`, "Review, then send each one.");
      setSchedOpen(false);
      reload();
    } catch (e) { toast.error("Could not generate schedule", e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  // payment modal
  const [payFor, setPayFor] = useState<OwnerInvoice | null>(null);
  const [pay, setPay] = useState({ amount: "", method: "check", reference: "" });

  // line-item builder
  const [lining, setLining] = useState<OwnerInvoice | null>(null);
  const lineDetail = useAsync(() => (lining ? api.getOwnerInvoice(lining.id) : Promise.resolve(null)), [lining?.id]);
  const [line, setLine] = useState({ description: "", unit: "", quantity: "1", unit_cost: "", markup_percent: "" });

  async function addLine() {
    if (!lining || !line.description.trim()) { toast.error("A description is required."); return; }
    try {
      await api.addInvoiceLine(lining.id, {
        description: line.description.trim(), unit: line.unit || null,
        quantity: Number(line.quantity) || 1, unit_cost: Number(line.unit_cost) || 0, markup_percent: Number(line.markup_percent) || 0,
      });
      setLine({ description: "", unit: "", quantity: "1", unit_cost: "", markup_percent: "" });
      lineDetail.reload(); reload();
    } catch (e) { toast.error("Could not add line", e instanceof Error ? e.message : undefined); }
  }
  async function removeLine(lineId: string) {
    try { await api.deleteInvoiceLine(lineId); lineDetail.reload(); reload(); }
    catch (e) { toast.error("Could not remove line", e instanceof Error ? e.message : undefined); }
  }

  async function createInvoice() {
    if (!jobId || !form.title.trim()) { toast.error("A title is required."); return; }
    setBusy(true);
    try {
      await api.createOwnerInvoice({
        job_id: jobId,
        title: form.title.trim(),
        kind: form.kind,
        subtotal: Number(form.subtotal) || 0,
        tax_amount: Number(form.tax_amount) || 0,
        retainage_amount: Number(form.retainage_amount) || 0,
        due_date: form.due_date || null,
      });
      toast.success("Invoice created");
      setCreateOpen(false);
      setForm({ title: "", kind: "progress", subtotal: "", tax_amount: "", retainage_amount: "", due_date: "" });
      reload();
    } catch (err) { toast.error("Could not create", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  async function send(inv: OwnerInvoice) {
    try { await api.sendOwnerInvoice(inv.id); toast.success("Invoice sent"); reload(); }
    catch (err) { toast.error("Could not send", err instanceof Error ? err.message : undefined); }
  }
  function voidInv(inv: OwnerInvoice) {
    confirm({ title: "Void invoice?", body: `${inv.invoice_number} will be marked void.`, confirmLabel: "Void", tone: "danger",
      onConfirm: async () => { try { await api.voidOwnerInvoice(inv.id); toast.success("Voided"); reload(); } catch (e) { toast.error("Could not void", e instanceof Error ? e.message : undefined); } } });
  }
  function remove(inv: OwnerInvoice) {
    confirm({ title: "Delete invoice?", body: `${inv.invoice_number} will be permanently removed.`, confirmLabel: "Delete", tone: "danger",
      onConfirm: async () => { try { await api.deleteOwnerInvoice(inv.id); toast.success("Deleted"); reload(); } catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); } } });
  }
  async function submitPayment() {
    if (!payFor) return;
    const amt = Number(pay.amount);
    if (!amt || amt <= 0) { toast.error("Enter a payment amount."); return; }
    setBusy(true);
    try {
      await api.recordOwnerPayment(payFor.id, { amount: amt, method: pay.method, reference: pay.reference || null });
      toast.success("Payment recorded");
      setPayFor(null); setPay({ amount: "", method: "check", reference: "" });
      reload();
    } catch (err) { toast.error("Could not record payment", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Client invoices"
        subtitle="Bill the homeowner — deposits, progress draws and the final payment — and record what comes in."
        action={
          <div className="flex items-center gap-2">
            <select className="input w-auto max-w-[16rem]" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Home">
              {(jobs.data ?? []).map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
            </select>
            <button className="btn btn-ghost" disabled={!jobId} onClick={() => setSchedOpen(true)}>Generate schedule</button>
            <button className="btn btn-primary" disabled={!jobId} onClick={() => setCreateOpen(true)}>New invoice</button>
          </div>
        }
      />
      {jobs.error && <ErrorNote message={jobs.error} />}

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Invoiced" value={money(s.total_invoiced)} />
          <StatTile label="Paid" value={money(s.total_paid)} tone="ok" />
          <StatTile label="Outstanding" value={money(s.outstanding)} tone={Number(s.outstanding) > 0 ? "warn" : "default"} />
          <StatTile label="Overdue" value={s.overdue} tone={s.overdue ? "danger" : "default"} />
          <StatTile label="Drafts" value={s.draft} />
        </div>
      )}

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} />

      <Card padded={false}>
        {rows.loading ? <Loading /> : rows.error ? <div className="p-5"><ErrorNote message={rows.error} /></div> : (
          <DataTable
            columns={[
              { key: "num", label: "Invoice" }, { key: "title", label: "Title" }, { key: "kind", label: "Kind" },
              { key: "st", label: "Status" }, { key: "total", label: "Total", align: "right" },
              { key: "paid", label: "Paid", align: "right" }, { key: "bal", label: "Balance", align: "right" },
              { key: "due", label: "Due" }, { key: "act", label: "" },
            ]}
            empty="No client invoices for this home yet."
          >
            {(rows.data?.items ?? []).map((inv) => (
              <tr key={inv.id}>
                <td className="font-medium">{inv.invoice_number}</td>
                <td>{inv.title}</td>
                <td className="text-sm">{inv.kind}</td>
                <td><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></td>
                <td className="num tnum">{money(inv.total_price)}</td>
                <td className="num tnum">{money(inv.amount_paid)}</td>
                <td className="num tnum">{money(inv.balance_due)}</td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{inv.due_date ? day(inv.due_date) : "—"}</td>
                <td className="num">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn btn-sm btn-ghost" onClick={() => setLining(inv)}>Lines{inv.lines.length ? ` (${inv.lines.length})` : ""}</button>
                    {inv.status === "draft" && <button className="btn btn-sm btn-primary" onClick={() => send(inv)}>Send</button>}
                    {inv.status !== "draft" && inv.status !== "void" && inv.status !== "paid" && (
                      <button className="btn btn-sm btn-primary" onClick={() => setPayFor(inv)}>Record payment</button>
                    )}
                    {inv.status !== "void" && inv.status !== "paid" && inv.status !== "draft" && (
                      <button className="btn btn-sm btn-ghost" onClick={() => voidInv(inv)}>Void</button>
                    )}
                    {Number(inv.amount_paid) === 0 && (
                      <button className="btn btn-sm btn-ghost" onClick={() => remove(inv)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {/* payment-schedule generator */}
      <Modal open={schedOpen} title="Generate payment schedule" onClose={() => setSchedOpen(false)}>
        {(() => {
          const amt = Number(sched.contract_amount);
          const dep = (amt * (Number(sched.deposit_percent) || 0)) / 100;
          const fin = (amt * (Number(sched.final_percent) || 0)) / 100;
          const n = Number(sched.progress_count) || 0;
          const each = n > 0 ? (amt - dep - fin) / n : 0;
          return (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                Creates a deposit, equal progress draws and a final payment as <strong>draft</strong> invoices. Leave the
                amount blank to split this home’s contract total.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Field label="Contract amount" hint="blank = use contract total">
                  <input className="input" type="number" value={sched.contract_amount} onChange={(e) => setSched({ ...sched, contract_amount: e.target.value })} placeholder="auto" />
                </Field>
                <Field label="Deposit %"><input className="input" type="number" value={sched.deposit_percent} onChange={(e) => setSched({ ...sched, deposit_percent: e.target.value })} /></Field>
                <Field label="Final %"><input className="input" type="number" value={sched.final_percent} onChange={(e) => setSched({ ...sched, final_percent: e.target.value })} /></Field>
                <Field label="Progress draws"><input className="input" type="number" value={sched.progress_count} onChange={(e) => setSched({ ...sched, progress_count: e.target.value })} /></Field>
                <Field label="Days apart"><input className="input" type="number" value={sched.interval_days} onChange={(e) => setSched({ ...sched, interval_days: e.target.value })} /></Field>
                <Field label="Retainage %"><input className="input" type="number" value={sched.retainage_percent} onChange={(e) => setSched({ ...sched, retainage_percent: e.target.value })} /></Field>
              </div>
              <Field label="First invoice due"><input className="input" type="date" value={sched.first_due} onChange={(e) => setSched({ ...sched, first_due: e.target.value })} /></Field>
              {amt > 0 && (
                <div className="rounded-lg p-3 text-sm" style={{ background: "var(--neutral-soft)" }}>
                  <div className="mb-1 font-medium">Preview</div>
                  <div className="flex justify-between"><span>Deposit ({sched.deposit_percent}%)</span><span className="tnum">{money(dep)}</span></div>
                  {n > 0 && <div className="flex justify-between"><span>{n} × progress draw</span><span className="tnum">{money(each)} each</span></div>}
                  <div className="flex justify-between"><span>Final ({sched.final_percent}%)</span><span className="tnum">{money(fin)}</span></div>
                </div>
              )}
            </div>
          );
        })()}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setSchedOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={generateSchedule}>{busy ? "Generating…" : "Generate"}</button>
        </div>
      </Modal>

      {/* create modal */}
      <Modal open={createOpen} title="New client invoice" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Progress Payment #1" autoFocus /></Field>
          <Field label="Kind">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="deposit">Deposit</option><option value="progress">Progress</option><option value="final">Final</option><option value="standard">Standard</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Subtotal"><input className="input" type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></Field>
            <Field label="Tax"><input className="input" type="number" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} /></Field>
            <Field label="Retainage"><input className="input" type="number" value={form.retainage_amount} onChange={(e) => setForm({ ...form, retainage_amount: e.target.value })} /></Field>
          </div>
          <Field label="Due date"><input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={createInvoice}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </Modal>

      {/* payment modal */}
      <Modal open={payFor !== null} title={`Record payment — ${payFor?.invoice_number ?? ""}`} onClose={() => setPayFor(null)}>
        {payFor && (
          <p className="mb-4 text-sm" style={{ color: "var(--fg-muted)" }}>
            Balance due: <strong>{money(payFor.balance_due)}</strong>
          </p>
        )}
        <div className="space-y-3">
          <Field label="Amount"><input className="input" type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} autoFocus /></Field>
          <Field label="Method">
            <select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
              <option value="check">Check</option><option value="card">Card</option><option value="ach">ACH</option><option value="cash">Cash</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="Reference" hint="Optional — check number, confirmation, etc."><input className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setPayFor(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={submitPayment}>{busy ? "Saving…" : "Record payment"}</button>
        </div>
      </Modal>

      {/* line-item builder */}
      <Modal open={lining !== null} title={`Line items — ${lining?.invoice_number ?? ""}`} onClose={() => setLining(null)}>
        {lineDetail.loading ? <Loading variant="text" /> : lineDetail.data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
                {lineDetail.data.lines.length} line{lineDetail.data.lines.length === 1 ? "" : "s"}
                {lineDetail.data.lines.length === 0 && " — the flat subtotal is used"}
              </span>
              <span className="text-lg font-semibold">Subtotal {money(lineDetail.data.effective_subtotal)}</span>
            </div>
            <div className="max-h-[40vh] overflow-auto">
              <DataTable
                columns={[
                  { key: "d", label: "Item" }, { key: "q", label: "Qty", align: "right" },
                  { key: "uc", label: "Unit cost", align: "right" }, { key: "mu", label: "Markup", align: "right" },
                  { key: "ep", label: "Client price", align: "right" }, { key: "x", label: "" },
                ]}
                empty="No line items yet. Add one below, or set a flat subtotal on the invoice."
              >
                {lineDetail.data.lines.map((ln) => (
                  <tr key={ln.id}>
                    <td>{ln.description}{ln.unit ? <span className="ml-1 text-xs" style={{ color: "var(--fg-subtle)" }}>/ {ln.unit}</span> : null}</td>
                    <td className="num tnum">{Number(ln.quantity)}</td>
                    <td className="num tnum">{money(ln.unit_cost)}</td>
                    <td className="num tnum">{Number(ln.markup_percent)}%</td>
                    <td className="num tnum">{money(ln.extended_price)}</td>
                    <td className="num">{lining?.status !== "paid" && lining?.status !== "void" && <button className="btn btn-sm btn-ghost" onClick={() => removeLine(ln.id)}>×</button>}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
            {lining?.status !== "paid" && lining?.status !== "void" && (
              <div className="rounded-lg p-3" style={{ background: "var(--neutral-soft)" }}>
                <div className="grid gap-2 sm:grid-cols-6">
                  <input className="input sm:col-span-2" placeholder="Description" value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} />
                  <input className="input" placeholder="Unit" value={line.unit} onChange={(e) => setLine({ ...line, unit: e.target.value })} />
                  <input className="input" type="number" placeholder="Qty" value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} />
                  <input className="input" type="number" placeholder="Unit cost" value={line.unit_cost} onChange={(e) => setLine({ ...line, unit_cost: e.target.value })} />
                  <input className="input" type="number" placeholder="Markup %" value={line.markup_percent} onChange={(e) => setLine({ ...line, markup_percent: e.target.value })} />
                </div>
                <div className="mt-3 flex justify-end"><button className="btn btn-sm btn-primary" onClick={addLine}>Add line</button></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {dialog}
    </div>
  );
}
