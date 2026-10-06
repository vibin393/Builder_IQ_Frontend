"use client";

/**
 * Every house the builder has, in one list.
 *
 * What a builder opens this page to find out is not "what homes exist" - they
 * know that. It is:
 *
 *  1. **what has stopped.** A build on hold is burning a plot, a superintendent
 *    and a budget while producing nothing, and it makes no noise.
 *  2. **what is late.** Measured against the projection frozen when the build
 *    started, not against a date somebody keeps moving.
 *  3. **what is stuck in permitting.** A queue nobody watches until it bites.
 *
 * So those three are the queues at the top, and the status chips from the old
 * version are folded into the filter panel where they belong - a status is a
 * filter, but "late" is a calculation, and putting them side by side as if they
 * were the same kind of thing was the mistake.
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
  Loading,
  Menu,
  Modal,
  PageHeader,
  Popover,
  StatTile,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api, type JobQuery } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { CancellationReason, HoldReason, Job, JobStatus } from "@/types/api";

const STATUSES: JobStatus[] = [
  "planned",
  "sold",
  "permitting",
  "under_construction",
  "on_hold",
  "complete",
  "closed",
  "warranty",
  "cancelled",
];

const HOLD_REASONS: { value: HoldReason; label: string }[] = [
  { value: "weather", label: "Weather" },
  { value: "inspection", label: "Waiting on an inspection" },
  { value: "buyer_decision", label: "Waiting on the buyer" },
  { value: "trade_unavailable", label: "Trade unavailable" },
  { value: "material_shortage", label: "Materials" },
  { value: "permit", label: "Permit" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Something else" },
];

const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: "buyer_withdrew", label: "Buyer withdrew" },
  { value: "finance_fell_through", label: "Finance fell through" },
  { value: "builder_withdrew", label: "We withdrew" },
  { value: "lot_problem", label: "Problem with the plot" },
  { value: "plan_changed", label: "Rebuilding as a different house" },
  { value: "other", label: "Something else" },
];

const VIEWS = [
  { key: "all", label: "All homes" },
  { key: "live", label: "Live" },
  { key: "building", label: "On site" },
  { key: "late", label: "Running late" },
] as const;

type View = (typeof VIEWS)[number]["key"];
const PAGE_SIZE = 25;

export default function JobsPage() {
  const [view, setView] = useState<View>("all");
  const [filters, setFilters] = useState({
    status: "",
    community_id: "",
    plan_id: "",
    superintendent_id: "",
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [dialog, setDialog] = useState<
    | { kind: "create" }
    | { kind: "start"; job: Job }
    | { kind: "hold"; job: Job }
    | { kind: "complete"; job: Job }
    | { kind: "close"; job: Job }
    | { kind: "cancel"; job: Job }
    | { kind: "permit"; job: Job }
    | { kind: "edit"; job: Job }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const query: JobQuery = useMemo(
    () => ({
      view,
      page,
      size: PAGE_SIZE,
      search: search || undefined,
      status: filters.status || undefined,
      community_id: filters.community_id || undefined,
      plan_id: filters.plan_id || undefined,
      superintendent_id: filters.superintendent_id || undefined,
    }),
    [view, page, search, filters],
  );

  const jobs = useAsync(() => api.listJobs(query), [query]);
  const summary = useAsync(() => api.jobSummary(), []);
  const cycle = useAsync(() => api.jobCycleTime(), []);
  const communities = useAsync(() => api.listCommunities(), []);
  // Only house types on the price list: an archived plan takes no new homes.
  const plans = useAsync(() => api.listPlans(true), []);
  const staff = useAsync(() => api.listUsers().then((p) => p.items), []);

  const comm = byId(communities.data);
  const plan = byId(plans.data);
  const people = byId(staff.data);

  const rows = jobs.data?.items ?? [];
  const total = jobs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = useCallback(() => {
    jobs.reload();
    summary.reload();
  }, [jobs, summary]);

  const narrow = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  /** Every action reports what it did and refuses to fire twice on one row. */
  const act = async (id: string, done: string, fn: () => Promise<unknown>) => {
    if (busyIds.has(id)) return;
    setBusyIds((b) => new Set(b).add(id));
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
      setBusyIds((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  };

  const activeFilters = useMemo(() => {
    const owner = (staff.data ?? []).find((u) => u.id === filters.superintendent_id);
    return [
      filters.status && { key: "status" as const, label: titleCase(filters.status) },
      filters.community_id && {
        key: "community_id" as const,
        label: comm.get(filters.community_id)?.name ?? "One community",
      },
      filters.plan_id && {
        key: "plan_id" as const,
        label: plan.get(filters.plan_id)?.name ?? "One house type",
      },
      filters.superintendent_id && {
        key: "superintendent_id" as const,
        label: owner ? owner.full_name : "One superintendent",
      },
    ].filter(Boolean) as { key: keyof typeof filters; label: string }[];
  }, [filters, staff.data, comm, plan]);

  return (
    <>
      <PageHeader
        title="Homes"
        subtitle="Every house, from a plot through to warranty. One record each — the contract, the budget, the schedule and the snagging all hang off it."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/reports" className="btn btn-ghost">
              Reports
            </Link>
            <button className="btn btn-primary" onClick={() => setDialog({ kind: "create" })}>
              Start a home
            </button>
          </div>
        }
      />

      {summary.data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="On site" value={summary.data.building} hint="Being built now" />
          <StatTile
            label="Stopped"
            value={summary.data.on_hold}
            hint="Held, with a reason"
            tone={summary.data.on_hold > 0 ? "warn" : "default"}
          />
          <StatTile
            label="Running late"
            value={summary.data.late}
            hint="Past the frozen projection"
            tone={summary.data.late > 0 ? "danger" : "ok"}
          />
          <StatTile
            label="Awaiting permit"
            value={summary.data.awaiting_permit}
            hint="Applied, not yet issued"
            tone={summary.data.awaiting_permit > 0 ? "warn" : "default"}
          />
          {/* Cycle time earns a tile of its own: it is the single figure a
              homebuilder is judged on, and it was computed server-side with no
              way to see it. Null rather than zero when nothing has finished. */}
          <StatTile
            label="Cycle time"
            value={
              cycle.data?.average_days === null || cycle.data === null
                ? "—"
                : `${cycle.data?.average_days}d`
            }
            hint={
              cycle.data?.homes_measured
                ? `Average over ${cycle.data.homes_measured} finished home${cycle.data.homes_measured === 1 ? "" : "s"}`
                : "No homes finished yet"
            }
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist">
        {VIEWS.map((v) => {
          const count =
            v.key === "late"
              ? summary.data?.late
              : v.key === "building"
                ? summary.data?.building
                : v.key === "live"
                  ? summary.data?.live
                  : undefined;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setView(v.key);
                setPage(1);
              }}
              style={
                view === v.key
                  ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 }
                  : {}
              }
            >
              {v.label}
              {count ? (
                <span
                  className="tnum ml-1.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold"
                  style={{
                    background: v.key === "late" ? "var(--danger-soft)" : "var(--neutral-soft)",
                    color: v.key === "late" ? "var(--danger)" : "var(--fg-muted)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="input min-w-[16rem] flex-1 sm:max-w-sm"
          placeholder="Search by home or permit number…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <Popover label="Filters" badge={activeFilters.length} width={300}>
          <div className="space-y-3">
            {view === "all" && (
              <Field label="Status">
                <select
                  className="input"
                  value={filters.status}
                  onChange={(e) => narrow({ status: e.target.value })}
                >
                  <option value="">Any status</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {titleCase(s)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Community">
              <select
                className="input"
                value={filters.community_id}
                onChange={(e) => narrow({ community_id: e.target.value })}
              >
                <option value="">Anywhere</option>
                {(communities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="House type">
              <select
                className="input"
                value={filters.plan_id}
                onChange={(e) => narrow({ plan_id: e.target.value })}
              >
                <option value="">Any plan</option>
                {(plans.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Superintendent">
              <select
                className="input"
                value={filters.superintendent_id}
                onChange={(e) => narrow({ superintendent_id: e.target.value })}
              >
                <option value="">Anyone</option>
                {(staff.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Popover>

        {activeFilters.map((f) => (
          <button
            key={f.key}
            className="chip"
            onClick={() => narrow({ [f.key]: "" } as Partial<typeof filters>)}
            title="Remove this filter"
          >
            {f.label}
            <span aria-hidden className="ml-1 opacity-60">
              ×
            </span>
          </button>
        ))}

        {(search || activeFilters.length > 0) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearch("");
              setFilters({ status: "", community_id: "", plan_id: "", superintendent_id: "" });
              setPage(1);
            }}
          >
            Clear all
          </button>
        )}

        <span className="tnum ml-auto text-sm" style={{ color: "var(--fg-muted)" }}>
          {total === 0 ? "No homes" : `${total} home${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {jobs.error && <ErrorNote message={jobs.error} />}

      <Card padded={false}>
        {jobs.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "job", label: "Home" },
              { key: "community", label: "Community" },
              { key: "plan", label: "House type" },
              { key: "super", label: "Superintendent" },
              { key: "status", label: "Status" },
              { key: "dates", label: "Start / due", align: "right" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty={
              view === "late"
                ? "Nothing is late. Every home is inside its projection."
                : view === "building"
                  ? "Nothing on site at the moment."
                  : "No homes match this filter."
            }
          >
            {rows.map((j) => (
              <tr
                key={j.id}
                style={
                  j.is_late
                    ? { boxShadow: "inset 3px 0 0 0 var(--danger)" }
                    : j.status === "on_hold"
                      ? { boxShadow: "inset 3px 0 0 0 var(--warn)" }
                      : j.status === "cancelled"
                        ? { opacity: 0.55 }
                        : undefined
                }
              >
                <td>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="font-medium"
                    style={{ color: "var(--brand)" }}
                  >
                    {j.job_number}
                  </Link>
                  {j.elevation && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {j.elevation}
                    </div>
                  )}
                </td>
                <td className="text-sm">{comm.get(j.community_id)?.name ?? "—"}</td>
                <td className="text-sm">
                  {plan.get(j.plan_id)?.name ?? "—"}
                  {plan.get(j.plan_id)?.base_price && (
                    <span className="tnum ml-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {money(plan.get(j.plan_id)?.base_price)}
                    </span>
                  )}
                </td>
                <td className="text-sm">
                  {j.superintendent_id
                    ? (people.get(j.superintendent_id)?.full_name ?? "—")
                    : <span style={{ color: "var(--fg-subtle)" }}>Unassigned</span>}
                </td>
                <td>
                  <StatusBadge status={j.status} />
                  {/* Why it stopped, on the row. A held build with no visible
                      reason is how three weeks disappear unnoticed. */}
                  {j.status === "on_hold" && j.hold_reason && (
                    <div className="mt-0.5 text-xs" style={{ color: "var(--warn)" }}>
                      {titleCase(j.hold_reason)}
                      {j.days_since_hold ? ` · ${j.days_since_hold}d` : ""}
                    </div>
                  )}
                  {j.days_waiting_on_permit !== null && (
                    <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      permit {j.days_waiting_on_permit}d
                    </div>
                  )}
                </td>
                <td className="num text-sm">
                  {j.start_date ? day(j.start_date) : "—"}
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {j.actual_completion ? (
                      <>done {day(j.actual_completion)}</>
                    ) : j.projected_completion ? (
                      <span style={j.is_late ? { color: "var(--danger)", fontWeight: 600 } : {}}>
                        due {day(j.projected_completion)}
                        {j.is_late && j.days_late ? ` · ${j.days_late}d late` : ""}
                      </span>
                    ) : (
                      "no date"
                    )}
                  </div>
                </td>
                <td className="num">
                  <RowActions
                    job={j}
                    busy={busyIds.has(j.id)}
                    onDialog={setDialog}
                    onAct={act}
                    onConfirm={confirm}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="tnum">
            Page {page} of {pages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {dialog?.kind === "create" && (
        <StartHome
          communities={communities.data ?? []}
          plans={plans.data ?? []}
          staff={staff.data ?? []}
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "start" && (
        <StartBuild job={dialog.job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "hold" && (
        <HoldBuild job={dialog.job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "complete" && (
        <CompleteBuild job={dialog.job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "close" && (
        <CloseHome job={dialog.job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "cancel" && (
        <CancelHome job={dialog.job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "permit" && (
        <PermitDialog job={dialog.job} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "edit" && (
        <EditHome
          job={dialog.job}
          staff={staff.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); refresh(); }}
        />
      )}
      {confirmDialog}
    </>
  );
}

/* ------------------------------------------------------------ row actions */

type DialogKind = "start" | "hold" | "complete" | "close" | "cancel" | "permit" | "edit";

/**
 * What a superintendent or a sales manager does to a home from the list.
 *
 * Built from the home's current status, so no entry here exists only to produce
 * an error. Offering "Close" on a planned house would be a button whose entire
 * job is to be refused.
 */
function RowActions({
  job,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  job: Job;
  busy: boolean;
  onDialog: (d: { kind: DialogKind; job: Job }) => void;
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
  const n = job.job_number;

  switch (job.status) {
    case "planned":
    case "sold":
      if (!job.permit_applied_on)
        items.push({ label: "Apply for a permit", run: () => onDialog({ kind: "permit", job }) });
      items.push({ label: "Start the build…", run: () => onDialog({ kind: "start", job }) });
      break;
    case "permitting":
      items.push({ label: "Permit issued…", run: () => onDialog({ kind: "permit", job }) });
      items.push({ label: "Start the build…", run: () => onDialog({ kind: "start", job }) });
      break;
    case "under_construction":
      items.push({ label: "Put on hold…", run: () => onDialog({ kind: "hold", job }) });
      items.push({ label: "Mark complete…", run: () => onDialog({ kind: "complete", job }) });
      break;
    case "on_hold":
      items.push({
        label: "Resume the build",
        run: () => onAct(job.id, `${n} back on site`, () => api.resumeBuild(job.id)),
      });
      break;
    case "complete":
      items.push({ label: "Close and hand over…", run: () => onDialog({ kind: "close", job }) });
      items.push({
        label: "Send back to site…",
        tone: "danger",
        run: () =>
          onConfirm({
            title: `Send ${n} back to site?`,
            body: "This clears the completion date. A home that went back on site was not finished, and leaving the date would report a cycle time that never happened.",
            confirmLabel: "Reopen",
            tone: "danger",
            onConfirm: () =>
              onAct(job.id, `${n} reopened`, () =>
                api.reopenBuild(job.id, "Reopened from the homes list"),
              ),
          }),
      });
      break;
    case "closed":
      items.push({
        label: "Move into warranty",
        run: () => onAct(job.id, `${n} in warranty`, () => api.enterWarranty(job.id)),
      });
      break;
  }

  // Available whatever the stage: a superintendent changes, a permit number
  // arrives late, and the projection sometimes has to be re-baselined.
  if (job.status !== "cancelled") {
    items.push({ label: "Edit details…", run: () => onDialog({ kind: "edit", job }) });
  }

  // Cancelling is available right up to handover, because a half-built home
  // falling through is a real and expensive event the system should record
  // rather than force somebody to fake.
  if (job.is_live) {
    items.push({
      label: "Cancel this home…",
      tone: "danger",
      run: () => onDialog({ kind: "cancel", job }),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {job.status === "cancelled" ? "Cancelled" : "Finished"}
      </span>
    );
  }
  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

/* ---------------------------------------------------------------- dialogs */

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

function StartBuild({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [due, setDue] = useState(job.projected_completion ?? "");
  const [allowUnsold, setAllowUnsold] = useState(false);
  const unsold = job.status === "planned";

  return (
    <Modal open title={`Start ${job.job_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${job.job_number} is on site`, () =>
            api.startBuild(job.id, {
              start_date: start || undefined,
              projected_completion: due || undefined,
              allow_unsold: allowUnsold,
            }),
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" hint="When work actually began.">
            <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field
            label="Projected completion"
            hint="Frozen here. This is the date slip is measured against."
          >
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>

        {unsold && (
          <div
            className="rounded-[var(--radius)] px-3 py-2 text-sm"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={allowUnsold}
                onChange={(e) => setAllowUnsold(e.target.checked)}
              />
              <span>
                <strong>This home has not been sold.</strong> Starting it is building on spec —
                allowed, and a real strategy, but tick to say you mean it rather than clicking it by
                accident.
              </span>
            </label>
          </div>
        )}

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || (unsold && !allowUnsold)}>
            {busy ? "Starting…" : "Start the build"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HoldBuild({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [reason, setReason] = useState<HoldReason>("weather");
  const [note, setNote] = useState("");

  return (
    <Modal open title={`Put ${job.job_number} on hold`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${job.job_number} on hold`, () =>
            api.holdBuild(job.id, { reason, note: note || undefined }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The reason comes from a list so days lost can be counted per cause — &ldquo;we lost forty
          days to inspections this year&rdquo; is a sentence worth being able to say.
        </p>
        <Field label="Why has it stopped">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value as HoldReason)}>
            {HOLD_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Note"
          hint={reason === "other" ? "Required when the reason is 'something else'." : undefined}
        >
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Put on hold"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CompleteBuild({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));

  return (
    <Modal open title={`Mark ${job.job_number} complete`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${job.job_number} complete`, () => api.completeBuild(job.id, { completed_on: when }));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Built, not handed over. Between here and closing sit the final inspection, the snagging
          list and the money.
        </p>
        <Field label="Completed on">
          <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </Field>
        {job.start_date && (
          <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            Started {day(job.start_date)} — this sets the cycle time for the home.
          </p>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Mark complete"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CloseHome({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [months, setMonths] = useState("24");

  return (
    <Modal open title={`Hand over ${job.job_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${job.job_number} handed over`, () =>
            api.closeJob(job.id, { closing_date: when, warranty_months: Number(months) || 24 }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Title transfers and the warranty clock starts. Refused without a signed contract — that
          document is what the handover rests on.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Closing date">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
          <Field label="Warranty" hint="Months from handover, not from completion.">
            <input type="number" min={0} className="input" value={months} onChange={(e) => setMonths(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Closing…" : "Hand over"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CancelHome({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [reason, setReason] = useState<CancellationReason>("buyer_withdrew");
  const [note, setNote] = useState("");

  return (
    <Modal open title={`Cancel ${job.job_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${job.job_number} cancelled`, () =>
            api.cancelJob(job.id, { reason, note: note || undefined }),
          );
        }}
      >
        <div
          className="rounded-[var(--radius)] px-3 py-2 text-sm"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          The plot goes back on the market and a new home can be started on it. This record stays,
          so the cancellation is counted rather than edited away.
        </div>
        <Field label="Why">
          <select
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value as CancellationReason)}
          >
            {CANCELLATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Note"
          hint={reason === "other" ? "Required when the reason is 'something else'." : undefined}
        >
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Keep it
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Cancelling…" : "Cancel the home"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PermitDialog({ job, onClose, onDone }: { job: Job; onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const applying = job.status !== "permitting";
  const [number, setNumber] = useState(job.permit_number ?? "");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));

  return (
    <Modal
      open
      title={applying ? `Permit application — ${job.job_number}` : `Permit issued — ${job.job_number}`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (applying) {
            run(`${job.job_number} in permitting`, () =>
              api.applyForPermit(job.id, {
                permit_number: number || undefined,
                permit_applied_on: when,
              }),
            );
          } else {
            run(`Permit recorded for ${job.job_number}`, () =>
              api.permitIssued(job.id, { number, issued_on: when }),
            );
          }
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {applying
            ? "Starts the clock, so the wait shows on the list."
            : "Recording the permit does not start the build — a permit in hand is not work having begun."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Permit number">
            <input
              className="input"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required={!applying}
              placeholder="BCP/2026/4471"
            />
          </Field>
          <Field label={applying ? "Applied on" : "Issued on"}>
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : applying ? "Record the application" : "Record the permit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


/**
 * Correcting a home.
 *
 * Three of these are worth calling out:
 *
 *  - **the superintendent** could be seen on the list and set only when the home
 *    was created, so a handover between site managers had nowhere to be recorded.
 *  - **the projected completion** is the baseline "late" is measured against.
 *    Changing it is re-baselining, which is a legitimate thing to do and a
 *    significant one, so it says so rather than sitting unlabelled among the
 *    other fields.
 *  - **status is absent.** It moves through the lifecycle steps, which check the
 *    move and write the dates that go with it.
 */
function EditHome({
  job,
  staff,
  onClose,
  onDone,
}: {
  job: Job;
  staff: { id: string; full_name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [superId, setSuperId] = useState(job.superintendent_id ?? "");
  const [elevation, setElevation] = useState(job.elevation ?? "");
  const [due, setDue] = useState(job.projected_completion ?? "");
  const [permit, setPermit] = useState(job.permit_number ?? "");
  const [notes, setNotes] = useState(job.notes ?? "");

  const rebaselining =
    job.projected_completion !== null && due !== "" && due !== job.projected_completion;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run(`${job.job_number} updated`, async () => {
      // The superintendent has its own route, because assigning one is a real
      // action rather than a field edit - and it is the only part of this form
      // that changes who is responsible for the house.
      if (superId !== (job.superintendent_id ?? "")) {
        await api.assignSuperintendent(job.id, superId || null);
      }
      const patch: Record<string, unknown> = {};
      if (elevation !== (job.elevation ?? "")) patch.elevation = elevation || null;
      if (due !== (job.projected_completion ?? "")) patch.projected_completion = due || null;
      if (permit !== (job.permit_number ?? "")) patch.permit_number = permit || null;
      if (notes !== (job.notes ?? "")) patch.notes = notes || null;
      if (Object.keys(patch).length) await api.updateJob(job.id, patch);
    });
  }

  return (
    <Modal open title={`Edit ${job.job_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Superintendent" hint="Whose site this is.">
            <select className="input" value={superId} onChange={(e) => setSuperId(e.target.value)}>
              <option value="">Nobody</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Elevation">
            <input
              className="input"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              placeholder="Brick"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Projected completion">
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Permit number">
            <input className="input" value={permit} onChange={(e) => setPermit(e.target.value)} />
          </Field>
        </div>

        {rebaselining && (
          <div
            className="rounded-[var(--radius)] px-3 py-2 text-sm"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            <strong>You are re-baselining.</strong> {job.job_number} is currently measured against{" "}
            {day(job.projected_completion)}. Moving it changes what counts as late — which is
            sometimes right, and is worth doing on purpose rather than by habit.
          </div>
        )}

        <Field label="Notes">
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- start a home */

function StartHome({
  communities,
  plans,
  staff,
  onClose,
  onCreated,
}: {
  communities: { id: string; name: string }[];
  plans: { id: string; name: string; base_price?: string }[];
  staff: { id: string; full_name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [communityId, setCommunityId] = useState("");
  const [lotId, setLotId] = useState("");
  const [planId, setPlanId] = useState("");
  const [elevation, setElevation] = useState("");
  const [superId, setSuperId] = useState("");
  const elevations = useAsync(
    () => (planId ? api.listElevations(planId) : Promise.resolve([])),
    [planId],
  );
  const fronts = (elevations.data ?? []).filter((e) => e.is_active);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lots = useAsync(
    () => (communityId ? api.listLots(communityId, { buildable: true }) : Promise.resolve([])),
    [communityId],
  );
  // Somewhere to build: no live home on the plot. That is not the same as "for sale" -
  // a spec home's plot is still for sale - so the server decides, from the job itself.
  const available = lots.data ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const job = await api.createJob({
        community_id: communityId,
        lot_id: lotId,
        plan_id: planId,
        elevation: elevation || undefined,
        superintendent_id: superId || undefined,
      } as never);
      toast.success(`${job.job_number} created`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the home");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Start a home" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Community">
          <select
            className="input"
            value={communityId}
            onChange={(e) => {
              setCommunityId(e.target.value);
              setLotId("");
            }}
            required
          >
            <option value="">Choose…</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Plot"
          hint={
            communityId && available.length === 0
              ? "No free plots in this community — every one already has a home on it."
              : "Only plots with no live home on them."
          }
        >
          <select
            className="input"
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            required
            disabled={!communityId}
          >
            <option value="">Choose…</option>
            {available.map((l) => (
              <option key={l.id} value={l.id}>
                Plot {l.lot_number}
                {l.address ? ` — ${l.address}` : ""}
                {l.status === "sold" ? " (sold)" : l.status === "held" ? " (on hold)" : l.status === "not_released" ? " (not released)" : ""}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="House type">
            <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
              <option value="">Choose…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.base_price ? ` — ${money(p.base_price)}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Elevation"
            hint={fronts.length ? "The fronts this plan is built with." : "Brick, render, stone — whichever this one is."}
          >
            {fronts.length ? (
              <select className="input" value={elevation} onChange={(e) => setElevation(e.target.value)}>
                <option value="">Not decided yet</option>
                {fronts.map((f) => (
                  <option key={f.id} value={f.code}>
                    {f.code} — {f.name}
                    {Number(f.price_adjustment) ? ` (${Number(f.price_adjustment) > 0 ? "+" : ""}${money(f.price_adjustment)})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input" value={elevation} onChange={(e) => setElevation(e.target.value)} />
            )}
          </Field>
        </div>

        <Field label="Superintendent" hint="Can be set later.">
          <select className="input" value={superId} onChange={(e) => setSuperId(e.target.value)}>
            <option value="">Nobody yet</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          The home starts as <Badge tone="neutral">Planned</Badge>. Selling it, permitting it and
          putting it on site are each their own step.
        </p>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Start the home"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
