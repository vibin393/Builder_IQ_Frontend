"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { useIssuePurchaseOrder } from "@/components/IssuePurchaseOrder";
import { AnimatedNumber, useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";

const TABS = [
  "Overview",
  "Selections",
  "Budget",
  "Job cost",
  "Schedule",
  "Change orders",
  "Purchasing",
  "Warranty",
] as const;
type Tab = (typeof TABS)[number];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Overview");

  const job = useAsync(() => api.getJob(id), [id]);
  const contract = useAsync(() => api.getContract(id).catch(() => null), [id]);
  const cost = useAsync(() => api.jobCost(id), [id]);
  const communities = useAsync(() => api.listCommunities(), []);
  const plans = useAsync(() => api.listPlans(), []);
  // The home's physical location lives on its plot; fetch the development's plots
  // so the job header can show the street address rather than just the development.
  const lots = useAsync(
    () => (job.data?.community_id ? api.listLots(job.data.community_id) : Promise.resolve([])),
    [job.data?.community_id],
  );

  if (job.loading) return <Loading label="Loading home" />;
  if (job.error) return <ErrorNote message={job.error} />;
  if (!job.data) return null;

  const j = job.data;
  const community = byId(communities.data).get(j.community_id);
  const plan = byId(plans.data).get(j.plan_id);
  const lot = byId(lots.data).get(j.lot_id);
  // The stored plot address already carries city/state/zip; fall back to the bare postcode.
  const location = lot?.address || lot?.postcode || "";

  function refreshMoney() {
    contract.reload();
    cost.reload();
    job.reload();
  }

  return (
    <>
      <PageHeader
        title={j.elevation ? j.elevation : `Home ${j.job_number}`}
        subtitle={[`Home ${j.job_number}`, location, community?.name, plan?.name].filter(Boolean).join(" · ")}
        action={<StatusBadge status={j.status} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Contract price"
          value={contract.data ? money(contract.data.total_price) : "No contract"}
          hint={contract.data ? `Options ${money(contract.data.options_total)}` : "Sell this home to create one"}
        />
        <StatTile
          label="Budget"
          value={<AnimatedNumber value={Number(cost.data?.revised_total ?? 0)} format={(v) => money(v)} />}
          hint="Revised, after selections"
        />
        <StatTile
          label="Committed"
          value={<AnimatedNumber value={Number(cost.data?.committed_total ?? 0)} format={(v) => money(v)} />}
          hint="Issued purchase orders"
        />
        <StatTile
          label="Margin"
          value={
            contract.data
              ? money(Number(contract.data.total_price) - Number(cost.data?.exposure_total ?? 0))
              : "—"
          }
          tone={
            contract.data &&
            Number(contract.data.total_price) - Number(cost.data?.exposure_total ?? 0) < 0
              ? "danger"
              : "ok"
          }
          hint="Revenue less exposure"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn btn-ghost btn-sm"
            style={tab === t ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview jobId={id} job={j} onChange={refreshMoney} />}
      {tab === "Selections" && <Selections jobId={id} planId={j.plan_id} onChange={refreshMoney} />}
      {tab === "Budget" && <BudgetTab jobId={id} onChange={refreshMoney} />}
      {tab === "Job cost" && <JobCostTab jobId={id} />}
      {tab === "Schedule" && <ScheduleTab jobId={id} onChange={refreshMoney} />}
      {tab === "Change orders" && <ChangeOrders jobId={id} onChange={refreshMoney} />}
      {tab === "Purchasing" && <Purchasing jobId={id} onChange={refreshMoney} />}
      {tab === "Warranty" && <WarrantyTab jobId={id} />}
    </>
  );
}

/* --------------------------------------------------------------- overview */

function Overview({
  jobId,
  job,
  onChange,
}: {
  jobId: string;
  job: {
    status: string;
    start_date: string | null;
    projected_completion: string | null;
    closing_date: string | null;
    plan_id: string;
    community_id: string;
    lot_id: string;
    elevation: string | null;
  };
  onChange: () => void;
}) {
  const contract = useAsync(() => api.getContract(jobId).catch(() => null), [jobId]);
  const [sellOpen, setSellOpen] = useState(false);
  const toast = useToast();

  async function sign() {
    await toast.promise(api.signContract(jobId), {
      success: "Contract signed",
      error: "Could not sign the contract",
    });
    contract.reload();
    onChange();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Contract">
        {contract.loading ? (
          <Loading />
        ) : !contract.data ? (
          <EmptyState
            title="This home has not been sold"
            hint="Create the contract to attach a buyer and lock the price."
            action={
              <Button variant="primary" icon="homes" onClick={() => setSellOpen(true)}>
                Sell this home
              </Button>
            }
          />
        ) : (
          <div className="space-y-3 text-sm">
            <Row label="Status" value={<StatusBadge status={contract.data.status} />} />
            <Row label="Base price" value={money(contract.data.base_price)} />
            <Row label="Lot premium" value={money(contract.data.lot_premium)} />
            <Row label="Options" value={money(contract.data.options_total)} />
            <Row label="Incentives" value={`− ${money(contract.data.incentives)}`} />
            <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
              <Row
                label="Total"
                value={<strong className="text-base">{money(contract.data.total_price)}</strong>}
              />
            </div>
            <Row label="Signed" value={day(contract.data.signed_date)} />
            {contract.data.status !== "signed" && (
              <Button variant="primary" block className="mt-2" loadingText="Signing…" onClick={sign}>
                Mark signed
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card title="Build">
        <div className="space-y-3 text-sm">
          <Row label="Status" value={<StatusBadge status={job.status} />} />
          <Row label="Start" value={day(job.start_date)} />
          <Row label="Projected completion" value={day(job.projected_completion)} />
          <Row label="Closing" value={day(job.closing_date)} />
        </div>
      </Card>

      <SellModal
        jobId={jobId}
        home={job}
        open={sellOpen}
        onClose={() => setSellOpen(false)}
        onDone={() => {
          setSellOpen(false);
          contract.reload();
          onChange();
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="tnum text-right">{value}</span>
    </div>
  );
}

function SellModal({
  jobId,
  home,
  open,
  onClose,
  onDone,
}: {
  jobId: string;
  /** The home being sold: its plan, development, plot and elevation price it. */
  home: { plan_id: string; community_id: string; lot_id: string; elevation: string | null };
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    base_price: "",
    lot_premium: "0",
    incentives: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // The price list, built up: this development's price for the plan (or the plan's
  // own), the elevation, and the plot premium. Prefilled, never forced - a sale can
  // still be agreed at a different figure.
  const pricing = useAsync(
    () =>
      open
        ? api.planPricing(home.plan_id, {
            community_id: home.community_id,
            lot_id: home.lot_id,
            elevation: home.elevation ?? undefined,
          })
        : Promise.resolve(null),
    [open, home.plan_id, home.community_id, home.lot_id, home.elevation],
  );
  const guide = pricing.data;
  useEffect(() => {
    if (!guide) return;
    setForm((f) => ({
      ...f,
      base_price: f.base_price || String(Number(guide.base_price)),
      lot_premium: f.lot_premium && f.lot_premium !== "0" ? f.lot_premium : String(Number(guide.plot_premium)),
    }));
  }, [guide]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createContract(jobId, {
        buyer: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || undefined,
        },
        base_price: form.base_price,
        lot_premium: form.lot_premium || "0",
        incentives: form.incentives || "0",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the contract");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Sell this home" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buyer first name">
            <input className="input" value={form.first_name} onChange={set("first_name")} required />
          </Field>
          <Field label="Buyer last name">
            <input className="input" value={form.last_name} onChange={set("last_name")} required />
          </Field>
        </div>
        <Field label="Buyer email">
          <input type="email" className="input" value={form.email} onChange={set("email")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Base price"
            hint={
              guide
                ? `${guide.community_price ? "Development" : "Plan"} price ${money(guide.house_price)}${
                    Number(guide.elevation_adjustment)
                      ? ` ${Number(guide.elevation_adjustment) > 0 ? "+" : ""}${money(guide.elevation_adjustment)} elevation ${guide.elevation_code}`
                      : ""
                  }`
                : undefined
            }
          >
            <input className="input" value={form.base_price} onChange={set("base_price")} required placeholder="420000.00" />
          </Field>
          <Field label="Plot premium">
            <input className="input" value={form.lot_premium} onChange={set("lot_premium")} />
          </Field>
          <Field label="Incentives">
            <input className="input" value={form.incentives} onChange={set("incentives")} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create contract"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- selections */

function Selections({ jobId, planId, onChange }: { jobId: string; planId: string; onChange: () => void }) {
  const selections = useAsync(() => api.listSelections(jobId), [jobId]);
  // Only what can go on this house type and is still offered. Past selections of a
  // retired option still resolve by name through `all`.
  const options = useAsync(() => api.listOptions({ plan_id: planId, active: true }), [planId]);
  const all = useAsync(() => api.listOptions(), []);
  const [adding, setAdding] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cascade, setCascade] = useState<string | null>(null);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  const opt = byId(all.data);
  const picked = (options.data ?? []).find((o) => o.id === adding);

  async function add() {
    if (!adding) return;
    await toast.promise(api.addSelection(jobId, { option_id: adding, quantity }), {
      success: "Selection added. Confirm it to apply the cascade.",
      error: "Could not add the selection",
    });
    setAdding("");
    setQuantity(1);
    selections.reload();
  }

  async function applySelection(selectionId: string) {
    const result = await toast.promise(api.confirmSelection(jobId, selectionId), {
      success: (r) => `Cascade applied. Contract +${money(r.price_delta)}.`,
      error: "Could not confirm the selection",
    });
    setCascade(
      `Contract +${money(result.price_delta)} · Budget +${money(result.cost_delta)} across ${
        result.budget_changes.length
      } cost code${result.budget_changes.length === 1 ? "" : "s"} · Schedule +${result.schedule_days_delta} day${
        result.schedule_days_delta === 1 ? "" : "s"
      }`,
    );
    selections.reload();
    onChange();
  }

  function askReverse(selectionId: string, name: string) {
    ask({
      title: "Reverse this selection?",
      tone: "danger",
      confirmLabel: "Reverse",
      body: (
        <>
          <strong>{name}</strong> comes off the contract price, its cost comes back out of the
          budget, and the schedule pulls back in. This mirrors the confirm exactly.
        </>
      ),
      onConfirm: async () => {
        await toast.promise(api.cancelSelection(jobId, selectionId), {
          success: "Selection reversed",
          error: "Could not reverse the selection",
        });
        setCascade(null);
        selections.reload();
        onChange();
      },
    });
  }

  const chosen = new Set((selections.data ?? []).map((s) => s.option_id));

  return (
    <div className="space-y-4">
      {cascade && (
        <div
          className="reveal rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--ok-soft)",
            color: "var(--ok)",
            borderLeft: "3px solid var(--ok)",
          }}
        >
          <strong>Cascade applied.</strong> {cascade}
        </div>
      )}

      <Card title="Add an option">
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-md"
            value={adding}
            onChange={(e) => {
              setAdding(e.target.value);
              setQuantity(1);
            }}
          >
            <option value="">Choose from the catalog…</option>
            {(options.data ?? [])
              .filter((o) => !chosen.has(o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} — {o.name} ({money(o.price)}
                  {o.unit && o.max_quantity > 1 ? ` per ${o.unit}` : ""}
                  {o.schedule_days ? `, +${o.schedule_days}d` : ""})
                </option>
              ))}
          </select>
          {picked && picked.max_quantity > 1 && (
            <input
              className="input"
              style={{ width: "6rem" }}
              type="number"
              min={1}
              max={picked.max_quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(picked.max_quantity, Number(e.target.value) || 1)))}
              aria-label="Quantity"
              title={`Up to ${picked.max_quantity}`}
            />
          )}
          <Button variant="primary" icon="options" onClick={add} disabled={!adding}>
            Add
          </Button>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
          Adding records the buyer&apos;s choice and snapshots today&apos;s catalog price. Nothing moves
          until you confirm it.
        </p>
      </Card>

      <Card padded={false}>
        {selections.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "opt", label: "Option" },
              { key: "status", label: "Status" },
              { key: "price", label: "Price", align: "right" },
              { key: "cost", label: "Cost", align: "right" },
              { key: "days", label: "Days", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No selections on this home yet."
          >
            {(selections.data ?? []).map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-medium">{opt.get(s.option_id)?.name ?? "Option"}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {opt.get(s.option_id)?.code} · selected {day(s.selected_date)}
                  </div>
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="num">{money(s.extended_price)}</td>
                <td className="num" style={{ color: "var(--fg-muted)" }}>
                  {money(s.extended_cost)}
                </td>
                <td className="num">{s.schedule_days_at_selection || "—"}</td>
                <td className="num">
                  {s.status === "pending" && (
                    <Button
                      variant="primary"
                      size="sm"
                      loadingText="Applying…"
                      onClick={() => applySelection(s.id)}
                    >
                      Confirm
                    </Button>
                  )}
                  {s.status === "confirmed" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => askReverse(s.id, opt.get(s.option_id)?.name ?? "This option")}
                    >
                      Reverse
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {dialog}
    </div>
  );
}

/* ----------------------------------------------------------------- budget */

function BudgetTab({ jobId, onChange }: { jobId: string; onChange: () => void }) {
  const budget = useAsync(() => api.getBudget(jobId).catch(() => null), [jobId]);
  const codes = useAsync(() => api.listCostCodes(), []);
  const toast = useToast();

  const code = byId(codes.data);

  async function generate() {
    await toast.promise(api.generateBudget(jobId), {
      success: "Budget generated from the plan standard costs",
      error: "Could not generate the budget",
    });
    budget.reload();
    onChange();
  }

  if (budget.loading) return <Loading />;

  if (!budget.data) {
    return (
      <Card>
        <EmptyState
          title="No budget yet"
          hint="Generate it from the plan's standard costs. This runs once — afterwards it is revised by selections and change orders."
          action={
            <Button variant="primary" icon="accounting" loadingText="Generating…" onClick={generate}>
              Generate budget
            </Button>
          }
        />
      </Card>
    );
  }

  const b = budget.data;

  return (
    <Card
      title={`Budget · original ${money(b.original_total)} → revised ${money(b.revised_total)}`}
      padded={false}
    >
      <DataTable
        columns={[
          { key: "code", label: "Cost code" },
          { key: "orig", label: "Original", align: "right" },
          { key: "rev", label: "Revised", align: "right" },
          { key: "var", label: "Variance", align: "right" },
        ]}
      >
        {b.lines.map((line) => (
          <tr key={line.id}>
            <td>
              <div className="font-medium">{code.get(line.cost_code_id)?.code ?? "—"}</div>
              <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                {code.get(line.cost_code_id)?.name ?? line.description ?? ""}
              </div>
            </td>
            <td className="num">{money(line.original_amount)}</td>
            <td className="num">{money(line.revised_amount)}</td>
            <td className="num">
              {Number(line.variance) === 0 ? (
                <span style={{ color: "var(--fg-subtle)" }}>—</span>
              ) : (
                <span style={{ color: Number(line.variance) > 0 ? "var(--warn)" : "var(--ok)" }}>
                  {Number(line.variance) > 0 ? "+" : ""}
                  {money(line.variance)}
                </span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

/* --------------------------------------------------------------- job cost */

function JobCostTab({ jobId }: { jobId: string }) {
  const cost = useAsync(() => api.jobCost(jobId), [jobId]);

  if (cost.loading) return <Loading />;
  if (!cost.data) return <ErrorNote message={cost.error ?? "No data"} />;

  const c = cost.data;

  const pending = Number(c.pending_change_total);
  const retained = Number(c.retainage_held);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revised budget" value={money(c.revised_total)} />
        <StatTile label="Committed" value={money(c.committed_total)} hint="Issued POs" />
        <StatTile label="Actual" value={money(c.actual_total)} hint="Approved invoices" />
        <StatTile
          label="Variance"
          value={money(c.variance_total)}
          tone={c.over_budget ? "danger" : "ok"}
          hint={c.over_budget ? "Over budget" : "Within budget"}
        />
      </div>

      {/* The early warning: inside budget today, outside it if everything raised lands. */}
      {c.will_go_over && (
        <div
          className="reveal rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--warn-soft)",
            color: "var(--warn)",
            borderLeft: "3px solid var(--warn)",
          }}
          role="status"
        >
          <strong>This home is inside budget today, but will not be.</strong>{" "}
          {money(pending)} of change orders are raised and awaiting approval. Approving them
          takes the forecast to {money(c.forecast_total)} against a budget of{" "}
          {money(c.revised_total)}.
        </div>
      )}

      {(pending > 0 || retained > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            label="Pending change"
            value={money(pending)}
            tone={pending ? "warn" : "default"}
            hint="Raised, not yet approved"
          />
          <StatTile
            label="Forecast"
            value={money(c.forecast_total)}
            tone={c.forecast_over_budget ? "danger" : "ok"}
            hint="Exposure plus what is in flight"
          />
          <StatTile
            label="Retainage held"
            value={money(retained)}
            hint="Costed, not yet paid out"
          />
        </div>
      )}

      <Card title="By cost code" padded={false}>
        <DataTable
          columns={[
            { key: "code", label: "Cost code" },
            { key: "budget", label: "Budget", align: "right" },
            { key: "com", label: "Committed", align: "right" },
            { key: "act", label: "Actual", align: "right" },
            { key: "pend", label: "Pending", align: "right" },
            { key: "fcst", label: "Forecast", align: "right" },
            { key: "left", label: "Remaining", align: "right" },
          ]}
          empty="No budget or purchase orders on this home yet."
        >
          {c.lines.map((line) => {
            const pend = Number(line.pending_change);
            const forecastOver = Number(line.forecast_variance) < 0;
            return (
              <tr key={line.cost_code_id}>
                <td>
                  <div className="font-medium">{line.code}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {line.name}
                  </div>
                </td>
                <td className="num">{money(line.revised_amount)}</td>
                <td className="num">{money(line.committed_amount)}</td>
                <td className="num">{money(line.actual_amount)}</td>
                <td className="num">
                  {pend > 0 ? (
                    <span style={{ color: "var(--warn)" }}>{money(pend)}</span>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  )}
                </td>
                <td className="num">
                  <span style={{ color: forecastOver ? "var(--danger)" : "var(--fg)" }}>
                    {money(line.forecast)}
                  </span>
                </td>
                <td className="num">
                  <span
                    style={{ color: Number(line.uncommitted) < 0 ? "var(--danger)" : "var(--fg)" }}
                  >
                    {money(line.uncommitted)}
                  </span>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- schedule */

function ScheduleTab({ jobId, onChange }: { jobId: string; onChange: () => void }) {
  const tasks = useAsync(() => api.getSchedule(jobId), [jobId]);
  const templates = useAsync(() => api.listScheduleTemplates(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const [templateId, setTemplateId] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const toast = useToast();

  const vendor = byId(vendors.data);

  async function generate() {
    await toast.promise(api.generateSchedule(jobId, { template_id: templateId }), {
      success: (t) => `Schedule generated with ${t.length} tasks`,
      error: "Could not generate the schedule",
    });
    tasks.reload();
    onChange();
  }

  async function complete(taskId: string) {
    const result = await toast.promise(api.completeTask(taskId), {
      success: (r) =>
        r.days_late === 0
          ? "Task complete, on schedule"
          : `${r.days_late} day${r.days_late === 1 ? "" : "s"} late. ${r.tasks_shifted} task${
              r.tasks_shifted === 1 ? "" : "s"
            } shifted.`,
      error: "Could not complete the task",
    });
    setNote(
      result.days_late === 0
        ? "Completed on schedule."
        : `${result.days_late} day${result.days_late === 1 ? "" : "s"} late — ${result.tasks_shifted} downstream task${
            result.tasks_shifted === 1 ? "" : "s"
          } shifted.`,
    );
    tasks.reload();
    onChange();
  }

  /** Move a task's planned start, or hand it to a different trade.
   *
   *  Deliberately does not cascade: shifting downstream work is what completing
   *  a task late does, and doing it here as well would move the same dates twice.
   */
  async function reschedule(taskId: string, patch: { scheduled_start?: string; vendor_id?: string }) {
    // Two calls rather than one PATCH, because they are different operations:
    // moving a date ripples through the trades behind it, and putting a trade on
    // a task does not. The old single endpoint did neither - it just wrote the
    // fields, so a moved task left every date behind it where it was.
    if (patch.scheduled_start) {
      await toast.promise(
        api.rescheduleTask(taskId, { scheduled_start: patch.scheduled_start }),
        { success: "Task moved, and the work behind it with it", error: "Could not move the task" },
      );
    }
    if (patch.vendor_id !== undefined) {
      await toast.promise(api.assignTaskTrade(taskId, patch.vendor_id || null), {
        success: "Trade assigned",
        error: "Could not assign the trade",
      });
    }
    tasks.reload();
  }

  if (tasks.loading) return <Loading />;

  if (!tasks.data?.length) {
    return (
      <Card>
        <EmptyState
          title="No schedule yet"
          hint="Generate this home's tasks from a schedule template."
          action={
            <div className="flex justify-center gap-2">
              <select className="input max-w-xs" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Choose a template…</option>
                {(templates.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                icon="schedule"
                loadingText="Generating…"
                onClick={generate}
                disabled={!templateId}
              >
                Generate
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {note && (
        <div
          className="reveal rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--brand-soft)",
            color: "var(--brand-fg)",
            borderLeft: "3px solid var(--brand)",
          }}
        >
          {note}
        </div>
      )}

      <Card padded={false}>
        <DataTable
          columns={[
            { key: "seq", label: "#" },
            { key: "task", label: "Task" },
            { key: "trade", label: "Trade" },
            { key: "status", label: "Status" },
            { key: "start", label: "Start", align: "right" },
            { key: "finish", label: "Finish", align: "right" },
            { key: "act", label: "", align: "right" },
          ]}
        >
          {tasks.data.map((t) => (
            <tr key={t.id}>
              <td style={{ color: "var(--fg-subtle)" }}>{t.sequence}</td>
              <td>
                <span className="font-medium">{t.name}</span>
                {t.is_milestone && (
                  <span className="ml-2">
                    <Badge tone="brand">Milestone</Badge>
                  </span>
                )}
              </td>
              <td className="text-sm">
                {t.status === "complete" ? (
                  t.vendor_id ? (vendor.get(t.vendor_id)?.name ?? "—") : "—"
                ) : (
                  <select
                    className="input"
                    aria-label={`Trade for ${t.name}`}
                    style={{ width: "auto", padding: "0.2rem 0.4rem", fontSize: "0.8rem" }}
                    value={t.vendor_id ?? ""}
                    onChange={(e) => void reschedule(t.id, { vendor_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {(vendors.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              <td className="num text-sm">
                {t.status === "complete" ? (
                  day(t.scheduled_start)
                ) : (
                  <input
                    type="date"
                    className="input"
                    aria-label={`Start date for ${t.name}`}
                    style={{ width: "auto", padding: "0.2rem 0.4rem", fontSize: "0.8rem" }}
                    defaultValue={t.scheduled_start ?? ""}
                    onChange={(e) =>
                      e.target.value && void reschedule(t.id, { scheduled_start: e.target.value })
                    }
                  />
                )}
              </td>
              <td className="num text-sm">
                {day(t.scheduled_finish)}
                {t.days_late > 0 && (
                  <div className="text-xs" style={{ color: "var(--danger)" }}>
                    {t.days_late}d late
                  </div>
                )}
              </td>
              <td className="num">
                {t.status !== "complete" && (
                  <Button variant="ghost" size="sm" loadingText="Saving…" onClick={() => complete(t.id)}>
                    Complete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- change orders */

function ChangeOrders({ jobId, onChange }: { jobId: string; onChange: () => void }) {
  const orders = useAsync(() => api.listChangeOrders(jobId), [jobId]);
  const codes = useAsync(() => api.listCostCodes(), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { confirm: ask, dialog } = useConfirm();

  function askApprove(co: { id: string; co_number: string; responsible_party: string }) {
    const who =
      co.responsible_party === "buyer"
        ? "The buyer is billed, and the budget rises."
        : co.responsible_party === "builder"
          ? "The budget rises but the buyer is not billed. The builder absorbs this."
          : "Neither price nor budget moves. The cost is backcharged to the trade.";
    ask({
      title: `Approve ${co.co_number}?`,
      confirmLabel: "Approve and cascade",
      body: (
        <>
          {who} Contract, budget and schedule all move together, and this cannot be undone
          except by a reversing change order.
        </>
      ),
      onConfirm: async () => {
        await toast.promise(api.approveChangeOrder(jobId, co.id), {
          success: `${co.co_number} approved and cascaded`,
          error: "Could not approve the change order",
        });
        orders.reload();
        onChange();
      },
    });
  }

  function askReject(co: { id: string; co_number: string }) {
    ask({
      title: `Reject ${co.co_number}?`,
      confirmLabel: "Reject",
      body: (
        <>
          Nothing moves: the contract, the budget and the schedule stay as they are. The change
          order is kept as a record of what was asked for and turned down, and it drops out of the
          cost forecast.
        </>
      ),
      onConfirm: async () => {
        await toast.promise(api.rejectChangeOrder(jobId, co.id), {
          success: `${co.co_number} rejected`,
          error: "Could not reject the change order",
        });
        orders.reload();
        onChange();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon="invoices" onClick={() => setOpen(true)}>
          Raise change order
        </Button>
      </div>

      <Card padded={false}>
        {orders.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "no", label: "CO" },
              { key: "desc", label: "Description" },
              { key: "party", label: "Who pays" },
              { key: "price", label: "Price", align: "right" },
              { key: "cost", label: "Cost", align: "right" },
              { key: "margin", label: "Margin", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No change orders on this home."
          >
            {(orders.data ?? []).map((co) => (
              <tr key={co.id}>
                <td className="font-medium">{co.co_number}</td>
                <td>
                  <div>{co.description}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={co.status} />
                    {co.approval_deadline && (
                      <Badge tone={co.approval_overdue ? "danger" : "neutral"}>
                        {co.approval_overdue ? "Overdue " : "Due "}
                        {day(co.approval_deadline)}
                      </Badge>
                    )}
                  </div>
                </td>
                <td>
                  <Badge
                    tone={
                      co.responsible_party === "buyer"
                        ? "ok"
                        : co.responsible_party === "builder"
                          ? "warn"
                          : "danger"
                    }
                  >
                    {titleCase(co.responsible_party)}
                  </Badge>
                </td>
                <td className="num">{money(co.price_delta)}</td>
                <td className="num">{money(co.cost_delta)}</td>
                <td className="num">
                  <span style={{ color: Number(co.margin_impact) < 0 ? "var(--danger)" : "var(--ok)" }}>
                    {money(co.margin_impact)}
                  </span>
                </td>
                <td className="num">
                  {(co.status === "pending_approval" || co.status === "draft") && (
                    <div className="flex justify-end gap-1.5">
                      <Button variant="primary" size="sm" onClick={() => askApprove(co)}>
                        Approve
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => askReject(co)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <NewChangeOrder
        jobId={jobId}
        codes={codes.data ?? []}
        open={open}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          orders.reload();
        }}
      />
      {dialog}
    </div>
  );
}

function NewChangeOrder({
  jobId,
  codes,
  open,
  onClose,
  onDone,
}: {
  jobId: string;
  codes: { id: string; code: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    description: "",
    reason: "",
    responsible_party: "buyer",
    price_delta: "0",
    schedule_days: "0",
    approval_deadline: "",
    client_notes: "",
    internal_notes: "",
    cost_code_id: "",
    amount: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createChangeOrder(jobId, {
        description: form.description,
        reason: form.reason || undefined,
        responsible_party: form.responsible_party,
        price_delta: form.price_delta || "0",
        schedule_days: Number(form.schedule_days) || 0,
        approval_deadline: form.approval_deadline || undefined,
        client_notes: form.client_notes || undefined,
        internal_notes: form.internal_notes || undefined,
        cost_lines: form.cost_code_id ? [{ cost_code_id: form.cost_code_id, amount: form.amount }] : [],
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the change order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Raise a change order" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Description">
          <input className="input" value={form.description} onChange={set("description")} required />
        </Field>
        <Field label="Reason">
          <input className="input" value={form.reason} onChange={set("reason")} />
        </Field>
        <Field
          label="Who pays"
          hint="Buyer: price and budget both move. Builder: budget only. Trade: neither — it is backcharged."
        >
          <select className="input" value={form.responsible_party} onChange={set("responsible_party")}>
            <option value="buyer">Buyer</option>
            <option value="builder">Builder (absorbed)</option>
            <option value="trade">Trade (backcharge)</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price change">
            <input className="input" value={form.price_delta} onChange={set("price_delta")} />
          </Field>
          <Field label="Schedule days">
            <input className="input" value={form.schedule_days} onChange={set("schedule_days")} />
          </Field>
          <Field label="Client to respond by" hint="Optional deadline for the client's decision.">
            <input className="input" type="date" value={form.approval_deadline} onChange={set("approval_deadline")} />
          </Field>
        </div>
        <Field label="Client notes" hint="Shown to the client on their copy.">
          <input className="input" value={form.client_notes} onChange={set("client_notes")} />
        </Field>
        <Field label="Internal notes" hint="For your team only — never shown to the client.">
          <input className="input" value={form.internal_notes} onChange={set("internal_notes")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost code">
            <select className="input" value={form.cost_code_id} onChange={set("cost_code_id")}>
              <option value="">None</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost amount">
            <input className="input" value={form.amount} onChange={set("amount")} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- purchasing */

function Purchasing({ jobId, onChange }: { jobId: string; onChange: () => void }) {
  const pos = useAsync(() => api.listPurchaseOrders({ job_id: jobId }), [jobId]);
  const vendors = useAsync(() => api.listVendors(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const [open, setOpen] = useState(false);
  // Shared with the Purchase orders screen: it reads which gate refused (compliance
  // or budget) and asks for the matching override, with a reason.
  const { issue, dialog } = useIssuePurchaseOrder(() => {
    pos.reload();
    onChange();
  });

  const vendor = byId(vendors.data);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon="purchaseOrders" onClick={() => setOpen(true)}>
          New purchase order
        </Button>
      </div>

      <Card padded={false}>
        {pos.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "po", label: "PO" },
              { key: "vendor", label: "Trade" },
              { key: "status", label: "Status" },
              { key: "issued", label: "Issued", align: "right" },
              { key: "total", label: "Total", align: "right" },
              { key: "act", label: "", align: "right" },
            ]}
            empty="No purchase orders on this home."
          >
            {(pos.data ?? []).map((po) => (
              <tr key={po.id}>
                <td className="font-medium">
                  <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                    {po.po_number}
                  </Link>
                </td>
                <td>{vendor.get(po.vendor_id)?.name ?? "—"}</td>
                <td>
                  <StatusBadge status={po.status} />
                </td>
                <td className="num text-sm">{day(po.issued_date)}</td>
                <td className="num">{money(po.total)}</td>
                <td className="num">
                  {po.status === "draft" && (
                    <Button variant="primary" size="sm" loadingText="Issuing…" onClick={() => issue(po)}>
                      Issue
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <NewPO
        jobId={jobId}
        vendors={vendors.data ?? []}
        codes={codes.data ?? []}
        open={open}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          pos.reload();
        }}
      />
      {dialog}
    </div>
  );
}

function NewPO({
  jobId,
  vendors,
  codes,
  open,
  onClose,
  onDone,
}: {
  jobId: string;
  vendors: { id: string; name: string }[];
  codes: { id: string; code: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [costCodeId, setCostCodeId] = useState("");
  const [amount, setAmount] = useState("");
  const [retainage, setRetainage] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createPurchaseOrder({
        job_id: jobId,
        vendor_id: vendorId,
        lines: [{ cost_code_id: costCodeId, amount }],
        retainage_percent: retainage || "0",
      });
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
        <Field label="Trade">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Select…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cost code">
          <select className="input" value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)} required>
            <option value="">Select…</option>
            {codes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount">
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="20000.00" />
        </Field>
        <Field
          label="Retainage %"
          hint={
            Number(retainage) > 0 && Number(amount) > 0
              ? `${money((Number(amount) * Number(retainage)) / 100)} withheld until the scope is signed off.`
              : "Held back from every payment until the scope completes. Leave at 0 for materials."
          }
        >
          <input
            className="input"
            value={retainage}
            onChange={(e) => setRetainage(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- warranty */

function WarrantyTab({ jobId }: { jobId: string }) {
  const requests = useAsync(() => api.listWarrantyRequests({ job_id: jobId }), [jobId]);

  if (requests.loading) return <Loading />;

  return (
    <Card padded={false}>
      <DataTable
        columns={[
          { key: "no", label: "Request" },
          { key: "title", label: "Issue" },
          { key: "priority", label: "Priority" },
          { key: "status", label: "Status" },
          { key: "date", label: "Submitted", align: "right" },
        ]}
        empty="No warranty claims on this home."
      >
        {(requests.data ?? []).map((r) => (
          <tr key={r.id}>
            <td>
              <Link href={`/warranty/${r.id}`} className="font-medium" style={{ color: "var(--brand)" }}>
                {r.request_number}
              </Link>
            </td>
            <td>
              <div>{r.title}</div>
              {r.location && (
                <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {r.location}
                </div>
              )}
            </td>
            <td>
              <Badge tone={r.priority === "emergency" ? "danger" : r.priority === "high" ? "warn" : "neutral"}>
                {titleCase(r.priority)}
              </Badge>
            </td>
            <td>
              <StatusBadge status={r.status} />
            </td>
            <td className="num text-sm">{day(r.submitted_date)}</td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}
