"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";
import { LAND_STATUS, LandForm, landStatusLabel, planningLabel } from "@/components/LandForm";
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
  Tabs,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { LandBudgetLine, LandObligation, LandPhaseStatus, LandProject, ObligationKind } from "@/types/api";

const TABS = ["Obligations", "Development budget", "Appraisal"] as const;
type Tab = (typeof TABS)[number];

const KINDS: { value: ObligationKind; label: string }[] = [
  { value: "condition", label: "Planning condition" },
  { value: "s106", label: "S106 obligation" },
  { value: "cil", label: "CIL payment" },
  { value: "s38", label: "S38 road adoption" },
  { value: "s278", label: "S278 highway works" },
  { value: "s104", label: "S104 sewer adoption" },
  { value: "other", label: "Other" },
];
const kindLabel = (k: ObligationKind) => KINDS.find((x) => x.value === k)?.label ?? k;

export default function LandProjectPage() {
  const { id } = useParams<{ id: string }>();
  const project = useAsync(() => api.getLandProject(id), [id]);
  const communities = useAsync(() => api.listCommunities(), []);
  const [tab, setTab] = useState<Tab>("Obligations");
  const [editing, setEditing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const toast = useToast();
  const community = byId(communities.data);

  if (project.error) return <ErrorNote message={project.error} />;
  if (!project.data) return <Loading />;
  const p = project.data;
  const open = p.obligations.filter((o) => o.status === "outstanding" || o.status === "submitted");
  const pre = open.filter((o) => o.pre_commencement);
  const lapsing = p.status !== "complete" && p.days_to_consent_expiry !== null && p.days_to_consent_expiry <= 180;

  async function moveTo(status: LandPhaseStatus) {
    try {
      await toast.promise(api.updateLandProject(p.id, { status }), {
        success: `Moved to ${landStatusLabel(status)}`,
        error: "Not moved",
      });
    } catch {
      /* the toast carries the reason - e.g. conditions still to discharge */
    }
    project.reload();
  }

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={[p.code, p.site_area_ha && `${Number(p.site_area_ha)} ha`, p.local_authority, p.planning_ref].filter(Boolean).join(" · ")}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={p.status === "complete" ? "ok" : "neutral"}>{landStatusLabel(p.status)}</Badge>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Menu
              label="Move to…"
              items={LAND_STATUS.filter((s) => s.value !== p.status).map((s) => ({ label: s.label, run: () => moveTo(s.value) }))}
            />
            <Button variant="primary" onClick={() => setDelivering(true)} disabled={!p.is_buildable || !p.community_id}>
              Deliver plots
            </Button>
          </div>
        }
      />

      <div
        className="mb-5 rounded-lg px-4 py-3 text-sm"
        style={{
          background: p.is_buildable ? (lapsing ? "var(--danger-soft)" : "var(--ok-soft)") : "var(--warn-soft)",
          color: p.is_buildable ? (lapsing ? "var(--danger)" : "var(--ok)") : "var(--warn)",
        }}
      >
        <strong>{planningLabel(p.planning_status)}</strong>
        {p.planning_approved_on && ` · approved ${day(p.planning_approved_on)}`}
        {p.planning_expires_on &&
          ` · lapses ${day(p.planning_expires_on)}${p.days_to_consent_expiry !== null ? ` (${p.days_to_consent_expiry} days)` : ""}`}
        {!p.is_buildable && " — works cannot start until the permission allows building."}
        {p.is_buildable && pre.length > 0 && ` — ${pre.length} pre-commencement condition${pre.length === 1 ? "" : "s"} to discharge before works start.`}
        {!p.community_id && (
          <span className="block text-xs">Link a community (Edit) to deliver plots into it.</span>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Cost per plot"
          value={p.cost_per_lot ? money(p.cost_per_lot) : "—"}
          hint={`Land ${money(p.acquisition_cost)} + development ${money(p.forecast_total)} forecast`}
        />
        <StatTile
          label="Development spend"
          value={money(p.actual_total)}
          tone={Number(p.forecast_total) > Number(p.budget_total) ? "danger" : "default"}
          hint={`of ${money(p.budget_total)} budget${Number(p.forecast_total) > Number(p.budget_total) ? ` · over by ${money(Number(p.forecast_total) - Number(p.budget_total))}` : ""}`}
        />
        <StatTile
          label="Plots delivered"
          value={`${p.delivered_lots} / ${p.planned_lots ?? "—"}`}
          hint={p.community_id ? `into ${community.get(p.community_id)?.name ?? "the community"}` : "No community linked"}
        />
        <StatTile
          label="Margin on GDV"
          value={p.margin_on_gdv ? `${p.margin_on_gdv}%` : "—"}
          tone={p.margin_on_gdv ? (Number(p.margin_on_gdv) < 15 ? "danger" : "ok") : "default"}
          hint={p.profit ? `Profit ${money(p.profit)}` : "Set GDV and build cost to appraise"}
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} counts={{ Obligations: open.filter((o) => o.is_overdue || o.pre_commencement).length }} />

      {tab === "Obligations" && <Obligations project={p} onChange={project.reload} />}
      {tab === "Development budget" && <Budget project={p} onChange={project.reload} />}
      {tab === "Appraisal" && <Appraisal project={p} />}

      {editing && (
        <LandForm
          project={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Project updated");
            project.reload();
          }}
        />
      )}
      {delivering && p.community_id && (
        <DeliverDialog
          project={p}
          onClose={() => setDelivering(false)}
          onDone={() => {
            setDelivering(false);
            project.reload();
          }}
        />
      )}
    </>
  );
}

