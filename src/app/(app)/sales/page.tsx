"use client";

/**
 * Sales — lead proposals, the sales calendar, and the lead map.
 *
 * Proposals are the priced offers put in front of prospects. The calendar merges
 * follow-ups, design sessions and proposal expiries into one date-ordered view.
 * The map plots leads that carry coordinates.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge, Card, DataTable, EmptyState, ErrorNote, Field, Loading, Modal,
  PageHeader, Tabs, Tone, day, money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { LeadMapPoint, LeadProposal, LeadProposalStatus, ProposalTemplate, SalesCalendarEvent } from "@/types/api";

type Tab = "proposals" | "templates" | "calendar" | "map";
const TABS: readonly Tab[] = ["proposals", "templates", "calendar", "map"] as const;
const TAB_LABEL: Record<Tab, string> = { proposals: "Proposals", templates: "Templates", calendar: "Calendar", map: "Lead map" };

function propTone(s: LeadProposalStatus): Tone {
  return s === "accepted" ? "ok" : s === "declined" ? "danger" : s === "sent" ? "brand" : s === "expired" ? "warn" : "neutral";
}
const KIND_TONE: Record<string, Tone> = { follow_up: "warn", appointment: "brand", proposal_expiry: "danger", projected_close: "ok" };

function SalesMap({ points }: { points: LeadMapPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if ((window as unknown as { L?: unknown }).L) { setReady(true); return; }
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity = "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";
    css.crossOrigin = "anonymous";
    document.head.appendChild(css);
    const sc = document.createElement("script");
    sc.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; sc.async = true;
    sc.integrity = "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";
    sc.crossOrigin = "anonymous";
    sc.onload = () => setReady(true);
    document.body.appendChild(sc);
  }, []);
  useEffect(() => {
    if (!ready || !ref.current) return;
    const L = (window as unknown as { L?: any }).L; if (!L) return;
    const pts = points.filter((p) => p.lat && p.lng);
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current).setView(pts.length ? [Number(pts[0].lat), Number(pts[0].lng)] : [39.5, -98.35], pts.length ? 10 : 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(mapRef.current);
    }
    const map = mapRef.current as any;
    map._m?.forEach((m: any) => map.removeLayer(m)); map._m = [];
    const lls: [number, number][] = [];
    pts.forEach((p) => {
      const ll: [number, number] = [Number(p.lat), Number(p.lng)];
      lls.push(ll);
      const mk = L.marker(ll).addTo(map);
      mk.bindPopup(`<strong>${p.name}</strong><br>${p.city ?? ""} · ${p.status}`);
      map._m.push(mk);
    });
    if (lls.length) map.fitBounds(lls, { padding: [40, 40], maxZoom: 13 });
    setTimeout(() => map.invalidateSize(), 50);
  }, [ready, points]);
  return <div ref={ref} style={{ height: 460, width: "100%", borderRadius: 12, overflow: "hidden", background: "var(--neutral-soft)" }} />;
}

export default function SalesPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>("proposals");

  const leads = useAsync(() => api.listLeads({ size: 200 }), []);
  const proposals = useAsync(() => (tab === "proposals" ? api.listLeadProposals() : Promise.resolve([] as LeadProposal[])), [tab]);
  const calendar = useAsync(() => (tab === "calendar" ? api.salesCalendar() : Promise.resolve([] as SalesCalendarEvent[])), [tab]);
  const mapPts = useAsync(() => (tab === "map" ? api.leadMap() : Promise.resolve([] as LeadMapPoint[])), [tab]);
  const templates = useAsync(() => api.listProposalTemplates(), []);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ lead_id: "", title: "", amount: "", valid_until: "" });
  const [busy, setBusy] = useState(false);

  // proposal line-item builder
  const [building, setBuilding] = useState<LeadProposal | null>(null);
  const builderDetail = useAsync(
    () => (building ? api.getLeadProposal(building.id) : Promise.resolve(null)),
    [building?.id],
  );
  const [item, setItem] = useState({ description: "", group_name: "General", unit: "", quantity: "1", unit_cost: "", markup_percent: "" });

  async function addItem() {
    if (!building || !item.description.trim()) { toast.error("A description is required."); return; }
    try {
      await api.addProposalItem(building.id, {
        description: item.description.trim(), group_name: item.group_name.trim() || "General",
        unit: item.unit || null, quantity: Number(item.quantity) || 1,
        unit_cost: Number(item.unit_cost) || 0, markup_percent: Number(item.markup_percent) || 0,
      });
      setItem({ description: "", group_name: item.group_name, unit: "", quantity: "1", unit_cost: "", markup_percent: "" });
      builderDetail.reload(); proposals.reload();
    } catch (e) { toast.error("Could not add", e instanceof Error ? e.message : undefined); }
  }
  async function removeItem(itemId: string) {
    try { await api.deleteProposalItem(itemId); builderDetail.reload(); proposals.reload(); }
    catch (e) { toast.error("Could not remove", e instanceof Error ? e.message : undefined); }
  }
  async function applyTemplate(templateId: string) {
    if (!building || !templateId) return;
    try {
      await api.applyProposalTemplate(building.id, templateId);
      toast.success("Template applied");
      builderDetail.reload(); proposals.reload();
    } catch (e) { toast.error("Could not apply template", e instanceof Error ? e.message : undefined); }
  }
  async function saveAsTemplate() {
    if (!building) return;
    const name = window.prompt("Save these line items as a template named:");
    if (!name?.trim()) return;
    try {
      await api.saveProposalAsTemplate(building.id, { name: name.trim() });
      toast.success("Saved as template");
      templates.reload();
    } catch (e) { toast.error("Could not save template", e instanceof Error ? e.message : undefined); }
  }
  function removeTemplate(t: ProposalTemplate) {
    confirm({
      title: "Delete template?", body: `"${t.name}" will be removed.`, confirmLabel: "Delete", tone: "danger",
      onConfirm: async () => {
        try { await api.deleteProposalTemplate(t.id); toast.success("Template deleted"); templates.reload(); }
        catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); }
      },
    });
  }

  async function create() {
    if (!form.lead_id || !form.title.trim()) { toast.error("Pick a lead and give the proposal a title."); return; }
    setBusy(true);
    try {
      await api.createLeadProposal({ lead_id: form.lead_id, title: form.title.trim(), amount: Number(form.amount) || 0, valid_until: form.valid_until || null });
      toast.success("Proposal created");
      setCreateOpen(false); setForm({ lead_id: "", title: "", amount: "", valid_until: "" });
      proposals.reload();
    } catch (e) { toast.error("Could not create", e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); proposals.reload(); }
    catch (e) { toast.error("That did not go through", e instanceof Error ? e.message : undefined); }
  }
  function remove(p: LeadProposal) {
    confirm({ title: "Delete proposal?", body: `"${p.title}" will be removed.`, confirmLabel: "Delete", tone: "danger",
      onConfirm: async () => { try { await api.deleteLeadProposal(p.id); toast.success("Deleted"); proposals.reload(); } catch (e) { toast.error("Could not delete", e instanceof Error ? e.message : undefined); } } });
  }

  // group calendar by date
  const calByDate = useMemo(() => {
    const m = new Map<string, SalesCalendarEvent[]>();
    for (const e of calendar.data ?? []) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [calendar.data]);

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Lead proposals, your sales calendar, and the lead map in one place."
        action={tab === "proposals" ? <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>New proposal</button> : undefined}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "proposals" && (
        <Card padded={false}>
          {proposals.loading ? <Loading /> : proposals.error ? <div className="p-5"><ErrorNote message={proposals.error} /></div> : (
            <DataTable
              columns={[
                { key: "lead", label: "Lead" }, { key: "title", label: "Title" }, { key: "amt", label: "Amount", align: "right" },
                { key: "st", label: "Status" }, { key: "sent", label: "Sent" }, { key: "valid", label: "Valid until" }, { key: "act", label: "" },
              ]}
              empty="No lead proposals yet."
            >
              {(proposals.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.lead_name}</td>
                  <td>{p.title}</td>
                  <td className="num tnum">
                    {money(p.total)}
                    {p.items.length > 0 && <span className="ml-1 text-xs" style={{ color: "var(--fg-subtle)" }}>({p.items.length})</span>}
                  </td>
                  <td><Badge tone={propTone(p.is_expired ? "expired" : p.status)}>{p.is_expired ? "expired" : p.status}</Badge></td>
                  <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{p.sent_on ? day(p.sent_on) : "—"}</td>
                  <td className="text-sm" style={{ color: "var(--fg-muted)" }}>{p.valid_until ? day(p.valid_until) : "—"}</td>
                  <td className="num">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn btn-sm btn-ghost" onClick={() => setBuilding(p)}>Build</button>
                      {p.status === "draft" && <button className="btn btn-sm btn-primary" onClick={() => act(() => api.sendLeadProposal(p.id), "Sent")}>Send</button>}
                      {p.status === "sent" && <>
                        <button className="btn btn-sm btn-primary" onClick={() => act(() => api.acceptLeadProposal(p.id), "Accepted")}>Accept</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => act(() => api.declineLeadProposal(p.id), "Declined")}>Decline</button>
                      </>}
                      <button className="btn btn-sm btn-ghost" onClick={() => remove(p)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {tab === "templates" && (
        <Card padded={false}>
          {templates.loading ? <Loading /> : templates.error ? <div className="p-5"><ErrorNote message={templates.error} /></div> : (templates.data ?? []).length === 0 ? (
            <EmptyState title="No proposal templates yet" hint="Build a proposal, then use “Save as template” to reuse its line items." />
          ) : (
            <DataTable
              columns={[
                { key: "n", label: "Template" }, { key: "items", label: "Items", align: "right" },
                { key: "total", label: "Total", align: "right" }, { key: "act", label: "" },
              ]}
            >
              {(templates.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{t.description}</div>}
                  </td>
                  <td className="num tnum">{t.items.length}</td>
                  <td className="num tnum">{money(t.total)}</td>
                  <td className="num"><button className="btn btn-sm btn-ghost" onClick={() => removeTemplate(t)}>Delete</button></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {tab === "calendar" && (
        <Card>
          {calendar.loading ? <Loading variant="text" /> : calendar.error ? <ErrorNote message={calendar.error} /> : calByDate.length === 0 ? (
            <EmptyState title="Nothing scheduled" hint="Follow-ups, design sessions and proposal expiries in the next 30 days will show here." />
          ) : (
            <div className="space-y-5">
              {calByDate.map(([d, events]) => (
                <div key={d}>
                  <div className="mb-2 text-sm font-semibold">{day(d)}</div>
                  <div className="space-y-2">
                    {events.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--neutral-soft)" }}>
                        <Badge tone={KIND_TONE[e.kind] ?? "neutral"}>{e.kind.replaceAll("_", " ")}</Badge>
                        <span className="text-sm font-medium">{e.title}</span>
                        {e.detail && <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>· {e.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "map" && (
        <Card padded={false}>
          {mapPts.loading ? <Loading variant="text" label="Loading leads" /> : mapPts.error ? <div className="p-5"><ErrorNote message={mapPts.error} /></div> : (mapPts.data ?? []).length === 0 ? (
            <EmptyState title="No mapped leads" hint="Leads appear here once they have geocoded coordinates. Add latitude/longitude to a lead to plot it." />
          ) : (
            <div className="p-4"><SalesMap points={mapPts.data ?? []} /></div>
          )}
        </Card>
      )}

      <Modal open={createOpen} title="New lead proposal" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <Field label="Lead">
            <select className="input" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
              <option value="">Select a lead…</option>
              {(leads.data?.items ?? []).map((l) => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
          </Field>
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount"><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Valid until"><input className="input" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </Modal>
      {/* proposal line-item builder */}
      <Modal open={building !== null} title={`Build proposal — ${building?.title ?? ""}`} onClose={() => setBuilding(null)}>
        {builderDetail.loading ? <Loading variant="text" /> : builderDetail.data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
                {builderDetail.data.items.length} line item{builderDetail.data.items.length === 1 ? "" : "s"}
              </span>
              <span className="text-lg font-semibold">Total {money(builderDetail.data.total)}</span>
            </div>

            {building?.status !== "accepted" && building?.status !== "declined" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--brand-soft)" }}>
                <span className="text-sm" style={{ color: "var(--brand-fg)" }}>Templates:</span>
                <select
                  className="input w-auto max-w-[16rem]"
                  value=""
                  onChange={(e) => { if (e.target.value) void applyTemplate(e.target.value); e.target.value = ""; }}
                  aria-label="Apply a template"
                >
                  <option value="">Apply a template…</option>
                  {(templates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({money(t.total)})</option>)}
                </select>
                <button className="btn btn-sm btn-ghost" disabled={builderDetail.data.items.length === 0} onClick={saveAsTemplate}>
                  Save as template
                </button>
              </div>
            )}

            <div className="max-h-[40vh] overflow-auto">
              <DataTable
                columns={[
                  { key: "d", label: "Item" }, { key: "q", label: "Qty", align: "right" },
                  { key: "uc", label: "Unit cost", align: "right" }, { key: "mu", label: "Markup", align: "right" },
                  { key: "ep", label: "Price", align: "right" }, { key: "x", label: "" },
                ]}
                empty="No line items yet — add one below, or the flat amount is used."
              >
                {builderDetail.data.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div className="font-medium">{it.description}</div>
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{it.group_name}{it.unit ? ` · ${it.unit}` : ""}</div>
                    </td>
                    <td className="num tnum">{Number(it.quantity)}</td>
                    <td className="num tnum">{money(it.unit_cost)}</td>
                    <td className="num tnum">{Number(it.markup_percent)}%</td>
                    <td className="num tnum">{money(it.extended_price)}</td>
                    <td className="num">{building?.status !== "accepted" && building?.status !== "declined" && <button className="btn btn-sm btn-ghost" onClick={() => removeItem(it.id)}>×</button>}</td>
                  </tr>
                ))}
              </DataTable>
            </div>

            {building?.status !== "accepted" && building?.status !== "declined" && (
              <div className="rounded-lg p-3" style={{ background: "var(--neutral-soft)" }}>
                <div className="grid gap-2 sm:grid-cols-6">
                  <input className="input sm:col-span-2" placeholder="Description" value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />
                  <input className="input" placeholder="Group" value={item.group_name} onChange={(e) => setItem({ ...item, group_name: e.target.value })} />
                  <input className="input" placeholder="Unit" value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} />
                  <input className="input" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} />
                  <input className="input" type="number" placeholder="Unit cost" value={item.unit_cost} onChange={(e) => setItem({ ...item, unit_cost: e.target.value })} />
                  <input className="input" type="number" placeholder="Markup %" value={item.markup_percent} onChange={(e) => setItem({ ...item, markup_percent: e.target.value })} />
                </div>
                <div className="mt-3 flex justify-end"><button className="btn btn-sm btn-primary" onClick={addItem}>Add item</button></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {dialog}
    </div>
  );
}
