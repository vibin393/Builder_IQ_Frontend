"use client";

/**
 * Estimates — the proposal builder.
 *
 * The budget is the builder's internal cost. An estimate is the same work priced
 * for the customer: grouped line items, each cost marked up to a price, adding up
 * to what the owner is asked to sign. "Create proposal" issues it.
 */

import { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge, Card, DataTable, EmptyState, ErrorNote, Field, Loading, Modal,
  PageHeader, StatTile, Tone, money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { Estimate, EstimateStatus, Job } from "@/types/api";

function statusTone(s: EstimateStatus): Tone {
  return s === "accepted" ? "ok" : s === "declined" ? "danger" : s === "sent" ? "brand" : "neutral";
}
function jobLabel(j: Job): string {
  return j.elevation ? `${j.job_number} · ${j.elevation}` : j.job_number;
}

export default function EstimatesPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const jobs = useAsync(() => api.jobOptions(), []);
  const [jobId, setJobId] = useState("");
  useEffect(() => { if (!jobId && jobs.data?.length) setJobId(jobs.data[0].id); }, [jobs.data, jobId]);

  const list = useAsync(() => (jobId ? api.listEstimates(jobId) : Promise.resolve([])), [jobId]);
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useAsync(() => (openId ? api.getEstimate(openId) : Promise.resolve(null)), [openId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", tax_percent: "", default_markup_percent: "" });
  const [busy, setBusy] = useState(false);

  // item form
  const [item, setItem] = useState({ description: "", group_name: "General", unit: "", quantity: "1", unit_cost: "", markup_percent: "" });

  async function createEstimate() {
    if (!jobId || !form.title.trim()) { toast.error("A title is required."); return; }
    setBusy(true);
    try {
      const est = await api.createEstimate({ job_id: jobId, title: form.title.trim(), tax_percent: Number(form.tax_percent) || 0, default_markup_percent: Number(form.default_markup_percent) || 0 });
      setCreateOpen(false); setForm({ title: "", tax_percent: "", default_markup_percent: "" });
      list.reload(); setOpenId(est.id);
    } catch (e) { toast.error("Could not create", e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  async function addItem() {
    if (!openId || !item.description.trim()) { toast.error("A description is required."); return; }
    try {
      await api.addEstimateItem(openId, {
        description: item.description.trim(), group_name: item.group_name.trim() || "General",
        unit: item.unit || null, quantity: Number(item.quantity) || 1, unit_cost: Number(item.unit_cost) || 0, markup_percent: Number(item.markup_percent) || 0,
      });
      setItem({ description: "", group_name: item.group_name, unit: "", quantity: "1", unit_cost: "", markup_percent: "" });
      detail.reload(); list.reload();
    } catch (e) { toast.error("Could not add", e instanceof Error ? e.message : undefined); }
  }
  async function removeItem(itemId: string) {
    try { await api.deleteEstimateItem(itemId); detail.reload(); list.reload(); }
    catch (e) { toast.error("Could not remove", e instanceof Error ? e.message : undefined); }
  }
  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); detail.reload(); list.reload(); }
    catch (e) { toast.error("That did not go through", e instanceof Error ? e.message : undefined); }
  }
  function removeEstimate(id: string) {
    confirm({ title: "Delete estimate?", body: "This estimate and its line items will be removed.", confirmLabel: "Delete", tone: "danger",
      onConfirm: async () => { try { await api.deleteEstimate(id); if (openId === id) setOpenId(null); list.reload(); toast.success("Deleted"); } catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); } } });
  }

  const est = detail.data;
  const grouped = useMemo(() => {
    const g = new Map<string, Estimate["items"]>();
    for (const it of est?.items ?? []) g.set(it.group_name, [...(g.get(it.group_name) ?? []), it]);
    return g;
  }, [est]);

  return (
    <div>
      <PageHeader
        title="Estimates"
        subtitle="Build a priced, grouped proposal from line items, then issue it to the owner."
        action={
          <div className="flex items-center gap-2">
            <select className="input w-auto max-w-[16rem]" value={jobId} onChange={(e) => { setJobId(e.target.value); setOpenId(null); }} aria-label="Home">
              {(jobs.data ?? []).map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!jobId} onClick={() => setCreateOpen(true)}>New estimate</button>
          </div>
        }
      />
      {jobs.error && <ErrorNote message={jobs.error} />}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* list */}
        <Card padded={false}>
          {list.loading ? <Loading variant="text" /> : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {(list.data ?? []).length === 0 && <p className="p-5 text-sm" style={{ color: "var(--fg-subtle)" }}>No estimates yet.</p>}
              {(list.data ?? []).map((r) => (
                <button key={r.id} onClick={() => setOpenId(r.id)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--neutral-soft)]" style={openId === r.id ? { background: "var(--brand-soft)" } : {}}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{money(r.total_price)}</div>
                  </div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* detail / builder */}
        <div>
          {!openId ? (
            <Card><EmptyState title="Select an estimate" hint="Or create a new one to start building a proposal." /></Card>
          ) : detail.loading ? (
            <Card><Loading variant="text" /></Card>
          ) : !est ? (
            <Card><ErrorNote message="Could not load this estimate." /></Card>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{est.title}</h2>
                  <Badge tone={statusTone(est.status)}>{est.status}</Badge>
                </div>
                <div className="flex gap-1.5">
                  {est.status === "draft" && <button className="btn btn-sm btn-primary" onClick={() => act(() => api.sendEstimate(est.id), "Proposal sent")}>Create proposal</button>}
                  {est.status === "sent" && <>
                    <button className="btn btn-sm btn-primary" onClick={() => act(() => api.acceptEstimate(est.id), "Accepted")}>Mark accepted</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => act(() => api.declineEstimate(est.id), "Declined")}>Decline</button>
                  </>}
                  <button className="btn btn-sm btn-ghost" onClick={() => removeEstimate(est.id)}>Delete</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Cost" value={money(est.total_cost)} />
                <StatTile label="Subtotal" value={money(est.subtotal)} />
                <StatTile label="Margin" value={money(est.margin)} tone="ok" />
                <StatTile label="Total" value={money(est.total_price)} hint={`incl. ${est.tax_percent}% tax`} />
              </div>

              <Card padded={false}>
                <DataTable
                  columns={[
                    { key: "desc", label: "Item" }, { key: "qty", label: "Qty", align: "right" },
                    { key: "cost", label: "Unit cost", align: "right" }, { key: "mu", label: "Markup", align: "right" },
                    { key: "price", label: "Unit price", align: "right" }, { key: "ext", label: "Total", align: "right" },
                    { key: "act", label: "" },
                  ]}
                  empty="No line items yet. Add one below."
                >
                  {[...grouped.entries()].flatMap(([group, items]) => [
                    <tr key={`g-${group}`} style={{ background: "var(--neutral-soft)" }}>
                      <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--fg-subtle)" }}>{group}</td>
                    </tr>,
                    ...items.map((it) => (
                      <tr key={it.id}>
                        <td>{it.description}{it.unit ? <span className="ml-1 text-xs" style={{ color: "var(--fg-subtle)" }}>/ {it.unit}</span> : null}</td>
                        <td className="num tnum">{Number(it.quantity)}</td>
                        <td className="num tnum">{money(it.unit_cost)}</td>
                        <td className="num tnum">{Number(it.markup_percent)}%</td>
                        <td className="num tnum">{money(it.unit_price)}</td>
                        <td className="num tnum">{money(it.extended_price)}</td>
                        <td className="num">{est.status === "draft" || est.status === "sent" ? <button className="btn btn-sm btn-ghost" onClick={() => removeItem(it.id)}>×</button> : null}</td>
                      </tr>
                    )),
                  ])}
                </DataTable>
              </Card>

              {(est.status === "draft" || est.status === "sent") && (
                <Card title="Add line item">
                  <div className="grid gap-2 sm:grid-cols-7">
                    <input className="input sm:col-span-2" placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
                    <input className="input" placeholder="Group" value={item.group_name} onChange={(e) => setItem({ ...item, group_name: e.target.value })} />
                    <input className="input" placeholder="Unit" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} />
                    <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
                    <input className="input" type="number" placeholder="Unit cost" value={item.unit_cost} onChange={(e) => setItem({ ...item, unit_cost: e.target.value })} />
                    <input className="input" type="number" placeholder="Markup %" value={item.markup_percent} onChange={(e) => setItem({ ...item, markup_percent: e.target.value })} />
                  </div>
                  <div className="mt-3 flex justify-end"><button className="btn btn-primary btn-sm" onClick={addItem}>Add item</button></div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={createOpen} title="New estimate" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Default markup %"><input className="input" type="number" value={form.default_markup_percent} onChange={(e) => setForm({ ...form, default_markup_percent: e.target.value })} /></Field>
            <Field label="Tax %"><input className="input" type="number" value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} /></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={createEstimate}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </Modal>
      {dialog}
    </div>
  );
}