function Obligations({ project, onChange }: { project: LandProject; onChange: () => void }) {
  const [editing, setEditing] = useState<LandObligation | "new" | null>(null);
  const toast = useToast();

  async function run(p: Promise<unknown>, done: string) {
    try {
      await toast.promise(p, { success: done, error: "Not changed" });
    } catch {
      /* toast */
    }
    onChange();
  }

  return (
    <Card
      title="Conditions and obligations"
      padded={false}
      action={
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          Add
        </Button>
      }
    >
      <DataTable
        columns={[
          { key: "what", label: "Obligation" },
          { key: "trigger", label: "When" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status" },
          { key: "act", label: "", align: "right" },
        ]}
        empty="No conditions or obligations recorded. Add them from the decision notice and the S106 agreement."
      >
        {project.obligations.map((o) => {
          const openNow = o.status === "outstanding" || o.status === "submitted";
          return (
            <tr key={o.id} style={openNow ? undefined : { opacity: 0.6 }}>
              <td>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{kindLabel(o.kind)}</Badge>
                  {o.reference && <span className="font-medium">{o.reference}</span>}
                  {o.pre_commencement && <Badge tone="warn">pre-commencement</Badge>}
                </div>
                <div className="mt-1 max-w-[28rem] text-sm">{o.description}</div>
              </td>
              <td className="text-sm" style={{ color: o.is_overdue ? "var(--danger)" : "var(--fg-muted)" }}>
                {o.trigger ?? "—"}
                {o.due_date && <div className="text-xs">due {day(o.due_date)}</div>}
              </td>
              <td className="num">{o.amount ? money(o.amount) : "—"}</td>
              <td>
                <Badge tone={o.is_overdue ? "danger" : openNow ? "warn" : "ok"}>{o.is_overdue ? "overdue" : o.status}</Badge>
                {o.completed_on && (
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {day(o.completed_on)}
                  </div>
                )}
              </td>
              <td className="num">
                <Menu
                  label="⋯"
                  items={[
                    ...(o.status === "outstanding"
                      ? [{ label: "Submitted to the council", run: () => run(api.submitLandObligation(o.id), "Marked as submitted") }]
                      : []),
                    ...(openNow
                      ? [
                          {
                            label: o.kind === "s106" || o.kind === "cil" ? "Mark paid / discharged" : "Mark discharged",
                            run: () => run(api.completeLandObligation(o.id), "Done"),
                          },
                          { label: "Waive", run: () => run(api.completeLandObligation(o.id, { waived: true }), "Waived") },
                        ]
                      : [{ label: "Reopen", run: () => run(api.reopenLandObligation(o.id), "Reopened") }]),
                    { label: "Edit…", run: () => setEditing(o) },
                    { label: "Delete", tone: "danger" as const, run: () => run(api.deleteLandObligation(o.id), "Deleted") },
                  ]}
                />
              </td>
            </tr>
          );
        })}
      </DataTable>
      {editing && (
        <ObligationDialog
          projectId={project.id}
          obligation={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function ObligationDialog({
  projectId,
  obligation,
  onClose,
  onDone,
}: {
  projectId: string;
  obligation: LandObligation | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    kind: (obligation?.kind ?? "condition") as ObligationKind,
    reference: obligation?.reference ?? "",
    description: obligation?.description ?? "",
    trigger: obligation?.trigger ?? "",
    pre_commencement: obligation?.pre_commencement ?? false,
    due_date: obligation?.due_date ?? "",
    amount: obligation?.amount ? String(Number(obligation.amount)) : "",
    notes: obligation?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (obligation) {
        await api.updateLandObligation(obligation.id, {
          kind: f.kind,
          reference: f.reference || null,
          description: f.description,
          trigger: f.trigger || null,
          pre_commencement: f.pre_commencement,
          due_date: f.due_date || null,
          amount: f.amount || null,
          notes: f.notes || null,
        });
      } else {
        await api.addLandObligation(projectId, {
          kind: f.kind,
          description: f.description,
          reference: f.reference || undefined,
          trigger: f.trigger || undefined,
          pre_commencement: f.pre_commencement,
          due_date: f.due_date || undefined,
          amount: f.amount || undefined,
          notes: f.notes || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={obligation ? "Edit obligation" : "Add a condition or obligation"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ObligationKind })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference">
            <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} maxLength={64} placeholder="Condition 7" />
          </Field>
        </div>
        <Field label="What it requires">
          <textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required maxLength={1000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trigger" hint="In the council's words">
            <input className="input" value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })} maxLength={300} placeholder="Prior to occupation of the 25th dwelling" />
          </Field>
          <Field label="Due date">
            <input className="input" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" hint="For S106 / CIL contributions">
            <input className="input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.pre_commencement} onChange={(e) => setF({ ...f, pre_commencement: e.target.checked })} />{" "}
            Pre-commencement — blocks the start of works
          </label>
        </div>
        <Field label="Notes">
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} />
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

function Budget({ project, onChange }: { project: LandProject; onChange: () => void }) {
  const vendors = useAsync(() => api.listVendors(), []);
  const vendor = byId(vendors.data);
  const [editing, setEditing] = useState<LandBudgetLine | "new" | null>(null);
  const toast = useToast();

  return (
    <Card
      title="Development budget"
      padded={false}
      action={
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          Add line
        </Button>
      }
    >
      <DataTable
        columns={[
          { key: "cat", label: "Category" },
          { key: "trade", label: "Contractor" },
          { key: "budget", label: "Budget", align: "right" },
          { key: "actual", label: "Spent", align: "right" },
          { key: "var", label: "Variance", align: "right" },
          { key: "act", label: "", align: "right" },
        ]}
        empty="No development budget yet: earthworks, drainage, roads, utilities, landscaping."
      >
        {project.budget_lines.map((l) => (
          <tr key={l.id}>
            <td>
              <div className="font-medium">{l.category}</div>
              {l.notes && (
                <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {l.notes}
                </div>
              )}
            </td>
            <td style={{ color: "var(--fg-muted)" }}>{l.vendor_id ? vendor.get(l.vendor_id)?.name ?? "—" : "—"}</td>
            <td className="num">{money(l.budget_amount)}</td>
            <td className="num">{money(l.actual_amount)}</td>
            <td className="num" style={{ color: Number(l.variance) < 0 ? "var(--danger)" : "var(--ok)" }}>
              {money(l.variance)}
            </td>
            <td className="num">
              <Menu
                label="⋯"
                items={[
                  { label: "Edit / book spend…", run: () => setEditing(l) },
                  {
                    label: "Remove",
                    tone: "danger",
                    run: async () => {
                      try {
                        await toast.promise(api.deleteLandBudgetLine(l.id), { success: "Line removed", error: "Not removed" });
                      } catch {
                        /* toast */
                      }
                      onChange();
                    },
                  },
                ]}
              />
            </td>
          </tr>
        ))}
        {project.budget_lines.length > 0 && (
          <tr style={{ borderTop: "2px solid var(--border)" }}>
            <td colSpan={2} className="font-semibold">
              Total
            </td>
            <td className="num font-semibold">{money(project.budget_total)}</td>
            <td className="num font-semibold">{money(project.actual_total)}</td>
            <td className="num font-semibold">{money(Number(project.budget_total) - Number(project.actual_total))}</td>
            <td />
          </tr>
        )}
      </DataTable>
      {editing && (
        <BudgetDialog
          projectId={project.id}
          line={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function BudgetDialog({ projectId, line, onClose, onDone }: { projectId: string; line: LandBudgetLine | null; onClose: () => void; onDone: () => void }) {
  const vendors = useAsync(() => api.listVendors(), []);
  const [f, setF] = useState({
    category: line?.category ?? "",
    budget_amount: line ? String(Number(line.budget_amount)) : "",
    actual_amount: line ? String(Number(line.actual_amount)) : "0",
    vendor_id: line?.vendor_id ?? "",
    notes: line?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (line)
        await api.updateLandBudgetLine(line.id, {
          category: f.category,
          budget_amount: f.budget_amount || "0",
          actual_amount: f.actual_amount || "0",
          vendor_id: f.vendor_id || null,
          notes: f.notes || null,
        });
      else
        await api.addLandBudgetLine(projectId, {
          category: f.category,
          budget_amount: f.budget_amount || "0",
          actual_amount: f.actual_amount || "0",
          vendor_id: f.vendor_id || undefined,
          notes: f.notes || undefined,
        });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={line ? `Edit ${line.category}` : "Add a budget line"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Category">
          <input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} required maxLength={120} placeholder="Foul and surface water drainage" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget">
            <input className="input" inputMode="decimal" value={f.budget_amount} onChange={(e) => setF({ ...f, budget_amount: e.target.value })} required />
          </Field>
          <Field label="Spent to date">
            <input className="input" inputMode="decimal" value={f.actual_amount} onChange={(e) => setF({ ...f, actual_amount: e.target.value })} />
          </Field>
        </div>
        <Field label="Contractor">
          <select className="input" value={f.vendor_id} onChange={(e) => setF({ ...f, vendor_id: e.target.value })}>
            <option value="">—</option>
            {(vendors.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={500} />
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

function Appraisal({ project: p }: { project: LandProject }) {
  const build = Number(p.build_cost_estimate ?? 0);
  const rows: [string, number | null, string?][] = [
    ["Gross development value", p.gdv ? Number(p.gdv) : null, "What the finished homes should sell for"],
    ["Land", -Number(p.acquisition_cost)],
    ["Infrastructure (forecast)", -Number(p.forecast_total), "Each budget line at the larger of budget and spend"],
    ["Build cost", build ? -build : null],
    ["Profit", p.profit ? Number(p.profit) : null],
  ];
  return (
    <Card title="Appraisal">
      <dl className="space-y-3 text-sm">
        {rows.map(([k, v, hint]) => (
          <div key={k} className="flex items-baseline justify-between gap-4" style={k === "Profit" ? { borderTop: "2px solid var(--border)", paddingTop: 12 } : undefined}>
            <dt>
              <span className={k === "Profit" ? "font-semibold" : ""}>{k}</span>
              {hint && (
                <span className="block text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {hint}
                </span>
              )}
            </dt>
            <dd className={`tnum ${k === "Profit" ? "font-semibold" : ""}`} style={{ color: v !== null && v < 0 ? "var(--fg-muted)" : undefined }}>
              {v === null ? "—" : money(v)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm">
        Margin on GDV:{" "}
        <strong style={{ color: p.margin_on_gdv && Number(p.margin_on_gdv) < 15 ? "var(--danger)" : "var(--ok)" }}>
          {p.margin_on_gdv ? `${p.margin_on_gdv}%` : "—"}
        </strong>
        {p.cost_per_lot && <span style={{ color: "var(--fg-muted)" }}> · land and infrastructure {money(p.cost_per_lot)} per plot</span>}
      </p>
      {p.community_id && (
        <Link href={`/communities/${p.community_id}`} className="mt-3 inline-block text-sm" style={{ color: "var(--brand)" }}>
          Open the community →
        </Link>
      )}
    </Card>
  );
}

function DeliverDialog({ project, onClose, onDone }: { project: LandProject; onClose: () => void; onDone: () => void }) {
  const phases = useAsync(() => api.listPhases(project.community_id!), [project.community_id]);
  const [f, setF] = useState({ start: "1", end: "10", prefix: "", phase_id: "", premium: "0" });
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const count = Math.max(0, Number(f.end) - Number(f.start) + 1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const before = project.delivered_lots;
      const after = await api.deliverPlots(project.id, {
        start: Number(f.start),
        end: Number(f.end),
        prefix: f.prefix || undefined,
        phase_id: f.phase_id || undefined,
        premium: f.premium || "0",
      });
      toast.success(`${after.delivered_lots - before} plots delivered`, "Created in the community, not yet released for sale.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deliver");
    }
  }

  return (
    <Modal open title="Deliver serviced plots" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The plots are created in the community as <em>not released</em> — sales releases them when ready. Numbers that
          already exist are skipped.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prefix">
            <input className="input" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value })} maxLength={10} />
          </Field>
          <Field label="From">
            <input className="input" type="number" min={0} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
          </Field>
          <Field label="To">
            <input className="input" type="number" min={0} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phase">
            <select className="input" value={f.phase_id} onChange={(e) => setF({ ...f, phase_id: e.target.value })}>
              <option value="">No phase</option>
              {(phases.data ?? []).map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Premium on each">
            <input className="input" inputMode="decimal" value={f.premium} onChange={(e) => setF({ ...f, premium: e.target.value })} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={count < 1 || count > 500}>
            Deliver {count}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
