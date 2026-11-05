"use client";

/**
 * Cost inbox.
 *
 * A cost arrives — a receipt, a card charge, a supplier statement — before anyone
 * has decided which job and cost code it belongs to. It lands here, gets coded
 * when someone has a moment, then is pushed to a bill or rejected. Nothing reaches
 * the budget uncoded, and nothing gets lost in an inbox nobody owns.
 */

import { useState } from "react";

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
import { byId, useAsync } from "@/lib/hooks";
import type { CostInboxItem, CostInboxStatus } from "@/types/api";

type Filter = "all" | CostInboxStatus;
const FILTERS: readonly Filter[] = ["new", "coded", "pushed", "rejected", "all"] as const;
const LABEL: Record<Filter, string> = { all: "All", new: "New", coded: "Coded", pushed: "Pushed", rejected: "Rejected" };

function statusTone(s: CostInboxStatus): Tone {
  return s === "pushed" ? "ok" : s === "rejected" ? "danger" : s === "coded" ? "brand" : "warn";
}

export default function CostInboxPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const costCodes = useAsync(() => api.listCostCodes(), []);
  const [filter, setFilter] = useState<Filter>("new");

  const summary = useAsync(() => api.costInboxSummary(), []);
  const rows = useAsync(
    () => api.listCostInbox({ item_status: filter === "all" ? undefined : filter, size: 100 }),
    [filter],
  );
  const reload = () => { summary.reload(); rows.reload(); };

  const jobById = byId(jobs.data);
  const vendorById = byId(vendors.data);
  const ccById = byId(costCodes.data);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [cap, setCap] = useState({ title: "", amount: "", purchase_date: "" });
  const [busy, setBusy] = useState(false);

  const [coding, setCoding] = useState<CostInboxItem | null>(null);
  const [code, setCode] = useState({ job_id: "", vendor_id: "", cost_code_id: "" });

  async function capture() {
    if (!cap.title.trim()) { toast.error("A title is required."); return; }
    setBusy(true);
    try {
      await api.captureCost({ title: cap.title.trim(), amount: cap.amount ? Number(cap.amount) : null, purchase_date: cap.purchase_date || null });
      toast.success("Captured");
      setCaptureOpen(false); setCap({ title: "", amount: "", purchase_date: "" });
      reload();
    } catch (err) { toast.error("Could not capture", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  function openCode(it: CostInboxItem) {
    setCoding(it);
    setCode({ job_id: it.job_id ?? "", vendor_id: it.vendor_id ?? "", cost_code_id: it.cost_code_id ?? "" });
  }
  async function saveCode() {
    if (!coding) return;
    setBusy(true);
    try {
      await api.codeCost(coding.id, {
        job_id: code.job_id || null,
        vendor_id: code.vendor_id || null,
        cost_code_id: code.cost_code_id || null,
      });
      toast.success("Coded");
      setCoding(null);
      reload();
    } catch (err) { toast.error("Could not code", err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  }

  async function push(it: CostInboxItem) {
    try { await api.pushCost(it.id); toast.success("Pushed to a bill"); reload(); }
    catch (err) { toast.error("Could not push", err instanceof Error ? err.message : undefined); }
  }
  function reject(it: CostInboxItem) {
    confirm({ title: "Reject item?", body: `"${it.title}" will be marked rejected.`, confirmLabel: "Reject", tone: "danger",
      onConfirm: async () => { try { await api.rejectCost(it.id); toast.success("Rejected"); reload(); } catch (e) { toast.error("Could not reject", e instanceof Error ? e.message : undefined); } } });
  }
  function remove(it: CostInboxItem) {
    confirm({ title: "Delete item?", body: `"${it.title}" will be permanently removed.`, confirmLabel: "Delete", tone: "danger",
      onConfirm: async () => { try { await api.deleteCost(it.id); toast.success("Deleted"); reload(); } catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); } } });
  }

  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="Cost inbox"
        subtitle="Capture incoming costs, code them to a job and cost code, then push them to a bill."
        action={<button className="btn btn-primary" onClick={() => setCaptureOpen(true)}>Capture cost</button>}
      />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="New" value={s.new} tone={s.new ? "warn" : "default"} />
          <StatTile label="Coded" value={s.coded} />
          <StatTile label="Pushed" value={s.pushed} tone="ok" />
          <StatTile label="Rejected" value={s.rejected} />
          <StatTile label="Open amount" value={money(s.open_amount)} />
        </div>
      )}

      <Tabs tabs={FILTERS} active={filter} onChange={setFilter} counts={s ? { new: s.new, coded: s.coded } : undefined} />

      <Card padded={false}>
        {rows.loading ? <Loading /> : rows.error ? <div className="p-5"><ErrorNote message={rows.error} /></div> : (
          <DataTable
            columns={[
              { key: "title", label: "Title" }, { key: "st", label: "Status" }, { key: "amt", label: "Amount", align: "right" },
              { key: "date", label: "Purchase date" }, { key: "job", label: "Job" }, { key: "vendor", label: "Sub/Vendor" },
              { key: "cc", label: "Cost code" }, { key: "act", label: "" },
            ]}
            empty="The inbox is clear for this filter."
          >
            {(rows.data?.items ?? []).map((it) => (
              <tr key={it.id}>
                <td className="font-medium">{it.title}</td>
                <td><Badge tone={statusTone(it.status)}>{it.status}</Badge></td>
                <td className="num tnum">{it.amount ? money(it.amount) : "—"}</td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{it.purchase_date ? day(it.purchase_date) : "—"}</td>
                <td className="text-sm">{it.job_id ? jobById.get(it.job_id)?.job_number ?? "—" : "—"}</td>
                <td className="text-sm">{it.vendor_id ? vendorById.get(it.vendor_id)?.name ?? "—" : "—"}</td>
                <td className="text-sm">{it.cost_code_id ? ccById.get(it.cost_code_id)?.code ?? "—" : "—"}</td>
                <td className="num">
                  <div className="flex justify-end gap-1.5">
                    {(it.status === "new" || it.status === "coded") && (
                      <>
                        <button className="btn btn-sm btn-ghost" onClick={() => openCode(it)}>Code</button>
                        <button className="btn btn-sm btn-primary" disabled={!it.is_coded} onClick={() => push(it)} title={it.is_coded ? "" : "Assign a job and cost code first"}>Push</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => reject(it)}>Reject</button>
                      </>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={() => remove(it)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {/* capture modal */}
      <Modal open={captureOpen} title="Capture a cost" onClose={() => setCaptureOpen(false)}>
        <div className="space-y-3">
          <Field label="Title"><input className="input" value={cap.title} onChange={(e) => setCap({ ...cap, title: e.target.value })} placeholder="e.g. Home Depot receipt" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><input className="input" type="number" value={cap.amount} onChange={(e) => setCap({ ...cap, amount: e.target.value })} /></Field>
            <Field label="Purchase date"><input className="input" type="date" value={cap.purchase_date} onChange={(e) => setCap({ ...cap, purchase_date: e.target.value })} /></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setCaptureOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={capture}>{busy ? "Saving…" : "Capture"}</button>
        </div>
      </Modal>

      {/* code modal */}
      <Modal open={coding !== null} title={`Code — ${coding?.title ?? ""}`} onClose={() => setCoding(null)}>
        <div className="space-y-3">
          <Field label="Job">
            <select className="input" value={code.job_id} onChange={(e) => setCode({ ...code, job_id: e.target.value })}>
              <option value="">—</option>
              {(jobs.data ?? []).map((j) => <option key={j.id} value={j.id}>{j.job_number}</option>)}
            </select>
          </Field>
          <Field label="Sub / Vendor">
            <select className="input" value={code.vendor_id} onChange={(e) => setCode({ ...code, vendor_id: e.target.value })}>
              <option value="">—</option>
              {(vendors.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Cost code" hint="Required before an item can be pushed.">
            <select className="input" value={code.cost_code_id} onChange={(e) => setCode({ ...code, cost_code_id: e.target.value })}>
              <option value="">—</option>
              {(costCodes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setCoding(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={saveCode}>{busy ? "Saving…" : "Save coding"}</button>
        </div>
      </Modal>

      {dialog}
    </div>
  );
}
