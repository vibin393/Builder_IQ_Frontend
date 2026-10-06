"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/feedback";
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
  Tabs,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type {
  AccountingSettings,
  ExportBatch,
  ExportFormat,
  ExportKind,
  JournalLine,
} from "@/types/api";

const TABS = ["Export queue", "Batches", "Nominal mapping", "CIS return", "Settings"] as const;
type Tab = (typeof TABS)[number];

const KINDS: { kind: ExportKind; label: string; hint: string }[] = [
  { kind: "invoices", label: "Invoices", hint: "Approved invoices: job cost in, trade creditor and retention up." },
  { kind: "payments", label: "Payments", hint: "Payments made: creditor cleared, bank out, CIS owed to HMRC." },
  { kind: "retention", label: "Retention", hint: "Retention released and paid to the trade." },
];

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "sage50", label: "Sage 50 (audit trail import)" },
  { value: "xero", label: "Xero (manual journal)" },
  { value: "journal", label: "Generic journal CSV" },
];

/** Local date as YYYY-MM-DD; toISOString would give tomorrow after midnight BST. */
const today = () => new Date().toLocaleDateString("en-CA");

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>("Export queue");
  const summary = useAsync(() => api.accountingSummary(), []);
  const toast = useToast();
  const s = summary.data;
  const readyCount = s ? s.ready.invoices.count + s.ready.payments.count + s.ready.retention.count : 0;

  async function supplierMaster() {
    try {
      await api.downloadSupplierMaster();
    } catch (err) {
      toast.error("Could not download the supplier master", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="Job cost goes to the ledger as balanced journals in numbered batches. Every invoice, payment and retention release is sent exactly once â€” re-downloading a batch is safe, and nothing already exported is offered again."
        action={
          <Button variant="ghost" icon="vendors" onClick={supplierMaster}>
            Supplier master
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Ready for the ledger"
          value={s ? readyCount : "â€”"}
          tone={readyCount ? "warn" : "ok"}
          hint={
            s
              ? `${s.ready.invoices.count} invoices Â· ${s.ready.payments.count} payments Â· ${s.ready.retention.count} releases`
              : undefined
          }
        />
        <StatTile
          label="Exported, not posted"
          value={s?.unposted_batches ?? "â€”"}
          tone={s?.unposted_batches ? "warn" : "ok"}
          hint={s?.last_export_on ? `Last export ${day(s.last_export_on)}` : "Nothing exported yet"}
        />
        <StatTile
          label="Exported this month"
          value={<AnimatedNumber value={Number(s?.exported_this_month ?? 0)} format={(v) => money(v)} />}
          hint={s?.waiting ? `${s.waiting} waiting on their invoice's export` : "Nothing held back"}
        />
        <StatTile
          label="Open commitments"
          value={<AnimatedNumber value={Number(s?.open_commitments ?? 0)} format={(v) => money(v)} />}
          hint="Committed on POs, not yet invoiced â€” not in the ledger"
        />
        <StatTile
          label="CIS this tax month"
          value={<AnimatedNumber value={Number(s?.cis_this_period ?? 0)} format={(v) => money(v)} />}
          hint="Deducted from trades, owed to HMRC"
        />
        <StatTile
          label="Unmapped cost codes"
          value={s?.unmapped_cost_codes ?? "â€”"}
          tone={s?.unmapped_cost_codes ? "warn" : "ok"}
          hint="Posting to the default cost account"
        />
        <StatTile
          label="Period locked through"
          value={s?.locked_through ? day(s.locked_through) : "Open"}
          hint="Earlier items post on the first open day"
        />
        <StatTile
          label="Queue value"
          value={money(
            s
              ? Number(s.ready.invoices.value) + Number(s.ready.payments.value) + Number(s.ready.retention.value)
              : 0,
          )}
          hint="Across all three queues"
        />
      </div>

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        counts={{
          "Export queue": readyCount,
          Batches: s?.unposted_batches,
          "Nominal mapping": s?.unmapped_cost_codes,
        }}
      />

      {tab === "Export queue" && (
        <QueueTab
          counts={s?.ready}
          onExported={() => {
            summary.reload();
            setTab("Batches");
          }}
        />
      )}
      {tab === "Batches" && <BatchesTab onChange={summary.reload} />}
      {tab === "Nominal mapping" && <MappingTab onChange={summary.reload} />}
      {tab === "CIS return" && <CISTab />}
      {tab === "Settings" && <SettingsTab onChange={summary.reload} />}
    </>
  );
}

/* ------------------------------------------------------------------ queue */

function QueueTab({
  counts,
  onExported,
}: {
  counts?: Record<ExportKind, { count: number; value: string }>;
  onExported: () => void;
}) {
  const [kind, setKind] = useState<ExportKind>("invoices");
  const [through, setThrough] = useState(today());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queue = useAsync(() => api.exportQueue(kind, through), [kind, through]);
  const toast = useToast();
  const q = queue.data;
  const warned = (q?.items ?? []).filter((i) => i.warnings.length).length;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const batch = await api.createExportBatch({ kind, through_date: through, notes: notes || undefined });
      toast.success(`${batch.batch_number} exported`, `${batch.item_count} ${kind} Â· ${money(batch.total, 2)}`);
      setNotes("");
      queue.reload();
      onExported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the batch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              className="btn btn-ghost btn-sm"
              onClick={() => setKind(k.kind)}
              style={kind === k.kind ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 } : {}}
            >
              {k.label}
              {counts?.[k.kind].count ? ` (${counts[k.kind].count})` : ""}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Through
          <input
            type="date"
            className="input"
            style={{ width: "auto" }}
            value={through}
            max={today()}
            onChange={(e) => setThrough(e.target.value || today())}
          />
        </label>
      </div>
      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
        {KINDS.find((k) => k.kind === kind)?.hint}
      </p>

      {q && q.waiting > 0 && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          <strong>{q.waiting} held back.</strong> Their invoice has not gone to the ledger yet, so the creditor they
          clear would not exist there. Export the invoices first.
        </div>
      )}

      {queue.loading ? (
        <Loading />
      ) : queue.error ? (
        <ErrorNote message={queue.error} />
      ) : (
        q && (
          <>
            <Card
              title={`${q.items.length} ready Â· ${money(
                q.items.reduce((t, i) => t + Number(i.amount), 0),
                2,
              )}${warned ? ` Â· ${warned} with warnings` : ""}`}
              padded={false}
            >
              <DataTable
                columns={[
                  { key: "doc", label: "Document" },
                  { key: "supplier", label: "Supplier" },
                  { key: "job", label: "Home" },
                  { key: "date", label: "Date" },
                  { key: "warn", label: "Check" },
                  { key: "amount", label: "Amount", align: "right" },
                ]}
                empty={`No ${kind} waiting for the ledger.`}
              >
                {q.items.map((i) => (
                  <tr key={i.invoice_id}>
                    <td className="font-medium">{i.document}</td>
                    <td>
                      {i.supplier_name ?? "â€”"}
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {i.supplier_code}
                      </div>
                    </td>
                    <td>{i.job_number ?? "â€”"}</td>
                    <td className="text-sm">{day(i.event_date)}</td>
                    <td>
                      {i.warnings.length ? (
                        <div className="max-w-[22rem] space-y-0.5">
                          {i.warnings.map((w) => (
                            <div key={w} className="text-xs" style={{ color: "var(--warn)" }}>
                              {w}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Badge tone="ok">Clean</Badge>
                      )}
                    </td>
                    <td className="num">{money(i.amount, 2)}</td>
                  </tr>
                ))}
              </DataTable>
            </Card>

            {q.journal.length > 0 && (
              <Card
                title="Journal preview"
                padded={false}
                action={
                  <Badge tone={q.balanced ? "ok" : "danger"}>
                    {q.balanced ? `Balanced Â· ${money(q.debits, 2)}` : `Out by ${money(Number(q.debits) - Number(q.credits), 2)}`}
                  </Badge>
                }
              >
                <Journal lines={q.journal} debits={q.debits} credits={q.credits} />
              </Card>
            )}

            {q.items.length > 0 && (
              <Card>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[16rem] flex-1">
                    <Field label="Batch note" hint="Optional â€” e.g. which month-end run this is.">
                      <input className="input" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
                    </Field>
                  </div>
                  <Button variant="primary" icon="accounting" disabled={busy || !q.balanced} onClick={create}>
                    {busy ? "Exportingâ€¦" : `Export ${q.items.length} ${kind} as a batch`}
                  </Button>
                </div>
                {error && (
                  <div className="mt-3">
                    <ErrorNote message={error} />
                  </div>
                )}
              </Card>
            )}
          </>
        )
      )}
    </div>
  );
}

function Journal({ lines, debits, credits }: { lines: JournalLine[]; debits: string; credits: string }) {
  return (
    <DataTable
      maxHeight={420}
      columns={[
        { key: "date", label: "Posting date" },
        { key: "acct", label: "Nominal" },
        { key: "ref", label: "Reference" },
        { key: "details", label: "Details" },
        { key: "dr", label: "Debit", align: "right" },
        { key: "cr", label: "Credit", align: "right" },
      ]}
    >
      {lines.map((j, n) => (
        <tr key={`${j.reference}-${j.account}-${n}`}>
          <td className="text-sm">
            {day(j.posting_date)}
            {j.original_date && (
              <div className="text-xs" style={{ color: "var(--warn)" }}>
                moved from {day(j.original_date)}
              </div>
            )}
          </td>
          <td className="font-medium tnum">{j.account}</td>
          <td className="text-sm">
            {j.reference}
            {j.job_number && (
              <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                {j.job_number}
              </div>
            )}
          </td>
          <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {j.details}
          </td>
          <td className="num">{Number(j.debit) ? money(j.debit, 2) : ""}</td>
          <td className="num">{Number(j.credit) ? money(j.credit, 2) : ""}</td>
        </tr>
      ))}
      <tr style={{ borderTop: "2px solid var(--border)" }}>
        <td colSpan={4} className="text-sm font-semibold">
          Totals
        </td>
        <td className="num font-semibold">{money(debits, 2)}</td>
        <td className="num font-semibold">{money(credits, 2)}</td>
      </tr>
    </DataTable>
  );
}

/* ---------------------------------------------------------------- batches */

type BatchPrompt = { kind: "post" | "void"; batch: ExportBatch };

function BatchesTab({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<ExportKind | "">("");
  const batches = useAsync(
    () => api.listExportBatches({ status: status || undefined, kind: kind || undefined }),
    [status, kind],
  );
  const [viewing, setViewing] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<BatchPrompt | null>(null);
  const toast = useToast();

  async function download(b: ExportBatch, format?: ExportFormat) {
    try {
      const name = await api.downloadExportBatch(b.id, format);
      toast.success(`Downloaded ${name}`);
      batches.reload();
    } catch (err) {
      toast.error("Download refused", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["", "exported", "posted", "void"].map((st) => (
          <button
            key={st || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setStatus(st)}
            style={status === st ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {st === "" ? "All" : st === "exported" ? "Awaiting posting" : st}
          </button>
        ))}
        <select className="input" style={{ width: "auto" }} value={kind} onChange={(e) => setKind(e.target.value as ExportKind | "")}>
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <Card padded={false}>
        {batches.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "no", label: "Batch" },
              { key: "kind", label: "Kind" },
              { key: "status", label: "Status" },
              { key: "items", label: "Items", align: "right" },
              { key: "total", label: "Total", align: "right" },
              { key: "dl", label: "Downloads", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No batches yet. Export one from the queue."
          >
            {(batches.data ?? []).map((b) => (
              <tr key={b.id}>
                <td>
                  <button className="font-medium hover:underline" style={{ color: "var(--brand)" }} onClick={() => setViewing(b.id)}>
                    {b.batch_number}
                  </button>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {day(b.created_at)} Â· through {day(b.through_date)}
                  </div>
                  {b.notes && (
                    <div className="text-xs" style={{ color: "var(--fg-muted)" }}>
                      {b.notes}
                    </div>
                  )}
                </td>
                <td>
                  <Badge tone="neutral">{b.kind}</Badge>
                </td>
                <td>
                  <StatusBadge status={b.status === "exported" ? "awaiting posting" : b.status} />
                  {b.ledger_reference && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      Ledger ref {b.ledger_reference}
                    </div>
                  )}
                  {b.void_reason && (
                    <div className="max-w-[16rem] text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {b.void_reason}
                    </div>
                  )}
                </td>
                <td className="num">{b.item_count}</td>
                <td className="num">{money(b.total, 2)}</td>
                <td className="num">
                  {b.download_count > 1 ? (
                    <span title="Downloaded more than once â€” check it was not imported twice" style={{ color: "var(--warn)" }}>
                      {b.download_count}Ã—
                    </span>
                  ) : (
                    b.download_count
                  )}
                </td>
                <td className="num">
                  <div className="flex justify-end gap-1">
                    {b.status !== "void" && (
                      <Menu
                        label="Download"
                        items={FORMATS.map((f) => ({ label: f.label, run: () => download(b, f.value) }))}
                      />
                    )}
                    {b.status === "exported" && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => setPrompt({ kind: "post", batch: b })}>
                          Mark posted
                        </Button>
                        <Menu
                          label="â‹¯"
                          items={[{ label: "Void batchâ€¦", tone: "danger", run: () => setPrompt({ kind: "void", batch: b }) }]}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {viewing && <BatchDetailModal id={viewing} onClose={() => setViewing(null)} />}
      {prompt && (
        <BatchDecision
          prompt={prompt}
          onClose={() => setPrompt(null)}
          onDone={(msg) => {
            setPrompt(null);
            toast.success(msg);
            batches.reload();
            onChange();
          }}
        />
      )}
    </div>
  );
}

function BatchDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const batch = useAsync(() => api.getExportBatch(id), [id]);
  const b = batch.data;
  return (
    <Modal open title={b ? `${b.batch_number} Â· ${b.kind}` : "Batch"} onClose={onClose}>
      {batch.loading || !b ? (
        <Loading />
      ) : b.status === "void" ? (
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Voided {day(b.voided_at)}: {b.void_reason}. Its {b.item_count} items went back in the queue.
        </p>
      ) : (
        <div className="-mx-6 max-h-[60vh] overflow-auto">
          <Journal lines={b.journal} debits={b.debits} credits={b.credits} />
        </div>
      )}
    </Modal>
  );
}

function BatchDecision({
  prompt,
  onClose,
  onDone,
}: {
  prompt: BatchPrompt;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { batch } = prompt;
  const posting = prompt.kind === "post";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (posting) {
        await api.markBatchPosted(batch.id, text.trim());
        onDone(`${batch.batch_number} marked as posted`);
      } else {
        await api.voidExportBatch(batch.id, text.trim());
        onDone(`${batch.batch_number} voided â€” its items are back in the queue`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={posting ? `Confirm ${batch.batch_number} is in the ledger` : `Void ${batch.batch_number}?`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {posting
            ? "Only once the import has succeeded. A posted batch cannot be voided here â€” a mistake is corrected with a reversing journal in the ledger."
            : "Only for a batch that was never imported. Its items return to the queue and will go out in the next batch."}
        </p>
        <Field
          label={posting ? "Ledger reference" : "Why is it being voided?"}
          hint={posting ? "The journal or batch number the accounting package gave it. Optional." : "Kept on the batch."}
        >
          <input
            className="input"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            required={!posting}
            minLength={posting ? undefined : 3}
            maxLength={posting ? 64 : 500}
            placeholder={posting ? "JNL-2026-0914" : "Swept in the wrong through-date"}
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant={posting ? "primary" : "danger"} disabled={busy}>
            {busy ? "Savingâ€¦" : posting ? "Mark posted" : "Void batch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- mapping */

function MappingTab({ onChange }: { onChange: () => void }) {
  const mapping = useAsync(() => api.nominalMapping(), []);
  const settings = useAsync(() => api.accountingSettings(), []);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "unmapped">("all");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const rows = (mapping.data ?? []).filter((m) => filter === "all" || !(edits[m.cost_code_id] ?? m.gl_account));
  const changed = Object.entries(edits).filter(
    ([id, v]) => (mapping.data ?? []).find((m) => m.cost_code_id === id)?.gl_account !== (v.trim() || null),
  );

  async function save() {
    setBusy(true);
    try {
      await toast.promise(
        api.setNominalMapping(changed.map(([cost_code_id, v]) => ({ cost_code_id, gl_account: v.trim() || null }))),
        { success: `${changed.length} mapping${changed.length === 1 ? "" : "s"} saved`, error: "Could not save the mapping" },
      );
      setEdits({});
      mapping.reload();
      onChange();
    } catch {
      /* the toast carries the reason */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Cost code â†’ nominal code"
      padded={false}
      action={
        <div className="flex items-center gap-2">
          <select className="input" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value as "all" | "unmapped")}>
            <option value="all">All codes</option>
            <option value="unmapped">Unmapped only</option>
          </select>
          <Button variant="primary" size="sm" disabled={!changed.length || busy} onClick={save}>
            {busy ? "Savingâ€¦" : `Save${changed.length ? ` ${changed.length}` : ""}`}
          </Button>
        </div>
      }
    >
      <p className="px-5 pt-4 text-sm" style={{ color: "var(--fg-muted)" }}>
        Each cost code posts to its own nominal in the ledger, so the accounts analyse cost the way the jobs do. A code
        left blank posts to the default cost account
        {settings.data ? ` (${settings.data.cost_account})` : ""} â€” still balanced, but lumped together.
      </p>
      {mapping.loading ? (
        <Loading />
      ) : (
        <DataTable
          maxHeight={520}
          columns={[
            { key: "code", label: "Cost code" },
            { key: "div", label: "Division" },
            { key: "gl", label: "Nominal code" },
          ]}
          empty="Every cost code is mapped."
        >
          {rows.map((m) => {
            const value = edits[m.cost_code_id] ?? m.gl_account ?? "";
            return (
              <tr key={m.cost_code_id}>
                <td>
                  <span className="font-medium">{m.code}</span> {m.name}
                  {!m.is_active && (
                    <span className="ml-2">
                      <Badge tone="neutral">inactive</Badge>
                    </span>
                  )}
                </td>
                <td style={{ color: "var(--fg-muted)" }}>{m.division ?? "â€”"}</td>
                <td>
                  <input
                    className="input tnum"
                    style={{ width: "8rem", ...(value ? {} : { borderColor: "var(--warn)" }) }}
                    value={value}
                    maxLength={20}
                    placeholder={settings.data?.cost_account ?? "5000"}
                    aria-label={`Nominal code for ${m.code}`}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [m.cost_code_id]: e.target.value }))}
                  />
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------- CIS */

function shiftMonth(iso: string, by: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + by);
  return d.toISOString().slice(0, 10);
}

function CISTab() {
  const [period, setPeriod] = useState(today());
  const ret = useAsync(() => api.cisReturn(period), [period]);
  const r = ret.data;
  const problems = (r?.rows ?? []).filter((x) => x.problems.length).length;
  const isCurrent = useMemo(() => r && r.period_end >= today() && r.period_start <= today(), [r]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setPeriod(shiftMonth(period, -1))}>
          â† Previous
        </Button>
        <strong className="text-sm">
          {r ? `Tax month ${day(r.period_start)} â€“ ${day(r.period_end)}` : "â€¦"}
        </strong>
        <Button variant="ghost" size="sm" disabled={!!isCurrent} onClick={() => setPeriod(shiftMonth(period, 1))}>
          Next â†’
        </Button>
        {r && (
          <Badge tone={new Date(r.due_date) < new Date(today()) ? "neutral" : "warn"}>
            Return due {day(r.due_date)}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Paid to CIS trades" value={money(r?.gross_paid ?? 0, 2)} hint="Before deduction, retention excluded" />
        <StatTile label="Of which materials" value={money(r?.materials ?? 0, 2)} hint="Not subject to deduction" />
        <StatTile label="Deducted for HMRC" value={money(r?.deducted ?? 0, 2)} tone={problems ? "warn" : "default"} hint={problems ? `${problems} trade${problems === 1 ? "" : "s"} need attention before filing` : "Ready for the CIS300"} />
      </div>

      <Card title="Monthly return (CIS300)" padded={false}>
        {ret.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "trade", label: "Subcontractor" },
              { key: "utr", label: "UTR" },
              { key: "status", label: "Status" },
              { key: "gross", label: "Total paid", align: "right" },
              { key: "mat", label: "Materials", align: "right" },
              { key: "ded", label: "Deducted", align: "right" },
            ]}
            empty="No payments to CIS trades in this tax month."
          >
            {(r?.rows ?? []).map((x) => (
              <tr key={x.vendor_id}>
                <td>
                  <div className="font-medium">{x.supplier_name}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {x.supplier_code} Â· {x.payments} payment{x.payments === 1 ? "" : "s"}
                  </div>
                  {x.problems.map((p) => (
                    <div key={p} className="text-xs" style={{ color: "var(--danger)" }}>
                      {p}
                    </div>
                  ))}
                </td>
                <td className="tnum">{x.utr ?? "â€”"}</td>
                <td>
                  {x.cis_status ? <Badge tone="neutral">{x.cis_status}</Badge> : <Badge tone="warn">not verified</Badge>}
                </td>
                <td className="num">{money(x.gross_paid, 2)}</td>
                <td className="num">{money(x.materials, 2)}</td>
                <td className="num font-medium">{money(x.deducted, 2)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- settings */

const ACCOUNTS: { key: keyof AccountingSettings; label: string; hint: string }[] = [
  { key: "cost_account", label: "Default cost account", hint: "Where cost posts for a cost code with no nominal of its own." },
  { key: "creditors_account", label: "Trade creditors", hint: "Purchase ledger control. Sage default 2100." },
  { key: "retention_account", label: "Retention payable", hint: "Retention withheld from trades until release." },
  { key: "cis_account", label: "CIS liability", hint: "Deductions owed to HMRC, cleared when the CIS300 is paid." },
  { key: "bank_account", label: "Bank", hint: "The account trades are paid from. Sage default 1200." },
];

function SettingsTab({ onChange }: { onChange: () => void }) {
  const settings = useAsync(() => api.accountingSettings(), []);
  const [form, setForm] = useState<AccountingSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  if (settings.loading || !form) return <Loading />;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateAccountingSettings({ ...form, locked_through: form.locked_through || null });
      toast.success("Accounting settings saved");
      settings.reload();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-5 lg:grid-cols-2">
      <Card title="Control accounts">
        <div className="space-y-4">
          {ACCOUNTS.map((a) => (
            <Field key={a.key} label={a.label} hint={a.hint}>
              <input
                className="input tnum"
                value={String(form[a.key] ?? "")}
                maxLength={20}
                required
                onChange={(e) => setForm({ ...form, [a.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Card>
      <div className="space-y-5">
        <Card title="Export">
          <Field label="Default file format" hint="What a batch downloads as unless another format is picked.">
            <select
              className="input"
              value={form.default_format}
              onChange={(e) => setForm({ ...form, default_format: e.target.value as ExportFormat })}
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
        </Card>
        <Card title="Period lock">
          <Field
            label="Locked through"
            hint="Match the period closed in the ledger. Anything dated on or before it posts on the first open day, and the journal says it was moved."
          >
            <input
              type="date"
              className="input"
              value={form.locked_through ?? ""}
              max={shiftDay(today(), -1)}
              onChange={(e) => setForm({ ...form, locked_through: e.target.value || null })}
            />
          </Field>
        </Card>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Savingâ€¦" : "Save settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function shiftDay(iso: string, by: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + by);
  return d.toISOString().slice(0, 10);
}
