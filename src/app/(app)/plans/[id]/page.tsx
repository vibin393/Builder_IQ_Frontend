"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";
import { useConfirm } from "@/components/feedback";
import { PlanForm, areaText, garageLabel, houseTypeLabel, roomsText } from "@/components/PlanForm";
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
import type { PlanCostLine, PlanElevation } from "@/types/api";

const TABS = ["Standard costs", "Elevations", "Price history", "Specification"] as const;
type Tab = (typeof TABS)[number];

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const plan = useAsync(() => api.getPlan(id), [id]);
  const [tab, setTab] = useState<Tab>("Standard costs");
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  const p = plan.data;
  const st = p?.stats;
  const pct = st?.margin_pct ? Number(st.margin_pct) : null;

  if (plan.error) return <ErrorNote message={plan.error} />;

  async function archiveOrRestore() {
    if (!p) return;
    if (p.is_active) {
      ask({
        title: `Archive ${p.code} ${p.name}?`,
        tone: "danger",
        confirmLabel: "Archive",
        body: "It comes off the price list and every development stops offering it. Homes already on it carry on; no new home can be started on it.",
        onConfirm: async () => {
          await toast.promise(api.archivePlan(p.id), { success: `${p.code} archived`, error: "Not archived" });
          plan.reload();
        },
      });
    } else {
      await toast.promise(api.restorePlan(p.id), { success: `${p.code} restored`, error: "Not restored" });
      plan.reload();
    }
  }

  return (
    <>
      <PageHeader
        title={p ? `${p.code} — ${p.name}` : "Plan"}
        subtitle={
          p
            ? [houseTypeLabel(p.house_type), roomsText(p), areaText(p), p.epc_target && `EPC ${p.epc_target}`]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        action={
          p && (
            <div className="flex items-center gap-2">
              {!p.is_active && <Badge tone="neutral">Archived</Badge>}
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Menu
                label="⋯"
                items={[
                  { label: "Copy as a new plan…", run: () => setCopying(true) },
                  { label: p.is_active ? "Archive…" : "Restore", tone: p.is_active ? "danger" : undefined, run: archiveOrRestore },
                ]}
              />
            </div>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Base price" value={money(p?.base_price)} hint={st ? `Offered on ${st.communities} development${st.communities === 1 ? "" : "s"}` : undefined} />
        <StatTile
          label="Standard cost"
          value={money(st?.standard_cost)}
          tone={st && !st.cost_lines ? "warn" : "default"}
          hint={st ? (st.cost_lines ? `${st.cost_lines} cost codes · ${Number(st.labour_hours)} labour hours` : "No costs: a home on this plan cannot be budgeted") : undefined}
        />
        <StatTile
          label="Gross margin"
          value={money(st?.margin)}
          tone={pct !== null && pct < 15 ? "danger" : "ok"}
          hint={pct !== null ? `${pct.toFixed(1)}% before options` : undefined}
        />
        <StatTile
          label="Actual vs standard"
          value={st?.cost_variance_pct ? `${Number(st.cost_variance_pct) > 0 ? "+" : ""}${st.cost_variance_pct}%` : "—"}
          tone={st?.cost_variance_pct && Number(st.cost_variance_pct) > 0 ? "danger" : "default"}
          hint={
            st?.avg_actual_cost
              ? `Finished homes averaged ${money(st.avg_actual_cost)} · ${st.live_homes} live`
              : `No finished homes yet · ${st?.live_homes ?? 0} live`
          }
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "Standard costs" && <CostsTab planId={id} onChange={plan.reload} />}
      {tab === "Elevations" && <ElevationsTab planId={id} basePrice={p?.base_price} onChange={plan.reload} />}
      {tab === "Price history" && <HistoryTab planId={id} />}
      {tab === "Specification" && p && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Specification">
            <dl className="space-y-3 text-sm">
              {(
                [
                  ["House type", houseTypeLabel(p.house_type) ?? "—"],
                  ["Storeys", p.storeys ?? "—"],
                  ["Floor area", areaText(p)],
                  ["Bedrooms", p.bedrooms ?? "—"],
                  ["Bathrooms", p.bathrooms ? `${Number(p.bathrooms)}${p.en_suites ? ` (${p.en_suites} en-suite)` : ""}` : "—"],
                  ["Cloakroom / WC", p.has_cloakroom ? "Yes" : "No"],
                  ["Garage", garageLabel(p.garage) ?? "—"],
                  ["Parking spaces", p.parking_spaces ?? "—"],
                  ["EPC target", p.epc_target ?? "—"],
                ] as [string, React.ReactNode][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt style={{ color: "var(--fg-muted)" }}>{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Description">
            <p className="whitespace-pre-line text-sm" style={{ color: p.description ? undefined : "var(--fg-subtle)" }}>
              {p.description ?? "No description yet. Use Edit to add the sales pitch."}
            </p>
          </Card>
        </div>
      )}

      {editing && p && (
        <PlanForm
          plan={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast.success("Plan updated");
            plan.reload();
          }}
        />
      )}
      {copying && p && (
        <CopyDialog
          planId={p.id}
          name={p.name}
          onClose={() => setCopying(false)}
          onDone={(newId) => {
            setCopying(false);
            router.push(`/plans/${newId}`);
          }}
        />
      )}
      {dialog}
    </>
  );
}

/* --------------------------------------------------------- standard costs */

function CostsTab({ planId, onChange }: { planId: string; onChange: () => void }) {
  const lines = useAsync(() => api.listPlanCostLines(planId), [planId]);
  const codes = useAsync(() => api.listCostCodes(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const [editing, setEditing] = useState<PlanCostLine | "new" | null>(null);
  const toast = useToast();
  const code = byId(codes.data);
  const vendor = byId(vendors.data);
  const rows = lines.data ?? [];
  const total = rows.reduce((s, l) => s + Number(l.amount), 0);
  const hours = rows.reduce((s, l) => s + Number(l.labour_hours ?? 0), 0);

  async function remove(l: PlanCostLine) {
    try {
      await toast.promise(api.deletePlanCostLine(l.id), {
        success: `${code.get(l.cost_code_id)?.code ?? "Line"} removed`,
        error: "Not removed",
      });
    } catch {
      /* toast */
    }
    lines.reload();
    onChange();
  }

  return (
    <Card
      title="Standard cost lines"
      padded={false}
      action={
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          Add cost line
        </Button>
      }
    >
      {lines.loading ? (
        <Loading />
      ) : (
        <DataTable
          columns={[
            { key: "code", label: "Cost code" },
            { key: "trade", label: "Default trade" },
            { key: "hours", label: "Labour hrs", align: "right" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "share", label: "Share", align: "right" },
            { key: "act", label: "", align: "right" },
          ]}
          empty="No standard costs yet. A plan with no cost lines cannot produce a budget."
        >
          {rows.map((l) => (
            <tr key={l.id}>
              <td>
                <div className="font-medium">{code.get(l.cost_code_id)?.code ?? "—"}</div>
                <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {code.get(l.cost_code_id)?.name}
                  {l.description ? ` · ${l.description}` : ""}
                </div>
              </td>
              <td style={{ color: "var(--fg-muted)" }}>{l.vendor_id ? vendor.get(l.vendor_id)?.name ?? "—" : "—"}</td>
              <td className="num">{l.labour_hours ? Number(l.labour_hours) : "—"}</td>
              <td className="num">{money(l.amount)}</td>
              <td className="num" style={{ color: "var(--fg-subtle)" }}>
                {total ? `${((Number(l.amount) / total) * 100).toFixed(0)}%` : "—"}
              </td>
              <td className="num">
                <Menu
                  label="⋯"
                  items={[
                    { label: "Edit…", run: () => setEditing(l) },
                    { label: "Remove", tone: "danger", run: () => remove(l) },
                  ]}
                />
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td colSpan={2} className="font-semibold">
                Total
              </td>
              <td className="num font-semibold">{hours || "—"}</td>
              <td className="num font-semibold">{money(total)}</td>
              <td colSpan={2} />
            </tr>
          )}
        </DataTable>
      )}
      {editing && (
        <CostLineDialog
          planId={planId}
          line={editing === "new" ? null : editing}
          usedCodes={new Set(rows.map((r) => r.cost_code_id))}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            lines.reload();
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function CostLineDialog({
  planId,
  line,
  usedCodes,
  onClose,
  onDone,
}: {
  planId: string;
  line: PlanCostLine | null;
  usedCodes: Set<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const codes = useAsync(() => api.listCostCodes(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const [costCodeId, setCostCodeId] = useState(line?.cost_code_id ?? "");
  const [amount, setAmount] = useState(line ? String(Number(line.amount)) : "");
  const [hours, setHours] = useState(line?.labour_hours ? String(Number(line.labour_hours)) : "");
  const [vendorId, setVendorId] = useState(line?.vendor_id ?? "");
  const [description, setDescription] = useState(line?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (line) {
        await api.updatePlanCostLine(line.id, {
          amount,
          labour_hours: hours || null,
          vendor_id: vendorId || null,
          description: description || null,
        });
      } else {
        await api.addPlanCostLine(planId, {
          cost_code_id: costCodeId,
          amount,
          labour_hours: hours || undefined,
          vendor_id: vendorId || undefined,
          description: description || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the line");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={line ? "Edit standard cost" : "Add a standard cost"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Cost code" hint={line ? "Remove the line and add another to change the code." : undefined}>
          <select className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} required disabled={!!line}>
            <option value="">Select…</option>
            {(codes.data ?? [])
              .filter((c) => c.id === line?.cost_code_id || !usedCodes.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount">
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="58000" />
          </Field>
          <Field label="Labour hours" hint="The target the labour report measures against.">
            <input className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
        <Field label="Default trade" hint="Carried onto the budget; purchasing can change it per home.">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">—</option>
            {(vendors.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </Field>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Homes already budgeted keep the figure they took. This changes the next budget generated.
        </p>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- elevations */

function ElevationsTab({ planId, basePrice, onChange }: { planId: string; basePrice?: string; onChange: () => void }) {
  const elevations = useAsync(() => api.listElevations(planId), [planId]);
  const [editing, setEditing] = useState<PlanElevation | "new" | null>(null);
  const toast = useToast();

  async function run(p: Promise<unknown>, done: string) {
    try {
      await toast.promise(p, { success: done, error: "Not changed" });
    } catch {
      /* toast */
    }
    elevations.reload();
    onChange();
  }

  return (
    <Card
      title="Elevations"
      padded={false}
      action={
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          Add elevation
        </Button>
      }
    >
      <p className="px-5 pt-4 text-sm" style={{ color: "var(--fg-muted)" }}>
        The fronts this house type is built with. Once a plan has elevations, a new home has to be one of them.
      </p>
      {elevations.loading ? (
        <Loading />
      ) : (
        <DataTable
          columns={[
            { key: "code", label: "Elevation" },
            { key: "adj", label: "Price adjustment", align: "right" },
            { key: "price", label: "House price", align: "right" },
            { key: "homes", label: "Homes", align: "right" },
            { key: "act", label: "", align: "right" },
          ]}
          empty="No elevations. New homes on this plan take a free-text elevation until you add some."
        >
          {(elevations.data ?? []).map((e) => (
            <tr key={e.id} style={e.is_active ? undefined : { opacity: 0.6 }}>
              <td>
                <span className="font-medium">{e.code}</span> {e.name}
                {!e.is_active && (
                  <span className="ml-2">
                    <Badge tone="neutral">withdrawn</Badge>
                  </span>
                )}
                {e.description && (
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {e.description}
                  </div>
                )}
              </td>
              <td className="num">
                {Number(e.price_adjustment) ? `${Number(e.price_adjustment) > 0 ? "+" : ""}${money(e.price_adjustment)}` : "—"}
              </td>
              <td className="num">{money(Number(basePrice ?? 0) + Number(e.price_adjustment))}</td>
              <td className="num">{e.homes}</td>
              <td className="num">
                <Menu
                  label="⋯"
                  items={[
                    { label: "Edit…", run: () => setEditing(e) },
                    {
                      label: e.is_active ? "Withdraw" : "Offer again",
                      run: () =>
                        run(api.updateElevation(e.id, { is_active: !e.is_active }), e.is_active ? `${e.code} withdrawn` : `${e.code} offered again`),
                    },
                    { label: "Delete", tone: "danger", run: () => run(api.deleteElevation(e.id), `${e.code} deleted`) },
                  ]}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {editing && (
        <ElevationDialog
          planId={planId}
          elevation={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            elevations.reload();
            onChange();
          }}
        />
      )}
    </Card>
  );
}

function ElevationDialog({
  planId,
  elevation,
  onClose,
  onDone,
}: {
  planId: string;
  elevation: PlanElevation | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState(elevation?.code ?? "");
  const [name, setName] = useState(elevation?.name ?? "");
  const [adj, setAdj] = useState(elevation ? String(Number(elevation.price_adjustment)) : "0");
  const [description, setDescription] = useState(elevation?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (elevation)
        await api.updateElevation(elevation.id, { code, name, price_adjustment: adj || "0", description: description || null });
      else await api.createElevation(planId, { code, name, price_adjustment: adj || "0", description: description || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title={elevation ? `Edit elevation ${elevation.code}` : "Add an elevation"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={32} placeholder="B" />
          </Field>
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Render with stone plinth" />
          </Field>
        </div>
        <Field label="Price adjustment" hint="Added to the house price. Negative for a cheaper front.">
          <input className="input" inputMode="decimal" value={adj} onChange={(e) => setAdj(e.target.value)} />
        </Field>
        <Field label="Description">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
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

/* ---------------------------------------------------------- price history */

function HistoryTab({ planId }: { planId: string }) {
  const history = useAsync(() => api.planPriceHistory(planId), [planId]);
  const users = useAsync(() => api.listUsers(1, 200), []);
  const who = byId(users.data?.items);
  return (
    <Card title="Price history" padded={false}>
      {history.loading ? (
        <Loading />
      ) : (
        <DataTable
          columns={[
            { key: "when", label: "Changed" },
            { key: "by", label: "By" },
            { key: "from", label: "From", align: "right" },
            { key: "to", label: "To", align: "right" },
            { key: "diff", label: "Change", align: "right" },
            { key: "why", label: "Reason" },
          ]}
          empty="The price has not changed since the plan was set up."
        >
          {(history.data ?? []).map((h) => {
            const diff = Number(h.new_price) - Number(h.old_price);
            return (
              <tr key={h.id}>
                <td className="text-sm">{day(h.created_at)}</td>
                <td className="text-sm">{h.changed_by_id ? who.get(h.changed_by_id)?.full_name ?? "—" : "—"}</td>
                <td className="num">{money(h.old_price)}</td>
                <td className="num">{money(h.new_price)}</td>
                <td className="num" style={{ color: diff > 0 ? "var(--ok)" : "var(--danger)" }}>
                  {diff > 0 ? "+" : ""}
                  {money(diff)}
                  <div className="text-xs">{((diff / Number(h.old_price || 1)) * 100).toFixed(1)}%</div>
                </td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {h.reason ?? "—"}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </Card>
  );
}

function CopyDialog({
  planId,
  name,
  onClose,
  onDone,
}: {
  planId: string;
  name: string;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [newName, setNewName] = useState(`${name} (variant)`);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const p = await api.copyPlan(planId, { code, name: newName });
      toast.success(`${p.code} created`, "Specification, standard costs and elevations copied.");
      onDone(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy");
    }
  }

  return (
    <Modal open title={`Copy ${name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          A new house type with this one&apos;s specification, standard costs and elevations — the usual start for a variant.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="New code">
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={32} />
          </Field>
          <Field label="New name">
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required maxLength={200} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" variant="primary">
            Copy plan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
