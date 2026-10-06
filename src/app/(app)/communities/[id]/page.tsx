"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";
import { CommunityForm, PlotBar } from "@/components/CommunityForm";
import { useConfirm } from "@/components/feedback";
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
import { byId, useAsync } from "@/lib/hooks";
import type { CommunityPhase, Lot, LotStatus } from "@/types/api";

const TABS = ["Plots", "Phases", "Plans", "Details"] as const;
type Tab = (typeof TABS)[number];

const LOT_LABEL: Record<LotStatus, string> = {
  not_released: "Not released",
  available: "For sale",
  held: "On hold",
  sold: "Sold",
  closed: "Handed over",
};

const LOT_COLOUR: Record<LotStatus, { bg: string; fg: string }> = {
  not_released: { bg: "var(--neutral-soft)", fg: "var(--fg-subtle)" },
  available: { bg: "var(--brand-soft)", fg: "var(--brand-fg)" },
  held: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  sold: { bg: "var(--ok-soft)", fg: "var(--ok)" },
  closed: { bg: "var(--neutral-soft)", fg: "var(--fg-muted)" },
};

const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
};

export default function CommunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const community = useAsync(() => api.getCommunity(id), [id]);
  const phases = useAsync(() => api.listPhases(id), [id]);
  const [tab, setTab] = useState<Tab>("Plots");
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  const c = community.data;
  const st = c?.stats;
  const refresh = () => {
    community.reload();
    phases.reload();
  };

  if (community.error) return <ErrorNote message={community.error} />;

  return (
    <>
      <PageHeader
        title={c?.name ?? "Community"}
        subtitle={
          c
            ? [c.code, [c.city, c.county].filter(Boolean).join(", "), c.postcode, c.local_authority]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        action={
          <div className="flex items-center gap-2">
            {c && <StatusBadge status={c.status.replace("_", " ")} />}
            <Button variant="ghost" onClick={() => setEditing(true)} disabled={!c}>
              Edit
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="For sale"
          value={st?.plots.available ?? "—"}
          tone={st && !st.plots.available && c?.status === "selling" ? "danger" : "default"}
          hint={st ? `${st.plots.held} on hold · ${st.plots.not_released} not released` : undefined}
        />
        <StatTile
          label="Sold"
          value={st ? st.plots.sold + st.plots.closed : "—"}
          hint={st ? `${st.plots.closed} handed over of ${c?.planned_plots ?? st.plots.total}` : undefined}
        />
        <StatTile
          label="Sales pace"
          value={st ? `${Number(st.absorption).toFixed(1)}/mo` : "—"}
          tone={
            st && c?.target_sales_per_month && Number(st.absorption) < Number(c.target_sales_per_month)
              ? "warn"
              : "default"
          }
          hint={
            c?.target_sales_per_month
              ? `Target ${c.target_sales_per_month}/mo · ${st?.sales_90_days ?? 0} in 90 days`
              : `${st?.sales_90_days ?? 0} sales in 90 days`
          }
        />
        <StatTile
          label="Months of supply"
          value={st?.months_of_supply ?? "—"}
          hint={st?.spec_homes ? `${st.spec_homes} spec home${st.spec_homes === 1 ? "" : "s"} to sell` : "Unsold plots at the current pace"}
          tone={st?.spec_homes ? "warn" : "default"}
        />
      </div>

      {st && (
        <div className="mb-5">
          <PlotBar counts={st.plots} />
        </div>
      )}

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        counts={{ Plots: st?.holds_expiring_soon }}
      />

      {tab === "Plots" && <PlotsTab communityId={id} phases={phases.data ?? []} onChange={community.reload} />}
      {tab === "Phases" && <PhasesTab communityId={id} phases={phases.data ?? []} loading={phases.loading} onChange={refresh} />}
      {tab === "Plans" && <PlansTab communityId={id} />}
      {tab === "Details" && c && <DetailsTab communityId={id} />}

      {editing && c && (
        <CommunityForm
          community={c}
          open
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Community updated");
            community.reload();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ plots */

type PlotDialog = { kind: "hold" | "edit"; lot: Lot } | { kind: "add" } | { kind: "bulk" };

function PlotsTab({
  communityId,
  phases,
  onChange,
}: {
  communityId: string;
  phases: CommunityPhase[];
  onChange: () => void;
}) {
  const [status, setStatus] = useState<LotStatus | "">("");
  const [phaseId, setPhaseId] = useState("");
  const [view, setView] = useState<"list" | "plan">("list");
  const lots = useAsync(
    () => api.listLots(communityId, { status: status || undefined, phase_id: phaseId || undefined }),
    [communityId, status, phaseId],
  );
  const [dialog, setDialog] = useState<PlotDialog | null>(null);
  const toast = useToast();
  const phase = byId(phases);

  async function act(p: Promise<Lot>, done: string) {
    try {
      await toast.promise(p, { success: done, error: "Not changed" });
    } catch {
      /* the toast carries the reason */
    }
    lots.reload();
    onChange();
  }

  function actions(l: Lot) {
    const items: { label: string; run: () => void; tone?: "danger" }[] = [];
    if (l.status === "not_released")
      items.push({ label: "Release for sale", run: () => act(api.releaseLot(l.id), `Plot ${l.lot_number} is on sale`) });
    if (l.status === "available") {
      items.push({ label: "Hold for a buyer…", run: () => setDialog({ kind: "hold", lot: l }) });
      items.push({ label: "Withdraw from sale", run: () => act(api.withdrawLot(l.id), `Plot ${l.lot_number} withdrawn`) });
    }
    if (l.status === "held")
      items.push({ label: "Lift the hold", run: () => act(api.unholdLot(l.id), `Plot ${l.lot_number} back on sale`) });
    items.push({ label: "Edit plot…", run: () => setDialog({ kind: "edit", lot: l }) });
    return items;
  }

  const rows = lots.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["", "available", "held", "not_released", "sold", "closed"] as const).map((s) => (
          <button
            key={s || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setStatus(s)}
            style={status === s ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {s ? LOT_LABEL[s] : "All"}
          </button>
        ))}
        {phases.length > 0 && (
          <select className="input" style={{ width: "auto" }} value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
            <option value="">All phases</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <span className="flex-1" />
        <div className="flex gap-1">
          {(["list", "plan"] as const).map((v) => (
            <button
              key={v}
              className="btn btn-ghost btn-sm"
              onClick={() => setView(v)}
              style={view === v ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
            >
              {v === "list" ? "List" : "Site plan"}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "bulk" })}>
          Add a range
        </Button>
        <Button variant="primary" size="sm" onClick={() => setDialog({ kind: "add" })}>
          Add plot
        </Button>
      </div>

      {lots.loading ? (
        <Loading />
      ) : view === "plan" ? (
        <Card>
          {rows.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              No plots match.
            </p>
          ) : (
            <>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(5.5rem, 1fr))" }}>
                {rows.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setDialog({ kind: "edit", lot: l })}
                    className="rounded-lg p-2 text-left transition hover:opacity-80"
                    style={{ background: LOT_COLOUR[l.status].bg, color: LOT_COLOUR[l.status].fg, border: "1px solid var(--border)" }}
                    title={`${LOT_LABEL[l.status]}${l.job_number ? ` · ${l.job_number}` : ""}${l.held_for_name ? ` · for ${l.held_for_name}` : ""}`}
                  >
                    <div className="text-lg font-semibold tnum">{l.lot_number}</div>
                    <div className="text-[0.65rem] uppercase tracking-wide">{LOT_LABEL[l.status]}</div>
                    {l.job_number && (
                      <div className="text-[0.65rem]">
                        {l.is_spec ? "spec · " : ""}
                        {l.job_number}
                      </div>
                    )}
                    {l.hold_days_left !== null && <div className="text-[0.65rem]">{l.hold_days_left}d left</div>}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs" style={{ color: "var(--fg-muted)" }}>
                {(Object.keys(LOT_LABEL) as LotStatus[]).map((s) => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded" style={{ background: LOT_COLOUR[s].bg, border: "1px solid var(--border)" }} />
                    {LOT_LABEL[s]}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card padded={false}>
          <DataTable
            columns={[
              { key: "plot", label: "Plot" },
              { key: "addr", label: "Address" },
              { key: "status", label: "Sales" },
              { key: "home", label: "Home" },
              { key: "premium", label: "Premium", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No plots match. Add one, or lay out a range."
          >
            {rows.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium">Plot {l.lot_number}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {l.phase_id ? phase.get(l.phase_id)?.name : "No phase"}
                    {l.plot_area_sqm ? ` · ${Number(l.plot_area_sqm)} m²` : ""}
                  </div>
                </td>
                <td style={{ color: "var(--fg-muted)" }}>
                  {l.address ?? "—"}
                  {l.postcode && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {l.postcode}
                    </div>
                  )}
                </td>
                <td>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: LOT_COLOUR[l.status].bg, color: LOT_COLOUR[l.status].fg }}
                  >
                    {LOT_LABEL[l.status]}
                  </span>
                  {l.status === "held" && (
                    <div className="mt-1 text-xs" style={{ color: l.hold_days_left !== null && l.hold_days_left <= 3 ? "var(--danger)" : "var(--fg-muted)" }}>
                      {l.held_for_name ? `For ${l.held_for_name} · ` : ""}
                      until {day(l.hold_until)}
                      {l.hold_days_left !== null ? ` (${l.hold_days_left}d)` : ""}
                      {l.hold_reason && <div style={{ color: "var(--fg-subtle)" }}>{l.hold_reason}</div>}
                    </div>
                  )}
                </td>
                <td>
                  {l.job_id ? (
                    <>
                      <Link href={`/jobs/${l.job_id}`} style={{ color: "var(--brand)" }}>
                        {l.job_number}
                      </Link>
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {l.job_status?.replace("_", " ")}
                        {l.is_spec && <Badge tone="warn">spec</Badge>}
                      </div>
                    </>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  )}
                </td>
                <td className="num">{Number(l.premium) ? money(l.premium) : "—"}</td>
                <td className="num">
                  <Menu label="⋯" items={actions(l)} />
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      {dialog?.kind === "hold" && (
        <HoldDialog
          lot={dialog.lot}
          communityId={communityId}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            lots.reload();
            onChange();
          }}
        />
      )}
      {(dialog?.kind === "edit" || dialog?.kind === "add") && (
        <PlotDialogForm
          communityId={communityId}
          lot={dialog.kind === "edit" ? dialog.lot : null}
          phases={phases}
          actions={dialog.kind === "edit" ? actions(dialog.lot).filter((a) => a.label !== "Edit plot…") : []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            lots.reload();
            onChange();
          }}
        />
      )}
      {dialog?.kind === "bulk" && (
        <BulkDialog
          communityId={communityId}
          phases={phases}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            lots.reload();
            onChange();
          }}
        />
      )}
    </div>
  );
}

function HoldDialog({
  lot,
  communityId,
  onClose,
  onDone,
}: {
  lot: Lot;
  communityId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const leads = useAsync(() => api.listLeads({ view: "open", community_id: communityId, size: 100 }), [communityId]);
  const [until, setUntil] = useState(localDay(14));
  const [reason, setReason] = useState("");
  const [leadId, setLeadId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.holdLot(lot.id, { until, reason: reason || undefined, lead_id: leadId || undefined });
      toast.success(`Plot ${lot.lot_number} held until ${day(until)}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not hold the plot");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Hold plot ${lot.lot_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Hold until" hint="Up to 90 days. When it passes, the plot goes back on sale by itself.">
          <input className="input" type="date" value={until} min={localDay()} max={localDay(90)} onChange={(e) => setUntil(e.target.value)} required />
        </Field>
        <Field label="For which buyer" hint="Open leads interested in this community.">
          <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Not linked to a lead</option>
            {(leads.data?.items ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason">
          <input className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Waiting on mortgage in principle" />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Holding…" : "Hold plot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PlotDialogForm({
  communityId,
  lot,
  phases,
  actions,
  onClose,
  onDone,
}: {
  communityId: string;
  lot: Lot | null;
  phases: CommunityPhase[];
  actions: { label: string; run: () => void; tone?: "danger" }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    lot_number: lot?.lot_number ?? "",
    address: lot?.address ?? "",
    postcode: lot?.postcode ?? "",
    premium: lot ? String(Number(lot.premium)) : "0",
    phase_id: lot?.phase_id ?? "",
    plot_area_sqm: lot?.plot_area_sqm ? String(Number(lot.plot_area_sqm)) : "",
    notes: lot?.notes ?? "",
    status: "available" as "available" | "not_released",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sold = lot?.status === "sold" || lot?.status === "closed";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      lot_number: f.lot_number.trim(),
      address: f.address.trim() || null,
      postcode: f.postcode.trim() || null,
      premium: f.premium || "0",
      phase_id: f.phase_id || null,
      plot_area_sqm: f.plot_area_sqm || null,
      notes: f.notes.trim() || null,
    };
    try {
      if (lot) await api.updateLot(lot.id, sold ? { ...body, premium: undefined } : body);
      else await api.createLot(communityId, { ...body, status: f.status });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plot");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={lot ? `Plot ${lot.lot_number}` : "Add a plot"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {lot && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: LOT_COLOUR[lot.status].bg, color: LOT_COLOUR[lot.status].fg }}
            >
              {LOT_LABEL[lot.status]}
            </span>
            {lot.job_number && (
              <Link href={`/jobs/${lot.job_id}`} style={{ color: "var(--brand)" }}>
                {lot.job_number}
                {lot.is_spec ? " (spec)" : ""}
              </Link>
            )}
            {actions.map((a) => (
              <Button
                key={a.label}
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  a.run();
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Plot number">
            <input className="input" value={f.lot_number} onChange={set("lot_number")} required maxLength={32} />
          </Field>
          <Field label="Phase">
            <select className="input" value={f.phase_id} onChange={set("phase_id")}>
              <option value="">No phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Address">
            <input className="input" value={f.address} onChange={set("address")} maxLength={300} />
          </Field>
          <Field label="Postcode">
            <input className="input" value={f.postcode} onChange={set("postcode")} maxLength={20} placeholder="BH15 1AA" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plot premium" hint={sold ? "Fixed — the contract priced it." : "On top of the plan's price."}>
            <input className="input" inputMode="decimal" value={f.premium} onChange={set("premium")} disabled={sold} />
          </Field>
          <Field label="Plot area (m²)">
            <input className="input" inputMode="decimal" value={f.plot_area_sqm} onChange={set("plot_area_sqm")} />
          </Field>
        </div>
        {!lot && (
          <Field label="Starting position">
            <select className="input" value={f.status} onChange={set("status")}>
              <option value="available">On sale now</option>
              <option value="not_released">Not released yet</option>
            </select>
          </Field>
        )}
        <Field label="Notes" hint="Orientation, garden, easements — what sales should know.">
          <textarea className="input" rows={2} value={f.notes} onChange={set("notes")} maxLength={1000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : lot ? "Save plot" : "Add plot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkDialog({
  communityId,
  phases,
  onClose,
  onDone,
}: {
  communityId: string;
  phases: CommunityPhase[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState({ start: "1", end: "20", prefix: "", phase_id: "", premium: "0", postcode: "", status: "not_released" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const count = Math.max(0, Number(f.end) - Number(f.start) + 1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.bulkCreateLots(communityId, {
        start: Number(f.start),
        end: Number(f.end),
        prefix: f.prefix || undefined,
        phase_id: f.phase_id || undefined,
        premium: f.premium || "0",
        postcode: f.postcode || undefined,
        status: f.status as "available" | "not_released",
      });
      toast.success(
        `${r.created} plot${r.created === 1 ? "" : "s"} added`,
        r.skipped.length ? `Skipped ${r.skipped.length} that already existed` : undefined,
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the plots");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Lay out a range of plots" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prefix" hint="Optional, e.g. B">
            <input className="input" value={f.prefix} onChange={set("prefix")} maxLength={10} />
          </Field>
          <Field label="From">
            <input className="input" type="number" min={0} value={f.start} onChange={set("start")} required />
          </Field>
          <Field label="To">
            <input className="input" type="number" min={0} value={f.end} onChange={set("end")} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phase">
            <select className="input" value={f.phase_id} onChange={set("phase_id")}>
              <option value="">No phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Starting position">
            <select className="input" value={f.status} onChange={set("status")}>
              <option value="not_released">Not released yet</option>
              <option value="available">On sale now</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Premium on each">
            <input className="input" inputMode="decimal" value={f.premium} onChange={set("premium")} />
          </Field>
          <Field label="Postcode">
            <input className="input" value={f.postcode} onChange={set("postcode")} maxLength={20} />
          </Field>
        </div>
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {count > 500
            ? "Up to 500 plots at a time."
            : `${count} plot${count === 1 ? "" : "s"}: ${f.prefix}${f.start} to ${f.prefix}${f.end}. Numbers that already exist are skipped.`}
        </p>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy || count < 1 || count > 500}>
            {busy ? "Adding…" : `Add ${count} plots`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- phases */

function PhasesTab({
  communityId,
  phases,
  loading,
  onChange,
}: {
  communityId: string;
  phases: CommunityPhase[];
  loading: boolean;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [planned, setPlanned] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<CommunityPhase | null>(null);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await toast.promise(api.createPhase(communityId, { name, planned_release: planned || undefined }), {
        success: `${name} added`,
        error: "Could not add the phase",
      });
      setName("");
      setPlanned("");
      onChange();
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }

  async function run(p: Promise<unknown>, done: string) {
    try {
      await toast.promise(p, { success: done, error: "Not changed" });
    } catch {
      /* toast */
    }
    onChange();
  }

  return (
    <div className="space-y-4">
      <Card padded={false}>
        {loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Phase" },
              { key: "release", label: "Release" },
              { key: "plots", label: "Plots" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No phases. Plots can still be released one at a time."
          >
            {phases.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="font-medium">{p.name}</div>
                  {p.notes && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {p.notes}
                    </div>
                  )}
                </td>
                <td className="text-sm">
                  {p.released_on ? (
                    <Badge tone="ok">Released {day(p.released_on)}</Badge>
                  ) : p.planned_release ? (
                    <span style={{ color: p.planned_release < localDay() ? "var(--danger)" : undefined }}>
                      Planned {day(p.planned_release)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>Not scheduled</span>
                  )}
                </td>
                <td>
                  <PlotBar counts={p.plots} />
                </td>
                <td className="num">
                  <div className="flex justify-end gap-1">
                    {p.plots.not_released > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          ask({
                            title: `Release ${p.name}?`,
                            confirmLabel: `Release ${p.plots.not_released} plots`,
                            body: `${p.plots.not_released} plots go on sale today. The development opens for sale if it was still in planning.`,
                            onConfirm: () => run(api.releasePhase(p.id), `${p.name} released`),
                          })
                        }
                      >
                        Release {p.plots.not_released}
                      </Button>
                    )}
                    <Menu
                      label="⋯"
                      items={[
                        { label: "Edit…", run: () => setRenaming(p) },
                        {
                          label: "Delete",
                          tone: "danger",
                          run: () => run(api.deletePhase(p.id), `${p.name} deleted`),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card title="Add a phase">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder={`Phase ${phases.length + 1}`} />
            </Field>
          </div>
          <Field label="Planned release">
            <input className="input" type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={busy}>
            Add phase
          </Button>
        </form>
      </Card>

      {renaming && <PhaseEdit phase={renaming} onClose={() => setRenaming(null)} onDone={() => { setRenaming(null); onChange(); }} />}
      {dialog}
    </div>
  );
}

function PhaseEdit({ phase, onClose, onDone }: { phase: CommunityPhase; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(phase.name);
  const [planned, setPlanned] = useState(phase.planned_release ?? "");
  const [notes, setNotes] = useState(phase.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updatePhase(phase.id, { name, planned_release: planned || null, notes: notes || null });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={`Edit ${phase.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </Field>
        <Field label="Planned release">
          <input className="input" type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ plans */

function PlansTab({ communityId }: { communityId: string }) {
  const offered = useAsync(() => api.communityPlans(communityId), [communityId]);
  const plans = useAsync(() => api.listPlans(), []);
  const [adding, setAdding] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const toast = useToast();
  const taken = new Set((offered.data ?? []).map((o) => o.plan_id));
  const addable = (plans.data ?? []).filter((p) => !taken.has(p.id));

  async function save(plan_id: string, body: { base_price?: string | null; is_active?: boolean }, done: string) {
    try {
      await toast.promise(api.setCommunityPlan(communityId, { plan_id, ...body }), { success: done, error: "Not saved" });
      offered.reload();
    } catch {
      /* toast */
    }
  }

  return (
    <div className="space-y-4">
      <Card padded={false}>
        {offered.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "plan", label: "House type" },
              { key: "std", label: "Standard price", align: "right" },
              { key: "here", label: "Price here", align: "right" },
              { key: "homes", label: "Live homes", align: "right" },
              { key: "sale", label: "On sale" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No house types offered here yet."
          >
            {(offered.data ?? []).map((o) => {
              const draft = prices[o.plan_id] ?? (o.base_price ? String(Number(o.base_price)) : "");
              const changed = draft !== (o.base_price ? String(Number(o.base_price)) : "");
              return (
                <tr key={o.plan_id}>
                  <td>
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {o.code}
                      {o.bedrooms ? ` · ${o.bedrooms} bed` : ""}
                    </div>
                  </td>
                  <td className="num" style={{ color: "var(--fg-muted)" }}>
                    {money(o.plan_base_price)}
                  </td>
                  <td className="num">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        className="input tnum"
                        style={{ width: "8rem", textAlign: "right" }}
                        inputMode="decimal"
                        placeholder={String(Number(o.plan_base_price))}
                        value={draft}
                        onChange={(e) => setPrices((p) => ({ ...p, [o.plan_id]: e.target.value }))}
                      />
                      {changed && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => save(o.plan_id, { base_price: draft || null, is_active: o.is_active }, `${o.name} price saved`)}
                        >
                          Save
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="num">{o.homes}</td>
                  <td>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={o.is_active}
                        onChange={(e) =>
                          save(o.plan_id, { base_price: o.base_price, is_active: e.target.checked }, e.target.checked ? `${o.name} on sale` : `${o.name} withdrawn`)
                        }
                      />
                      {o.is_active ? "Yes" : "Withdrawn"}
                    </label>
                  </td>
                  <td className="num">
                    <Menu
                      label="⋯"
                      items={[
                        {
                          label: "Stop offering here",
                          tone: "danger",
                          run: async () => {
                            try {
                              await toast.promise(api.removeCommunityPlan(communityId, o.plan_id), {
                                success: `${o.name} removed`,
                                error: "Not removed",
                              });
                            } catch {
                              /* toast */
                            }
                            offered.reload();
                          },
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {addable.length > 0 && (
        <Card title="Offer a house type here">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <Field label="House type" hint="Priced at its standard price until you set one for this development.">
                <select className="input" value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Select…</option>
                  {addable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name} ({money(p.base_price)})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Button
              variant="primary"
              disabled={!adding}
              onClick={async () => {
                await save(adding, {}, "House type added");
                setAdding("");
              }}
            >
              Add
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- details */

function DetailsTab({ communityId }: { communityId: string }) {
  const community = useAsync(() => api.getCommunity(communityId), [communityId]);
  const users = useAsync(() => api.listUsers(1, 200), []);
  const who = byId(users.data?.items);
  const c = community.data;
  if (!c) return <Loading />;

  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusBadge key="s" status={c.status.replace("_", " ")} />],
    ["Site address", [c.address, c.city, c.county, c.postcode].filter(Boolean).join(", ") || "—"],
    ["Planning authority", c.local_authority ?? "—"],
    ["Consented plots", c.planned_plots ?? "—"],
    ["Opened for sale", c.opened_on ? day(c.opened_on) : "Not yet"],
    ["Target sales", c.target_sales_per_month ? `${c.target_sales_per_month} a month` : "—"],
    ["Sales manager", c.sales_manager_id ? who.get(c.sales_manager_id)?.full_name ?? "—" : "—"],
    ["Site manager", c.site_manager_id ? who.get(c.site_manager_id)?.full_name ?? "—" : "—"],
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Development">
        <dl className="space-y-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt style={{ color: "var(--fg-muted)" }}>{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Description">
        <p className="whitespace-pre-line text-sm" style={{ color: c.description ? undefined : "var(--fg-subtle)" }}>
          {c.description ?? "No description yet. Use Edit to add the pitch sales should give."}
        </p>
      </Card>
    </div>
  );
}
