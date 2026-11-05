"use client";

/**
 * Labour and productivity.
 *
 * The point of the screen is one comparison: the budget said this house should
 * take so many framing hours, and this says what it actually took. Before, it
 * showed hours and cost by cost code — which is what you spent, which you already
 * knew. A bar chart of your own spending is not a productivity report.
 *
 * So the headline is **hours against target**, the table leads with variance, and
 * the rows that are running away sort to the top whether or not they are the
 * biggest trade.
 *
 * Two smaller things the old screen could not say. Hours booked with no rate cost
 * an unknown amount rather than nothing, so they are shown apart from the money
 * instead of quietly dragging the average rate down. And hours nobody has signed
 * off are a claim about what a trade is owed, not a cost — so they are counted
 * separately and can be approved from here.
 */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  LOCALE,
  Loading,
  Menu,
  Modal,
  PageHeader,
  day,
  money,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { ProductivityRow, Timecard } from "@/types/api";

type Tab = "productivity" | "workers" | "trades" | "timecards";

const hours = (v: string | number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : `${Number(v).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} h`;

/** Positive is over. A dash where there is no target to be over. */
function Variance({ value, unit }: { value: string | null; unit: "h" | "money" }) {
  if (value === null) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        no target
      </span>
    );
  }
  const n = Number(value);
  const over = n > 0;
  if (Math.abs(n) < 0.005) {
    return <span style={{ color: "var(--ok)" }}>on target</span>;
  }
  return (
    <span className="font-semibold" style={{ color: over ? "var(--danger)" : "var(--ok)" }}>
      {over ? "+" : "−"}
      {unit === "h" ? hours(Math.abs(n)) : money(Math.abs(n))}
    </span>
  );
}

