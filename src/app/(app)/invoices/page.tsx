"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/Button";
import { AnimatedNumber, useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Menu,
  Modal,
  PageHeader,
  StatTile,
  StatusBadge,
  day,
  money,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { Invoice } from "@/types/api";

const STATUSES = ["", "received", "disputed", "approved", "paid", "void"] as const;

/** A view is either a status or one of the two server-derived queues. */
type View = (typeof STATUSES)[number] | "overdue" | "retention";

/** The prompt behind every decision that has to carry a reason or a reference. */
type Prompt =
  | { kind: "override"; inv: Invoice; detail: string }
  | { kind: "dispute"; inv: Invoice }
  | { kind: "pay"; inv: Invoice };

export default function InvoicesPage() {
  const [view, setView] = useState<View>("");
  const [jobFilter, setJobFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  const status = view === "overdue" || view === "retention" ? "" : view;
  const invoices = useAsync(
    () =>
      view === "retention"
        ? api.retainageHeld(jobFilter || undefined)
        : api.listInvoices({
            status: status || undefined,
            job_id: jobFilter || undefined,
            vendor_id: vendorFilter || undefined,
          }),
    [view, jobFilter, vendorFilter],
  );
  const summary = useAsync(() => api.invoiceSummary(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  const vendor = byId(vendors.data);
  const job = byId(jobs.data);
  const s = summary.data;

  let rows = invoices.data ?? [];
  if (view === "overdue") rows = rows.filter((i) => i.is_overdue);
  if (view === "retention" && vendorFilter) rows = rows.filter((i) => i.vendor_id === vendorFilter);

  function reload() {
    invoices.reload();
    summary.reload();
  }

  /** Runs an action; the toast carries any refusal, so it is not rethrown. */
  async function run(p: Promise<unknown>, success: string, error: string) {
    try {
      await toast.promise(p, { success, error });
    } catch {
      /* the toast shows the server's reason */
    }
    reload();
  }

  async function approve(inv: Invoice) {
    try {
      await api.approveInvoice(inv.id);
      toast.success(`${inv.invoice_number} approved. This is now actual cost.`);
      reload();
    } catch (err) {
      // Only the over-PO refusal can be overridden. Anything else (a dispute, an
      // invoice someone else already approved) is shown as it is, not offered an override.
      if (err instanceof ApiError && err.status === 409 && err.message.includes("allow_over_po")) {
        setPrompt({ kind: "override", inv, detail: err.message.replace(/, or approve with allow_over_po=true/, "") });
      } else {
        toast.error(err instanceof Error ? err.message : "Invoice not approved");
        reload();
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Approving an invoice turns committed cost into actual cost. Billing above the PO, paying without a waiver, or paying a disputed invoice is refused — and any override is written onto the invoice with who made it and why."
        action={
          <Button variant="primary" icon="invoices" onClick={() => setOpen(true)}>
            Receive invoice
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Actual cost"
          value={<AnimatedNumber value={Number(s?.actual_cost ?? 0)} format={(v) => money(v)} />}
          hint="Approved and paid"
        />
        <StatTile
          label="Awaiting approval"
          value={s?.awaiting_approval ?? "—"}
          tone={s?.awaiting_approval ? "warn" : "ok"}
          hint={s ? `${money(s.awaiting_value)} received${s.disputed ? ` · ${s.disputed} disputed` : ""}` : undefined}
        />
        <StatTile
          label="Approved, to pay"
          value={<AnimatedNumber value={Number(s?.approved_unpaid_value ?? 0)} format={(v) => money(v)} />}
          tone={s?.overdue_to_pay ? "danger" : "default"}
          hint={
            s
              ? s.overdue_to_pay
                ? `${s.overdue_to_pay} past terms · ${money(s.overdue_value)}`
                : `${s.approved_unpaid} invoice${s.approved_unpaid === 1 ? "" : "s"}, none late`
              : undefined
          }
        />
        <StatTile
          label="Waivers missing"
          value={s?.waivers_missing ?? "—"}
          tone={s?.waivers_missing ? "warn" : "ok"}
          hint="Approved, cannot be paid until recorded"
        />
        <StatTile
          label="Retention held"
          value={<AnimatedNumber value={Number(s?.retention_held ?? 0)} format={(v) => money(v)} />}
          tone={Number(s?.retention_held ?? 0) ? "warn" : "default"}
          hint="Certified, withheld until release"
        />
        <StatTile
          label="CIS withheld this month"
          value={<AnimatedNumber value={Number(s?.cis_withheld_this_month ?? 0)} format={(v) => money(v)} />}
          hint="Deducted on payments made, owed to HMRC"
        />
        <StatTile
          label="CIS not verified"
          value={s?.cis_unverified ?? "—"}
          tone={s?.cis_unverified ? "warn" : "ok"}
          hint="Labour billed by a trade with no CIS status — set it on Trades"
        />
        <StatTile label="Total invoices" value={s?.total ?? "—"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((st) => (
          <button
            key={st || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setView(st)}
            style={view === st ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {st === "" ? "All" : st}
            {st && s?.by_status[st] ? ` (${s.by_status[st]})` : ""}
          </button>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setView("overdue")}
          style={view === "overdue" ? { background: "var(--danger-soft)", color: "var(--danger)" } : {}}
        >
          Past terms{s?.overdue_to_pay ? ` (${s.overdue_to_pay})` : ""}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setView("retention")}
          style={view === "retention" ? { background: "var(--warn-soft)", color: "var(--warn)" } : {}}
        >
          Retention to release
        </button>
        <span className="mx-1" />
        <select className="input" style={{ width: "auto" }} value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
          <option value="">All homes</option>
          {(jobs.data ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.job_number}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: "auto" }} value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
          <option value="">All trades</option>
          {(vendors.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <Card padded={false}>
        {invoices.loading ? (
          <Loading />
        ) : invoices.error ? (
          <div className="p-4">
            <ErrorNote message={invoices.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "no", label: "Invoice" },
              { key: "job", label: "Home" },
              { key: "vendor", label: "Trade" },
              { key: "status", label: "Status" },
              { key: "waiver", label: "Lien waiver" },
              { key: "total", label: "Total", align: "right" },
              { key: "held", label: "Retention", align: "right" },
              { key: "cis", label: "CIS", align: "right" },
              { key: "net", label: "Net payable", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty={view === "retention" ? "No retention waiting to be released." : "No invoices match."}
          >
            {rows.map((inv) => (
              <tr key={inv.id} style={inv.is_overdue ? { background: "var(--danger-soft)" } : undefined}>
                <td>
                  <div className="font-medium">{inv.invoice_number}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {day(inv.invoice_date)}
                    {inv.due_date && inv.status !== "paid" && inv.status !== "void" && ` · due ${day(inv.due_date)}`}
                    {inv.paid_date && ` · paid ${day(inv.paid_date)}`}
                  </div>
                  {inv.payment_reference && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      Ref {inv.payment_reference}
                    </div>
                  )}
                </td>
                <td>
                  <Link href={`/jobs/${inv.job_id}`} style={{ color: "var(--brand)" }}>
                    {job.get(inv.job_id)?.job_number ?? "—"}
                  </Link>
                </td>
                <td>{vendor.get(inv.vendor_id)?.name ?? "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={inv.status} />
                    {inv.is_overdue && <Badge tone="danger">{inv.days_overdue}d late</Badge>}
                    {inv.over_po_override && <Badge tone="warn">Over PO</Badge>}
                  </div>
                  {inv.over_po_override && (
                    <div className="mt-1 max-w-[16rem] text-xs" style={{ color: "var(--fg-muted)" }}>
                      Override: {inv.override_reason ?? "no reason given"}
                    </div>
                  )}
                  {inv.dispute_reason && (
                    <div
                      className="mt-1 max-w-[16rem] text-xs"
                      style={{ color: inv.status === "disputed" ? "var(--danger)" : "var(--fg-subtle)" }}
                    >
                      {inv.status === "disputed" ? "Disputed" : "Was disputed"} {day(inv.disputed_on)}: {inv.dispute_reason}
                    </div>
                  )}
                </td>
                <td>
                  {inv.lien_waiver_received ? (
                    <Badge tone="ok">On file{inv.lien_waiver_date ? ` ${day(inv.lien_waiver_date)}` : ""}</Badge>
                  ) : inv.status === "void" ? (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Badge tone="warn">Missing</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        loadingText="Recording…"
                        onClick={() =>
                          run(
                            api.recordLienWaiver(inv.id),
                            `Waiver recorded on ${inv.invoice_number}`,
                            "Could not record the waiver",
                          )
                        }
                      >
                        Record
                      </Button>
                    </div>
                  )}
                </td>
                <td className="num">{money(inv.total)}</td>
                <td className="num">
                  {Number(inv.retainage_amount) > 0 ? (
                    <span style={{ color: "var(--warn)" }}>{money(inv.retainage_amount)}</span>
                  ) : inv.retainage_released_date ? (
                    <Badge tone="ok">Released</Badge>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  )}
                </td>
                <td className="num">
                  {Number(inv.cis_deduction) > 0 ? (
                    <span title={`${Number(inv.cis_rate)}% of ${money(inv.labour_amount)} labour`}>
                      {money(inv.cis_deduction)}
                    </span>
                  ) : inv.labour_amount && !inv.cis_verified ? (
                    <Badge tone="warn">Unverified</Badge>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  )}
                </td>
                <td className="num font-medium">{money(inv.net_payable)}</td>
                <td className="num">
                  <div className="flex justify-end gap-1">
                    {inv.status === "received" && (
                      <Button variant="primary" size="sm" loadingText="Approving…" onClick={() => approve(inv)}>
                        Approve
                      </Button>
                    )}
                    {inv.status === "disputed" && (
                      <Button
                        variant="primary"
                        size="sm"
                        loadingText="Resolving…"
                        onClick={() =>
                          run(
                            api.resolveInvoice(inv.id),
                            `${inv.invoice_number} back in the approval queue`,
                            "Could not resolve the dispute",
                          )
                        }
                      >
                        Resolve
                      </Button>
                    )}
                    {inv.status === "approved" &&
                      (inv.lien_waiver_received ? (
                        <Button variant="primary" size="sm" onClick={() => setPrompt({ kind: "pay", inv })}>
                          Pay
                        </Button>
                      ) : (
                        <span className="self-center text-xs" style={{ color: "var(--fg-subtle)" }}>
                          Waiver needed to pay
                        </span>
                      ))}
                    {Number(inv.retainage_amount) > 0 && (inv.status === "approved" || inv.status === "paid") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loadingText="Releasing…"
                        onClick={() =>
                          run(
                            api.releaseRetainage(inv.id),
                            `Retention released on ${inv.invoice_number}`,
                            "Could not release the retention",
                          )
                        }
                      >
                        Release retention
                      </Button>
                    )}
                    {(inv.status === "received" || inv.status === "disputed") && (
                      <Menu
                        label="⋯"
                        items={[
                          ...(inv.status === "received"
                            ? [{ label: "Dispute…", run: () => setPrompt({ kind: "dispute", inv }) }]
                            : []),
                          {
                            label: "Void",
                            tone: "danger" as const,
                            run: () =>
                              ask({
                                title: `Void ${inv.invoice_number}?`,
                                tone: "danger",
                                confirmLabel: "Void invoice",
                                body: "A voided invoice never becomes cost and cannot be approved or paid. Use it for duplicates and invoices sent in error; a trade who is wrong on the amount should be disputed instead.",
                                onConfirm: () =>
                                  run(api.voidInvoice(inv.id), `${inv.invoice_number} voided`, "Could not void it"),
                              }),
                          },
                        ]}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <NewInvoice
        open={open}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          reload();
        }}
      />
      {prompt && (
        <DecisionModal
          prompt={prompt}
          onClose={() => setPrompt(null)}
          onDone={(message) => {
            setPrompt(null);
            toast.success(message);
            reload();
          }}
        />
      )}
      {dialog}
    </>
  );
}

/** Override above the PO, dispute, or pay — each needs one piece of text on the record. */
function DecisionModal({
  prompt,
  onClose,
  onDone,
}: {
  prompt: Prompt;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { inv } = prompt;

  const copy = {
    override: {
      title: `Approve ${inv.invoice_number} above its purchase order?`,
      label: "Why is billing above the PO agreed?",
      hint: "Written onto the invoice with your name. Raise a change order instead unless this is genuinely agreed.",
      placeholder: "Extra sockets instructed on site by the site manager",
      button: "Approve anyway",
      required: true,
    },
    dispute: {
      title: `Dispute ${inv.invoice_number}`,
      label: "What is wrong with it?",
      hint: "The invoice is held out of the approval queue until the dispute is resolved. The reason stays on record.",
      placeholder: "Second fix not complete on plots 12–14",
      button: "Dispute invoice",
      required: true,
    },
    pay: {
      title: `Pay ${inv.invoice_number}`,
      label: "Payment reference",
      hint: `Net ${money(inv.net_payable)} to the trade${
        Number(inv.cis_deduction) > 0 ? `, ${money(inv.cis_deduction)} CIS to HMRC` : ""
      }${Number(inv.retainage_amount) > 0 ? `, ${money(inv.retainage_amount)} retention held` : ""}.`,
      placeholder: "BACS-20260928-014",
      button: "Record payment",
      required: false,
    },
  }[prompt.kind];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (prompt.kind === "override") {
        await api.approveInvoice(inv.id, { allowOverPo: true, reason: text.trim() });
        onDone(`${inv.invoice_number} approved over PO — override recorded`);
      } else if (prompt.kind === "dispute") {
        await api.disputeInvoice(inv.id, text.trim());
        onDone(`${inv.invoice_number} disputed`);
      } else {
        await api.payInvoice(inv.id, text.trim());
        onDone(`${inv.invoice_number} paid`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={copy.title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {prompt.kind === "override" && <ErrorNote message={prompt.detail} />}
        <Field label={copy.label} hint={copy.hint}>
          <input
            className="input"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            required={copy.required}
            minLength={copy.required ? 3 : undefined}
            maxLength={prompt.kind === "pay" ? 120 : 500}
            placeholder={copy.placeholder}
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant={prompt.kind === "pay" ? "primary" : "danger"} disabled={busy}>
            {busy ? "Saving…" : copy.button}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NewInvoice({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  // Any committed PO can be billed: issued, acknowledged by the trade, or complete (the
  // final invoice usually arrives after the work is done). Filtering to "issued" alone
  // hid a PO the moment the trade acknowledged it.
  const pos = useAsync(
    () =>
      api
        .listPurchaseOrders()
        .then((all) => all.filter((p) => ["issued", "acknowledged", "complete"].includes(p.status))),
    [],
  );
  const codes = useAsync(() => api.listCostCodes(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const [poId, setPoId] = useState("");
  const [number, setNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [costCodeId, setCostCodeId] = useState("");
  const [amount, setAmount] = useState("");
  const [labour, setLabour] = useState("");
  const [waiver, setWaiver] = useState(false);
  const [retention, setRetention] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedPo = (pos.data ?? []).find((p) => p.id === poId);
  const trade = (vendors.data ?? []).find((v) => v.id === selectedPo?.vendor_id);
  const cisRate = trade?.cis_status ? { gross: 0, net: 20, unverified: 30 }[trade.cis_status] : null;

  function pickPo(id: string) {
    setPoId(id);
    // The PO's first line is by far the usual cost code, so start there.
    const po = (pos.data ?? []).find((p) => p.id === id);
    if (po?.lines?.[0]) setCostCodeId(po.lines[0].cost_code_id);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createInvoice({
        invoice_number: number,
        purchase_order_id: poId,
        invoice_date: invoiceDate || undefined,
        lien_waiver_received: waiver,
        retainage_percent: retention || undefined,
        labour_amount: labour || undefined,
        lines: [{ cost_code_id: costCodeId, amount }],
      });
      setNumber("");
      setAmount("");
      setLabour("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the invoice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Receive an invoice" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Purchase order" hint="Home and trade are taken from the PO. Unmatched invoices are the classic leak.">
          <select className="input" value={poId} onChange={(e) => pickPo(e.target.value)} required>
            <option value="">Select a committed PO…</option>
            {(pos.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.po_number} — {money(p.total)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice number">
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} required placeholder="INV-1001" />
          </Field>
          <Field label="Invoice date" hint="Blank is today. Due 30 days after.">
            <input className="input" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Cost code">
          <select className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} required>
            <option value="">Select…</option>
            {(codes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount (net of VAT)">
            <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required inputMode="decimal" />
          </Field>
          <Field
            label="Labour element"
            hint={
              !selectedPo
                ? "CIS is deducted from labour only."
                : cisRate === null
                  ? "This trade has no CIS status on record, so nothing is deducted. Verify it on Trades."
                  : `${trade?.name}: CIS ${cisRate}% of labour.`
            }
          >
            <input className="input" value={labour} onChange={(e) => setLabour(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </Field>
        </div>
        <Field
          label="Retention %"
          hint={
            selectedPo
              ? `Leave blank to inherit ${selectedPo.retainage_percent}% from ${selectedPo.po_number}.`
              : "Leave blank to inherit the purchase order's rate."
          }
        >
          <input
            className="input"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            inputMode="decimal"
            placeholder={selectedPo?.retainage_percent ?? "0"}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
          Lien waiver received with the invoice
          <span style={{ color: "var(--fg-subtle)" }}>(can be recorded later)</span>
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Receive"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