export default function LabourPage() {
  const [tab, setTab] = useState<Tab>("productivity");
  const [jobFilter, setJobFilter] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "record" }
    | { kind: "edit"; card: Timecard }
    | { kind: "targets" }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const scope = jobFilter || undefined;
  const summary = useAsync(() => api.labourSummary(scope), [jobFilter]);
  const report = useAsync(() => api.productivity(scope), [jobFilter]);
  const workers = useAsync(() => api.labourByWorker(scope), [jobFilter]);
  const trades = useAsync(() => api.labourByVendor(scope), [jobFilter]);
  const cards = useAsync(
    () => api.listTimecards({ job_id: scope, size: 200 }),
    [jobFilter],
  );
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const costCodes = useAsync(() => api.listCostCodes(), []);

  const job = byId(jobs.data);
  const vendor = byId(vendors.data);

  const refresh = useCallback(() => {
    summary.reload();
    report.reload();
    workers.reload();
    trades.reload();
    cards.reload();
    setSelected(new Set());
  }, [summary, report, workers, trades, cards]);

  const act = async (id: string, done: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(id);
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (err) {
      toast.error(
        "That did not go through",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
    }
  };

  const s = summary.data;
  const cardRows = useMemo(
    () => (cards.data?.items ?? []).filter((c) => !pendingOnly || !c.is_approved),
    [cards.data, pendingOnly],
  );
  const approvable = cardRows.filter((c) => !c.is_approved && c.hourly_rate !== null);

  const approveSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy("batch");
    try {
      const result = await api.approveTimecards(ids);
      if (result.skipped.length) {
        toast.error(
          `${result.approved.length} approved, ${result.skipped.length} could not be`,
          result.skipped[0].reason,
        );
      } else {
        toast.success(`${result.approved.length} approved`);
      }
      refresh();
    } catch (err) {
      toast.error("That did not go through", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Labour & productivity"
        subtitle="Hours booked against a home and a cost code. The budget said what a house should take; this says what it actually took."
        action={
          <>
            <select
              className="input w-auto max-w-[12rem]"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="">All homes</option>
              {(jobs.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number}
                </option>
              ))}
            </select>
            {jobFilter && (
              <button className="btn btn-ghost" onClick={() => setDialog({ kind: "targets" })}>
                Set targets
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setDialog({ kind: "record" })}>
              Record time
            </button>
          </>
        }
      />

      {s && (
        <div className="metric-strip mb-5">
          {/* First, because it is the only number here that is a comparison
              rather than a total. The rest is what you spent. */}
          <div className="metric">
            <span className="metric-label">Against target</span>
            <span
              className="metric-value"
              style={
                s.hours_variance === null
                  ? { color: "var(--fg-subtle)" }
                  : Number(s.hours_variance) > 0
                    ? { color: "var(--danger)" }
                    : { color: "var(--ok)" }
              }
            >
              {s.hours_variance === null
                ? "—"
                : `${Number(s.hours_variance) > 0 ? "+" : "−"}${hours(Math.abs(Number(s.hours_variance)))}`}
            </span>
            <span className="metric-hint">
              {s.budgeted_hours ? `${hours(s.budgeted_hours)} budgeted` : "Pick a home to compare"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Hours booked</span>
            <span className="metric-value">{hours(s.total_hours)}</span>
            <span className="metric-hint">
              {s.workers} {s.workers === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Labour cost</span>
            <span className="metric-value">{money(s.total_labour_cost)}</span>
            <span className="metric-hint">
              {s.cost_variance === null
                ? "No budget to compare"
                : `${Number(s.cost_variance) > 0 ? "over" : "under"} by ${money(Math.abs(Number(s.cost_variance)))}`}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Awaiting approval</span>
            <span
              className="metric-value"
              style={s.pending_approval > 0 ? { color: "var(--warn)" } : undefined}
            >
              {hours(s.pending_hours)}
            </span>
            <span className="metric-hint">
              {s.pending_approval} {s.pending_approval === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Average rate</span>
            <span className="metric-value">{s.average_rate ? money(s.average_rate, 2) : "—"}</span>
            <span className="metric-hint">
              {Number(s.unrated_hours) > 0
                ? `${hours(s.unrated_hours)} have no rate`
                : "Every hour is rated"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Overtime</span>
            <span className="metric-value">{hours(s.overtime_hours)}</span>
            <span className="metric-hint">Charged at 1.5&times;</span>
          </div>
        </div>
      )}

      {s && s.unrated_entries > 0 && (
        <div
          className="mb-4 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <strong>
            {hours(s.unrated_hours)} booked with no rate on {s.unrated_entries}{" "}
            {s.unrated_entries === 1 ? "entry" : "entries"}.
          </strong>{" "}
          Those hours cost an unknown amount, not nothing — they are kept out of the average rate
          rather than dragging it down, and they cannot be approved until a rate is set. Giving each
          trade a standard rate fills them in by itself.
        </div>
      )}

      {!jobFilter && (
        <div
          className="mb-4 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--neutral-soft)", color: "var(--fg-muted)" }}
        >
          Targets are per home, so the variance columns are blank across all homes. Homes at
          different stages have spent different fractions of their budget, and adding those up would
          give a company labour budget that nobody set.{" "}
          <span style={{ color: "var(--fg)" }}>Pick a home above to compare.</span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-[var(--radius)] p-0.5"
          style={{ background: "var(--neutral-soft)" }}
          role="tablist"
        >
          {(
            [
              ["productivity", "Productivity", report.data?.rows.length ?? 0],
              ["workers", "People", workers.data?.length ?? 0],
              ["trades", "Trades", trades.data?.length ?? 0],
              ["timecards", "Timecards", cards.data?.total ?? 0],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className="btn btn-sm"
              onClick={() => setTab(key)}
              style={
                tab === key
                  ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)", fontWeight: 600 }
                  : { background: "transparent", color: "var(--fg-muted)" }
              }
            >
              {label}
              <span className="tnum ml-1.5 opacity-60">{count}</span>
            </button>
          ))}
        </div>

        {tab === "timecards" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
              />{" "}
              Awaiting approval
            </label>
            {selected.size > 0 && (
              <button
                className="btn btn-primary btn-sm"
                disabled={busy === "batch"}
                onClick={approveSelected}
              >
                {busy === "batch" ? "Approving…" : `Approve ${selected.size}`}
              </button>
            )}
          </div>
        )}
      </div>

      {report.error && <ErrorNote message={report.error} />}

      {/* ------------------------------------------------- productivity */}
      {tab === "productivity" && (
        <Card padded={false}>
          {report.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "code", label: "Cost code" },
                { key: "budgeted", label: "Budgeted", align: "right" },
                { key: "actual", label: "Actual", align: "right" },
                { key: "variance", label: "Variance", align: "right" },
                { key: "cost", label: "Labour cost", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
              ]}
              empty="No hours booked."
            >
              {(report.data?.rows ?? []).map((r) => (
                <ProductivityTableRow key={r.cost_code_id ?? "none"} row={r} />
              ))}
            </DataTable>
          )}
          <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
            Sorted by what is running away, not by size. The biggest trade on a house is usually the
            framer, and being the biggest is not the same as being in trouble.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------- people */}
      {tab === "workers" && (
        <Card padded={false}>
          {workers.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "who", label: "Who" },
                { key: "days", label: "Days on site", align: "right" },
                { key: "hours", label: "Hours", align: "right" },
                { key: "day", label: "Average day", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
              ]}
              empty="Nobody booked."
            >
              {(workers.data ?? []).map((w) => (
                <tr key={w.worker_name}>
                  <td>
                    <span className="font-medium">{w.worker_name}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {w.vendor_id ? (
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {vendor.get(w.vendor_id)?.name ?? "—"}
                        </span>
                      ) : w.vendor_count > 1 ? (
                        <Badge tone="warn">On {w.vendor_count} trades</Badge>
                      ) : null}
                      {Number(w.overtime_hours) > 0 && (
                        <span className="text-xs" style={{ color: "var(--warn)" }}>
                          {hours(w.overtime_hours)} overtime
                        </span>
                      )}
                    </div>
                    {w.vendor_count > 1 && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        Booked against more than one trade — usually two people with the same name.
                      </div>
                    )}
                  </td>
                  <td className="num tnum text-sm">{w.days_on_site}</td>
                  <td className="num tnum text-sm">{hours(w.hours)}</td>
                  <td className="num tnum text-sm">
                    {hours(w.average_day)}
                    {Number(w.average_day ?? 0) > 10 && (
                      <div className="text-xs" style={{ color: "var(--warn)" }}>
                        long days
                      </div>
                    )}
                  </td>
                  <td className="num tnum text-sm">
                    {w.average_rate ? money(w.average_rate, 2) : "—"}
                  </td>
                  <td className="num tnum text-sm">
                    {money(w.labour_cost)}
                    {Number(w.unrated_hours) > 0 && (
                      <div className="text-xs" style={{ color: "var(--warn)" }}>
                        + {hours(w.unrated_hours)} unrated
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------- trades */}
      {tab === "trades" && (
        <Card padded={false}>
          {trades.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "trade", label: "Trade" },
                { key: "people", label: "People", align: "right" },
                { key: "hours", label: "Hours", align: "right" },
                { key: "ot", label: "Overtime", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
              ]}
              empty="Nothing booked to a trade."
            >
              {(trades.data ?? []).map((t) => {
                const share = t.overtime_share === null ? 0 : Number(t.overtime_share);
                return (
                  <tr key={t.vendor_id ?? "none"}>
                    <td className="font-medium">
                      {t.vendor_id ? (
                        (vendor.get(t.vendor_id)?.name ?? "—")
                      ) : (
                        <span style={{ color: "var(--fg-subtle)" }}>Our own labour</span>
                      )}
                    </td>
                    <td className="num tnum text-sm">{t.workers}</td>
                    <td className="num tnum text-sm">{hours(t.hours)}</td>
                    <td className="num tnum text-sm">
                      {hours(t.overtime_hours)}
                      {share >= 0.25 && (
                        <div className="text-xs font-semibold" style={{ color: "var(--warn)" }}>
                          {Math.round(share * 100)}% of their hours
                        </div>
                      )}
                    </td>
                    <td className="num tnum text-sm">
                      {t.average_rate ? money(t.average_rate, 2) : "—"}
                    </td>
                    <td className="num tnum text-sm">{money(t.labour_cost)}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
            A trade running a quarter of their hours as overtime is flagged. They are either
            short-handed or billing you for being, and both are worth a conversation before the next
            house.
          </p>
        </Card>
      )}

      {/* ---------------------------------------------------- timecards */}
      {tab === "timecards" && (
        <Card padded={false}>
          {cards.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                {
                  key: "pick",
                  label: (
                    <input
                      type="checkbox"
                      aria-label="Select every approvable entry"
                      checked={approvable.length > 0 && selected.size === approvable.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(approvable.map((c) => c.id)) : new Set(),
                        )
                      }
                    />
                  ),
                },
                { key: "who", label: "Who" },
                { key: "home", label: "Home" },
                { key: "when", label: "Day", align: "right" },
                { key: "hours", label: "Hours", align: "right" },
                { key: "cost", label: "Cost", align: "right" },
                { key: "status", label: "Status" },
                { key: "actions", label: "", align: "right" },
              ]}
              empty={pendingOnly ? "Nothing awaiting approval." : "No hours booked."}
            >
              {cardRows.map((c) => (
                <tr key={c.id} style={c.is_approved ? { opacity: 0.65 } : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.worker_name}`}
                      disabled={c.is_approved || c.hourly_rate === null}
                      checked={selected.has(c.id)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td>
                    <span className="font-medium">{c.worker_name}</span>
                    {c.vendor_id && (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {vendor.get(c.vendor_id)?.name ?? "—"}
                      </div>
                    )}
                    {c.notes && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                        {c.notes}
                      </div>
                    )}
                  </td>
                  <td className="text-sm">
                    <Link
                      href={`/jobs/${c.job_id}`}
                      className="font-medium"
                      style={{ color: "var(--brand)" }}
                    >
                      {job.get(c.job_id)?.job_number ?? "—"}
                    </Link>
                  </td>
                  <td className="num text-sm">{day(c.worked_on)}</td>
                  <td className="num tnum text-sm">
                    {hours(c.total_hours)}
                    {Number(c.overtime_hours) > 0 && (
                      <div className="text-xs" style={{ color: "var(--warn)" }}>
                        incl. {hours(c.overtime_hours)} OT
                      </div>
                    )}
                  </td>
                  <td className="num tnum text-sm">
                    {c.labour_cost === null ? (
                      <span style={{ color: "var(--warn)" }}>no rate</span>
                    ) : (
                      money(c.labour_cost)
                    )}
                  </td>
                  <td>
                    {c.is_approved ? (
                      <Badge tone="ok">Approved</Badge>
                    ) : c.hourly_rate === null ? (
                      <Badge tone="warn">Needs a rate</Badge>
                    ) : (
                      <Badge tone="neutral">Pending</Badge>
                    )}
                    {c.approved_on && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {day(c.approved_on)}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <TimecardActions
                      card={c}
                      busy={busy === c.id}
                      onEdit={() => setDialog({ kind: "edit", card: c })}
                      onAct={act}
                      onConfirm={confirm}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {dialog?.kind === "record" && (
        <RecordTime
          jobs={jobs.data ?? []}
          vendors={vendors.data ?? []}
          costCodes={costCodes.data ?? []}
          defaultJob={jobFilter}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "edit" && (
        <EditTime
          card={dialog.card}
          vendors={vendors.data ?? []}
          costCodes={costCodes.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "targets" && (
        <SetTargets
          jobId={jobFilter}
          jobNumber={job.get(jobFilter)?.job_number ?? ""}
          rows={report.data?.rows ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

/* ------------------------------------------------------------------ rows */

function ProductivityTableRow({ row }: { row: ProductivityRow }) {
  const over = row.hours_variance !== null && Number(row.hours_variance) > 0;
  const pct =
    row.budgeted_hours && Number(row.budgeted_hours) > 0
      ? Math.min(Number(row.hours) / Number(row.budgeted_hours), 1.5)
      : null;

  return (
    <tr style={over ? { boxShadow: "inset 3px 0 0 0 var(--danger)" } : undefined}>
      <td>
        <span className="font-medium">{row.cost_code}</span>{" "}
        <span style={{ color: "var(--fg-muted)" }}>{row.cost_code_name}</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {pct !== null && (
            <div
              className="h-1.5 w-28 overflow-hidden rounded-full"
              style={{ background: "var(--neutral-soft)" }}
              title={`${Math.round(pct * 100)}% of the budgeted hours`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(pct, 1) * 100}%`,
                  background: over ? "var(--danger)" : "var(--brand)",
                }}
              />
            </div>
          )}
          <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            {row.entries} {row.entries === 1 ? "entry" : "entries"}
          </span>
          {Number(row.pending_hours) > 0 && (
            <span className="text-xs" style={{ color: "var(--warn)" }}>
              {hours(row.pending_hours)} unapproved
            </span>
          )}
        </div>
      </td>
      <td className="num tnum text-sm">{row.budgeted_hours ? hours(row.budgeted_hours) : "—"}</td>
      <td className="num tnum text-sm">{hours(row.hours)}</td>
      <td className="num text-sm">
        <Variance value={row.hours_variance} unit="h" />
      </td>
      <td className="num tnum text-sm">
        {money(row.labour_cost)}
        {Number(row.unrated_hours) > 0 && (
          <div className="text-xs" style={{ color: "var(--warn)" }}>
            + {hours(row.unrated_hours)} unrated
          </div>
        )}
      </td>
      <td className="num tnum text-sm">{row.average_rate ? money(row.average_rate, 2) : "—"}</td>
    </tr>
  );
}

function TimecardActions({
  card,
  busy,
  onEdit,
  onAct,
  onConfirm,
}: {
  card: Timecard;
  busy: boolean;
  onEdit: () => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (!card.is_approved) {
    items.push({ label: "Edit…", run: onEdit });
    if (card.hourly_rate !== null) {
      items.push({
        label: "Approve",
        run: () => onAct(card.id, "Approved", () => api.approveTimecard(card.id)),
      });
    }
    items.push({
      label: "Delete",
      tone: "danger",
      run: () =>
        onConfirm({
          title: `Delete ${card.worker_name}'s hours for ${day(card.worked_on)}?`,
          body: "For an entry that should never have been made. If the hours were worked but recorded wrongly, edit it instead — deleting loses the fact that somebody was on site.",
          confirmLabel: "Delete",
          tone: "danger",
          onConfirm: () => onAct(card.id, "Deleted", () => api.deleteTimecard(card.id)),
        }),
    });
  } else {
    items.push({
      label: "Withdraw the approval",
      run: () =>
        onConfirm({
          title: "Withdraw the approval?",
          body: "Approved hours cannot be edited underneath their own approval, so correcting them starts here. The entry goes back to pending.",
          confirmLabel: "Withdraw",
          onConfirm: () =>
            onAct(card.id, "Approval withdrawn", () => api.withdrawTimecardApproval(card.id)),
        }),
    });
  }

  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

/* --------------------------------------------------------------- dialogs */

function useAction(onDone: () => void) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (done: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast.success(done);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };
  return { run, error, busy };
}

type Named = { id: string; name: string; labour_rate?: string | null };
type Coded = { id: string; code: string; name: string };

function RecordTime({
  jobs,
  vendors,
  costCodes,
  defaultJob,
  onClose,
  onDone,
}: {
  jobs: { id: string; job_number: string }[];
  vendors: Named[];
  costCodes: Coded[];
  defaultJob: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [jobId, setJobId] = useState(defaultJob);
  const [worker, setWorker] = useState("");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [hrs, setHrs] = useState("8");
  const [overtime, setOvertime] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [codeId, setCodeId] = useState("");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  const trade = vendors.find((v) => v.id === vendorId);
  const effectiveRate = rate || trade?.labour_rate || null;

  return (
    <Modal open title="Record time" onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Recorded", () =>
            api.createTimecard({
              job_id: jobId,
              worker_name: worker,
              hours: hrs,
              worked_on: when,
              overtime_hours: overtime || undefined,
              vendor_id: vendorId || undefined,
              cost_code_id: codeId || undefined,
              hourly_rate: rate || undefined,
              notes: notes || undefined,
            }),
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home">
            <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
              <option value="">Choose…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Day">
            <input
              type="date"
              className="input"
              value={when}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Who">
          <input
            className="input"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            required
            placeholder="J. Mensah"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hours">
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              className="input"
              value={hrs}
              onChange={(e) => setHrs(e.target.value)}
              required
            />
          </Field>
          <Field label="Overtime" hint="Charged at 1.5×.">
            <input
              type="number"
              step="0.25"
              min="0"
              max="24"
              className="input"
              value={overtime}
              onChange={(e) => setOvertime(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trade">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Our own labour</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.labour_rate ? ` — ${v.labour_rate}/h` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost code" hint="Where the hours land in the job cost.">
            <select className="input" value={codeId} onChange={(e) => setCodeId(e.target.value)}>
              <option value="">Unassigned</option>
              {costCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Rate"
          hint={
            trade?.labour_rate && !rate
              ? `Left blank, ${trade.name}'s standard ${trade.labour_rate}/h is used.`
              : "Left blank with no trade selected, the hours are recorded with no cost."
          }
        >
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={trade?.labour_rate ?? ""}
          />
        </Field>
        {!effectiveRate && (
          <p
            className="rounded-[var(--radius)] px-3 py-2 text-sm"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            With no rate these hours cost an unknown amount rather than nothing. They will be kept
            out of the average rate, and they cannot be approved until a rate is set.
          </p>
        )}
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Recording…" : "Record it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTime({
  card,
  vendors,
  costCodes,
  onClose,
  onDone,
}: {
  card: Timecard;
  vendors: Named[];
  costCodes: Coded[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [worker, setWorker] = useState(card.worker_name);
  const [when, setWhen] = useState(card.worked_on);
  const [hrs, setHrs] = useState(card.hours);
  const [overtime, setOvertime] = useState(card.overtime_hours);
  const [vendorId, setVendorId] = useState(card.vendor_id ?? "");
  const [codeId, setCodeId] = useState(card.cost_code_id ?? "");
  const [rate, setRate] = useState(card.hourly_rate ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");

  return (
    <Modal open title="Edit the entry" onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Saved", () =>
            api.updateTimecard(card.id, {
              worker_name: worker,
              worked_on: when,
              hours: hrs,
              overtime_hours: overtime,
              vendor_id: vendorId || null,
              cost_code_id: codeId || null,
              hourly_rate: rate || null,
              notes: notes || null,
            }),
          );
        }}
      >
        <Field label="Who">
          <input className="input" value={worker} onChange={(e) => setWorker(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Day">
            <input
              type="date"
              className="input"
              value={when}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              required
            />
          </Field>
          <Field label="Rate">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hours">
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              className="input"
              value={hrs}
              onChange={(e) => setHrs(e.target.value)}
              required
            />
          </Field>
          <Field label="Overtime">
            <input
              type="number"
              step="0.25"
              min="0"
              max="24"
              className="input"
              value={overtime}
              onChange={(e) => setOvertime(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trade">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Our own labour</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost code">
            <select className="input" value={codeId} onChange={(e) => setCodeId(e.target.value)}>
              <option value="">Unassigned</option>
              {costCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetTargets({
  jobId,
  jobNumber,
  rows,
  onClose,
  onDone,
}: {
  jobId: string;
  jobNumber: string;
  rows: ProductivityRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.filter((r) => r.cost_code_id).map((r) => [r.cost_code_id!, r.budgeted_hours ?? ""]),
    ),
  );

  const codes = rows.filter((r) => r.cost_code_id);

  return (
    <Modal open title={`Hours ${jobNumber} should take`} onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Targets saved", () =>
            api.setBudgetedHours(
              jobId,
              codes.map((r) => ({
                cost_code_id: r.cost_code_id!,
                budgeted_hours: values[r.cost_code_id!] ? values[r.cost_code_id!] : null,
              })),
            ),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          What each code was supposed to take on this home. Without a target the row can only report
          what was spent, which is the half you already knew. Leave one blank to clear it — that is
          different from nought, which would claim the work should take no time at all.
        </p>
        {codes.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            No hours booked to a cost code on this home yet.
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map((r) => (
              <div key={r.cost_code_id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {r.cost_code}{" "}
                    <span style={{ color: "var(--fg-muted)" }}>{r.cost_code_name}</span>
                  </p>
                  <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {hours(r.hours)} booked so far
                  </p>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="input w-28"
                  value={values[r.cost_code_id!] ?? ""}
                  placeholder="—"
                  aria-label={`Budgeted hours for ${r.cost_code}`}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [r.cost_code_id!]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || codes.length === 0}>
            {busy ? "Saving…" : "Save targets"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
