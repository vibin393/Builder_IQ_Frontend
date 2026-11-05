"use client";

/**
 * Field operations.
 *
 * The screen a superintendent opens during the last fortnight of a build, when the
 * question is no longer "what are we doing" but "what is stopping this house being
 * handed over".
 *
 * So the headline is **blocking handover** — defects that are not merely cosmetic
 * and will stop the keys changing hands. The Homes close route refuses while any
 * of them are open, so this number is not advisory; it is the list somebody has to
 * clear.
 *
 * The other change from the old screen is the ball-in-court dropdown. It let
 * anybody set who owed the next move, which made it a label rather than a fact.
 * It follows the action now: assigning puts it with the trade, submitting a fix
 * puts it back with the builder.
 */

import Link from "next/link";
import { useCallback, useState } from "react";

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
  StatusBadge,
  day,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { Inspection, PunchItem, PunchSeverity } from "@/types/api";

type Tab = "punch" | "inspections" | "logs";

/**
 * Cosmetic is the only severity that does not stop a handover. Saying "major and
 * blocking stop it" would read as permission to leave a minor defect open, and
 * then the close route refuses and the screen looks broken.
 */
const SEVERITIES: { value: PunchSeverity; label: string; hint: string }[] = [
  {
    value: "cosmetic",
    label: "Cosmetic",
    hint: "The only severity that does not stop a handover. A buyer will take the house and a decorator comes back.",
  },
  { value: "minor", label: "Minor", hint: "Stops the handover until it is signed off." },
  { value: "major", label: "Major", hint: "Stops the handover." },
  {
    value: "blocking",
    label: "Blocking",
    hint: "Life-safety or habitability. Stops the handover and cannot be declined.",
  },
];

function severityTone(s: PunchSeverity) {
  return s === "blocking" ? "danger" : s === "major" ? "warn" : "neutral";
}

export default function FieldOpsPage() {
  const [tab, setTab] = useState<Tab>("punch");
  const [jobFilter, setJobFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "newPunch" }
    | { kind: "assign"; item: PunchItem }
    | { kind: "edit"; item: PunchItem }
    | { kind: "reason"; item: PunchItem; mode: "reject" | "wontFix" | "reopen" }
    | { kind: "newInspection" }
    | { kind: "checklist"; inspection: Inspection }
    | { kind: "outcome"; inspection: Inspection }
    | { kind: "reinspect"; inspection: Inspection }
    | { kind: "log" }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const scope = jobFilter || undefined;
  const summary = useAsync(() => api.fieldSummary(scope), [jobFilter]);
  const punch = useAsync(() => api.listPunchItems({ job_id: scope, size: 100 }), [jobFilter]);
  const inspections = useAsync(
    () => api.listInspections({ job_id: scope, size: 100 }),
    [jobFilter],
  );
  const logs = useAsync(() => api.listDailyLogs({ job_id: scope, size: 100 }), [jobFilter]);
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  /**
   * Asked of the server rather than filtered out of the rows on screen. The list
   * is paged, so deriving it here would have quietly under-reported as soon as a
   * home had more than a page of defects - and this is the one number on the
   * screen somebody acts on. It is also the same call the close route makes, so
   * the banner and the refusal cannot disagree.
   */
  const blockers = useAsync(
    () => (jobFilter ? api.blockingHandover(jobFilter) : Promise.resolve([])),
    [jobFilter],
  );

  const job = byId(jobs.data);
  const vendor = byId(vendors.data);

  const refresh = useCallback(() => {
    summary.reload();
    punch.reload();
    inspections.reload();
    logs.reload();
    blockers.reload();
  }, [summary, punch, inspections, logs, blockers]);

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

  const punchRows = punch.data?.items ?? [];
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Field operations"
        subtitle="What happened on site, what has to pass, and what is still stopping a handover."
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
            <button className="btn btn-ghost" onClick={() => setDialog({ kind: "log" })}>
              Today&rsquo;s log
            </button>
            <button className="btn btn-primary" onClick={() => setDialog({ kind: "newPunch" })}>
              Add a defect
            </button>
          </>
        }
      />

      {s && (
        <div className="metric-strip mb-5">
          {/* First, because it is the only number here that stops a handover. */}
          <div className="metric">
            <span className="metric-label">Blocking handover</span>
            <span
              className="metric-value"
              style={s.blocking_handover > 0 ? { color: "var(--danger)" } : { color: "var(--ok)" }}
            >
              {s.blocking_handover}
            </span>
            <span className="metric-hint">Everything but cosmetic</span>
          </div>
          <div className="metric">
            <span className="metric-label">Awaiting sign-off</span>
            <span
              className="metric-value"
              style={s.awaiting_review > 0 ? { color: "var(--warn)" } : undefined}
            >
              {s.awaiting_review}
            </span>
            <span className="metric-hint">Trade says done</span>
          </div>
          <div className="metric">
            <span className="metric-label">Overdue</span>
            <span
              className="metric-value"
              style={s.overdue_punch > 0 ? { color: "var(--danger)" } : undefined}
            >
              {s.overdue_punch}
            </span>
            <span className="metric-hint">Past the date given</span>
          </div>
          <div className="metric">
            <span className="metric-label">From the buyer</span>
            <span className="metric-value">{s.from_walkthrough}</span>
            <span className="metric-hint">Raised at walkthrough</span>
          </div>
          <div className="metric">
            <span className="metric-label">Failed inspections</span>
            <span
              className="metric-value"
              style={s.failed_inspections > 0 ? { color: "var(--danger)" } : undefined}
            >
              {s.failed_inspections}
            </span>
            <span className="metric-hint">Needing a re-inspection</span>
          </div>
        </div>
      )}

      {jobFilter && (blockers.data?.length ?? 0) > 0 && (
        <div
          className="mb-4 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <strong>
            {job.get(jobFilter)?.job_number} cannot be handed over:{" "}
            {blockers.data?.length} defect{blockers.data?.length === 1 ? "" : "s"} still open.
          </strong>{" "}
          Sign them off, or mark the ones that are genuinely cosmetic as such — a buyer will take a
          house with a scuff on it and not one with a leak.
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
              ["punch", "Punch list", punch.data?.total ?? 0],
              ["inspections", "Inspections", inspections.data?.total ?? 0],
              ["logs", "Daily logs", logs.data?.total ?? 0],
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

        {tab === "inspections" && (
          <button
            className="btn btn-ghost btn-sm ml-auto"
            onClick={() => setDialog({ kind: "newInspection" })}
          >
            Book an inspection
          </button>
        )}
      </div>

      {punch.error && <ErrorNote message={punch.error} />}

      {tab === "punch" && (
        <Card padded={false}>
          {punch.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "defect", label: "Defect" },
                { key: "home", label: "Home" },
                { key: "trade", label: "Trade" },
                { key: "due", label: "Due", align: "right" },
                { key: "status", label: "Status" },
                { key: "actions", label: "", align: "right" },
              ]}
              empty="Nothing on the punch list."
            >
              {punchRows.map((p) => (
                <tr
                  key={p.id}
                  style={
                    p.blocks_handover
                      ? { boxShadow: "inset 3px 0 0 0 var(--danger)" }
                      : p.is_overdue
                        ? { boxShadow: "inset 3px 0 0 0 var(--warn)" }
                        : !p.is_unresolved
                          ? { opacity: 0.6 }
                          : undefined
                  }
                >
                  <td>
                    <span className="font-medium">{p.description}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone={severityTone(p.severity)}>{titleCase(p.severity)}</Badge>
                      {p.from_walkthrough && <Badge tone="brand">Walkthrough</Badge>}
                      {p.location && (
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {p.location}
                        </span>
                      )}
                    </div>
                    {p.resolution_note && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                        {p.resolution_note}
                      </div>
                    )}
                  </td>
                  <td className="text-sm">
                    <Link
                      href={`/jobs/${p.job_id}`}
                      className="font-medium"
                      style={{ color: "var(--brand)" }}
                    >
                      {job.get(p.job_id)?.job_number ?? "—"}
                    </Link>
                  </td>
                  <td className="text-sm">
                    {p.vendor_id ? (
                      (vendor.get(p.vendor_id)?.name ?? "—")
                    ) : (
                      <span style={{ color: "var(--fg-subtle)" }}>Unassigned</span>
                    )}
                  </td>
                  <td className="num text-sm">
                    {p.due_date ? day(p.due_date) : "—"}
                    {p.days_overdue !== null && (
                      <div className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
                        {p.days_overdue}d over
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                    {/* Who owes the next move. Read-only: it follows the action
                        rather than being something anybody can set, which is what
                        made it a label rather than a fact. */}
                    <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      with the {p.ball_in_court}
                    </div>
                  </td>
                  <td className="num">
                    <PunchActions
                      item={p}
                      busy={busy === p.id}
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
      )}

      {tab === "inspections" && (
        <Card padded={false}>
          {inspections.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "name", label: "Inspection" },
                { key: "home", label: "Home" },
                { key: "when", label: "When", align: "right" },
                { key: "checks", label: "Checks", align: "right" },
                { key: "result", label: "Result" },
                { key: "actions", label: "", align: "right" },
              ]}
              empty="No inspections booked."
            >
              {(inspections.data?.items ?? []).map((i) => (
                <tr
                  key={i.id}
                  style={i.is_blocking ? { boxShadow: "inset 3px 0 0 0 var(--danger)" } : undefined}
                >
                  <td>
                    <span className="font-medium">{i.name}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone="neutral">{titleCase(i.inspection_type)}</Badge>
                      {i.reinspects_id && <Badge tone="warn">Re-inspection</Badge>}
                      {Number(i.fee) > 0 && (
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          fee {i.fee}
                        </span>
                      )}
                    </div>
                    {i.failure_reason && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--danger)" }}>
                        {i.failure_reason}
                      </div>
                    )}
                  </td>
                  <td className="text-sm">{job.get(i.job_id)?.job_number ?? "—"}</td>
                  <td className="num text-sm">
                    {day(i.completed_date ?? i.scheduled_date)}
                    {i.inspector && (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {i.inspector}
                      </div>
                    )}
                  </td>
                  <td className="num tnum text-sm">
                    {i.checked_items}/{i.items.length}
                    {i.items.some((c) => c.result === "fail") && (
                      <div className="text-xs" style={{ color: "var(--danger)" }}>
                        {i.items.filter((c) => c.result === "fail").length} failed
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={i.result} />
                  </td>
                  <td className="num">
                    <InspectionActions
                      inspection={i}
                      busy={busy === i.id}
                      onDialog={setDialog}
                      onAct={act}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {tab === "logs" && (
        <Card padded={false}>
          {logs.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "date", label: "Day" },
                { key: "home", label: "Home" },
                { key: "weather", label: "Weather" },
                { key: "crew", label: "Crew", align: "right" },
                { key: "work", label: "What happened" },
              ]}
              empty="No logs filed."
            >
              {(logs.data?.items ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="text-sm font-medium">{day(l.log_date)}</td>
                  <td className="text-sm">{job.get(l.job_id)?.job_number ?? "—"}</td>
                  <td className="text-sm">{l.weather ?? "—"}</td>
                  <td className="num tnum text-sm">{l.crew_count ?? "—"}</td>
                  <td className="text-sm">
                    {l.work_performed ?? "—"}
                    {l.delays && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--warn)" }}>
                        Delay: {l.delays}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
            One log per home per day. Filing again adds to that day&rsquo;s entry rather than
            creating a second one — a record that contradicts itself substantiates nothing.
          </p>
        </Card>
      )}

      {dialog?.kind === "newPunch" && (
        <NewPunch
          jobs={jobs.data ?? []}
          vendors={vendors.data ?? []}
          defaultJob={jobFilter}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "assign" && (
        <AssignPunch
          item={dialog.item}
          vendors={vendors.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "edit" && (
        <EditPunch
          item={dialog.item}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "reason" && (
        <PunchReason
          item={dialog.item}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "newInspection" && (
        <NewInspection
          jobs={jobs.data ?? []}
          defaultJob={jobFilter}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "checklist" && (
        <Checklist
          inspection={dialog.inspection}
          vendors={vendors.data ?? []}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}
      {dialog?.kind === "outcome" && (
        <RecordOutcome
          inspection={dialog.inspection}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "reinspect" && (
        <BookReinspection
          inspection={dialog.inspection}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "log" && (
        <NewLog
          jobs={jobs.data ?? []}
          defaultJob={jobFilter}
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

/* --------------------------------------------------------------- actions */

type FieldDialog =
  | { kind: "assign"; item: PunchItem }
  | { kind: "edit"; item: PunchItem }
  | { kind: "reason"; item: PunchItem; mode: "reject" | "wontFix" | "reopen" }
  | { kind: "checklist"; inspection: Inspection }
  | { kind: "outcome"; inspection: Inspection }
  | { kind: "reinspect"; inspection: Inspection };

function PunchActions({
  item,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  item: PunchItem;
  busy: boolean;
  onDialog: (d: FieldDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  const p = item;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  // First, and on every status that can still change, because it is the way out
  // of the one refusal that tells you to change something: declining a blocking
  // defect is refused until its severity is downgraded deliberately.
  if (p.status !== "complete") {
    items.push({ label: "Edit details…", run: () => onDialog({ kind: "edit", item: p }) });
  }

  if (p.status === "open" || p.status === "assigned") {
    items.push({
      label: p.vendor_id ? "Reassign…" : "Give it to a trade…",
      run: () => onDialog({ kind: "assign", item: p }),
    });
    items.push({
      label: "Trade says it is done",
      run: () => onAct(p.id, "Marked for review", () => api.submitPunch(p.id)),
    });
    items.push({
      label: "Not fixing it…",
      tone: "danger",
      run: () => onDialog({ kind: "reason", item: p, mode: "wontFix" }),
    });
  }
  if (p.status === "ready_for_review") {
    items.push({
      label: "Sign it off",
      run: () =>
        onConfirm({
          title: `Sign off "${p.description.slice(0, 40)}"?`,
          body: "Records that you have looked at the fix and accepted it. Until somebody does, this defect still counts against the handover.",
          confirmLabel: "Sign off",
          onConfirm: () => onAct(p.id, "Signed off", () => api.verifyPunch(p.id)),
        }),
    });
    items.push({
      label: "Send it back…",
      tone: "danger",
      run: () => onDialog({ kind: "reason", item: p, mode: "reject" }),
    });
  }
  if (p.status === "wont_fix") {
    items.push({
      label: "Reopen it…",
      run: () => onDialog({ kind: "reason", item: p, mode: "reopen" }),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {p.verified_date ? `Signed off ${day(p.verified_date)}` : titleCase(p.status)}
      </span>
    );
  }
  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

function InspectionActions({
  inspection,
  busy,
  onDialog,
  onAct,
}: {
  inspection: Inspection;
  busy: boolean;
  onDialog: (d: FieldDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
}) {
  const i = inspection;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [
    { label: "Checklist…", run: () => onDialog({ kind: "checklist", inspection: i }) },
  ];

  if (i.result === "scheduled") {
    items.push({ label: "Record the result…", run: () => onDialog({ kind: "outcome", inspection: i }) });
  }
  if (i.result === "failed") {
    if (i.items.some((c) => c.result === "fail")) {
      items.push({
        label: "Make a punch list from the failures",
        run: () =>
          onAct(i.id, "Punch items created", async () => {
            const created = await api.punchFromFailures(i.id);
            if (!created.length) throw new Error("Every failed check already has a punch item.");
          }),
      });
    }
    items.push({ label: "Book a re-inspection…", run: () => onDialog({ kind: "reinspect", inspection: i }) });
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

function NewPunch({
  jobs,
  vendors,
  defaultJob,
  onClose,
  onDone,
}: {
  jobs: { id: string; job_number: string }[];
  vendors: { id: string; name: string }[];
  defaultJob: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [jobId, setJobId] = useState(defaultJob);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<PunchSeverity>("minor");
  const [vendorId, setVendorId] = useState("");
  const [due, setDue] = useState("");
  const [walkthrough, setWalkthrough] = useState(false);

  const chosen = SEVERITIES.find((s) => s.value === severity)!;

  return (
    <Modal open title="Add a defect" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Defect added", () =>
            api.createPunchItem({
              job_id: jobId,
              description,
              location: location || undefined,
              severity,
              vendor_id: vendorId || undefined,
              due_date: due || undefined,
              from_walkthrough: walkthrough,
            }),
          );
        }}
      >
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
        <Field label="What is wrong">
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Scuff on the hallway wall"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Due">
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label="How much it matters" hint={chosen.hint}>
          <select
            className="input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as PunchSeverity)}
          >
            {SEVERITIES.map((sv) => (
              <option key={sv.value} value={sv.value}>
                {sv.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trade" hint="Assigning it is what lets the work be backcharged.">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Decide later</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={walkthrough} onChange={(e) => setWalkthrough(e.target.checked)} />{" "}
          Raised by the buyer at the walkthrough
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignPunch({
  item,
  vendors,
  onClose,
  onDone,
}: {
  item: PunchItem;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [vendorId, setVendorId] = useState(item.vendor_id ?? "");
  const [due, setDue] = useState(item.due_date ?? "");

  return (
    <Modal open title="Give it to a trade" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Assigned", () =>
            api.assignPunch(item.id, { vendor_id: vendorId, due_date: due || undefined }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Assigning it puts the ball in their court and is what lets the work be backcharged rather
          than absorbed. A defect nobody owns is the kind that sits open until handover week.
        </p>
        <Field label="Trade">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Choose…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="By when">
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Assign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditPunch({
  item,
  onClose,
  onDone,
}: {
  item: PunchItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [description, setDescription] = useState(item.description);
  const [location, setLocation] = useState(item.location ?? "");
  const [severity, setSeverity] = useState<PunchSeverity>(item.severity);
  const [due, setDue] = useState(item.due_date ?? "");

  const chosen = SEVERITIES.find((sv) => sv.value === severity)!;
  const downgrading = item.severity === "blocking" && severity !== "blocking";

  return (
    <Modal open title="Edit the defect" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Saved", () =>
            api.updatePunchItem(item.id, {
              description,
              location: location || null,
              severity,
              due_date: due || null,
            }),
          );
        }}
      >
        <Field label="What is wrong">
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Due">
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label="How much it matters" hint={chosen.hint}>
          <select
            className="input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as PunchSeverity)}
          >
            {SEVERITIES.map((sv) => (
              <option key={sv.value} value={sv.value}>
                {sv.label}
              </option>
            ))}
          </select>
        </Field>
        {downgrading && (
          <p
            className="rounded-[var(--radius)] px-3 py-2 text-sm"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            You are taking this off the blocking list. That is the deliberate decision
            the won&rsquo;t-fix refusal asks for — so make it because the severity was
            wrong, not because the defect is inconvenient.
          </p>
        )}
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Status is not editable here. It moves through the actions on the row, which
          record who accepted the fix.
        </p>
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

function PunchReason({
  item,
  mode,
  onClose,
  onDone,
}: {
  item: PunchItem;
  mode: "reject" | "wontFix" | "reopen";
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [reason, setReason] = useState("");

  const copy = {
    reject: {
      title: "Send the fix back",
      body: "The trade has to know what is still wrong, and you will want the record when the same defect is argued about at handover.",
      placeholder: "Paint does not match the rest of the wall",
      label: "Send it back",
      done: "Sent back to the trade",
      call: () => api.rejectPunch(item.id, reason),
    },
    wontFix: {
      title: "Not fixing it",
      body: "This is the item a buyer will ask about at handover, so the reason goes on the record. Anything marked blocking cannot be declined — downgrade its severity deliberately if that is wrong.",
      placeholder: "Within tolerance; agreed with the buyer",
      label: "Record it",
      done: "Recorded",
      call: () => api.wontFixPunch(item.id, reason),
    },
    reopen: {
      title: "Reopen the defect",
      body: "Puts it back on the list.",
      placeholder: "Buyer raised it again at the second walkthrough",
      label: "Reopen",
      done: "Reopened",
      call: () => api.reopenPunch(item.id, reason),
    },
  }[mode];

  return (
    <Modal open title={copy.title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(copy.done, copy.call);
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {copy.body}
        </p>
        <Field label="Reason">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            placeholder={copy.placeholder}
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : copy.label}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewInspection({
  jobs,
  defaultJob,
  onClose,
  onDone,
}: {
  jobs: { id: string; job_number: string }[];
  defaultJob: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [jobId, setJobId] = useState(defaultJob);
  const [name, setName] = useState("");
  const [type, setType] = useState("municipal");
  const [when, setWhen] = useState("");
  const [inspector, setInspector] = useState("");

  return (
    <Modal open title="Book an inspection" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Inspection booked", () =>
            api.createInspection({
              job_id: jobId,
              name,
              inspection_type: type,
              scheduled_date: when || undefined,
              inspector: inspector || undefined,
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
          <Field label="Kind" hint="A failed municipal inspection is a legal stop.">
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {["municipal", "third_party", "internal_qa", "walkthrough"].map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Framing" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Inspector">
            <input className="input" value={inspector} onChange={(e) => setInspector(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Booking…" : "Book it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Checklist({
  inspection,
  vendors,
  onClose,
  onChanged,
}: {
  inspection: Inspection;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const detail = useAsync(
    () => api.listInspections({ job_id: inspection.job_id, size: 100 }),
    [inspection.id],
  );
  const current =
    detail.data?.items.find((i) => i.id === inspection.id) ?? inspection;
  const [adding, setAdding] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});

  const editable = current.result === "scheduled";

  const mark = async (itemId: string, result: string) => {
    try {
      await api.recordItemResult(itemId, { result, notes: note[itemId] });
      toast.success(result === "fail" ? "Recorded as failed" : "Recorded");
      detail.reload();
      onChanged();
    } catch (err) {
      toast.error("Could not record it", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <Modal open title={`${current.name} — checklist`} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          A framing inspection is thirty checks, not one verdict. Recording the overall result alone
          tells you the house failed; recording the items tells you what to send the framer back
          for.
        </p>

        {current.items.length === 0 && (
          <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            No checks yet.
          </p>
        )}

        {[...current.items]
          .sort((a, b) => a.sequence - b.sequence)
          .map((c) => (
            <div
              key={c.id}
              className="rounded-[var(--radius)] p-3"
              style={{
                border: "1px solid var(--border)",
                background: c.result === "fail" ? "var(--danger-soft)" : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.description}</p>
                  {c.notes && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                      {c.notes}
                    </p>
                  )}
                </div>
                <Badge
                  tone={c.result === "fail" ? "danger" : c.result === "pass" ? "ok" : "neutral"}
                >
                  {titleCase(c.result)}
                </Badge>
              </div>
              {editable && c.result === "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="What is wrong (required to fail it)"
                    value={note[c.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [c.id]: e.target.value }))}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={() => mark(c.id, "pass")}>
                    Pass
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--danger)" }}
                    onClick={() => mark(c.id, "fail")}
                  >
                    Fail
                  </button>
                </div>
              )}
            </div>
          ))}

        {editable ? (
          <form
            className="flex flex-wrap items-end gap-2 border-t pt-3"
            style={{ borderColor: "var(--border)" }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.addInspectionItem(current.id, {
                  description: adding,
                  vendor_id: vendorId || undefined,
                });
                setAdding("");
                detail.reload();
              } catch (err) {
                toast.error("Could not add it", err instanceof Error ? err.message : undefined);
              }
            }}
          >
            <input
              className="input min-w-[12rem] flex-1"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Add a check"
              required
            />
            <select className="input w-auto" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Whose check</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
        ) : (
          <p className="border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--fg-subtle)" }}>
            The inspection has been carried out, so its checklist is fixed.
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function RecordOutcome({
  inspection,
  onClose,
  onDone,
}: {
  inspection: Inspection;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [result, setResult] = useState("passed");
  const [reason, setReason] = useState("");
  const [fee, setFee] = useState("");

  const failedChecks = inspection.items.filter((c) => c.result === "fail").length;

  return (
    <Modal open title={`How did ${inspection.name} go?`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Result recorded", () =>
            api.recordInspectionResult(inspection.id, {
              result,
              failure_reason: reason || undefined,
              fee: fee || undefined,
            }),
          );
        }}
      >
        <Field label="Result">
          <select className="input" value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        {result === "failed" && (
          <>
            <Field
              label="What went wrong"
              hint={
                failedChecks
                  ? `${failedChecks} check${failedChecks === 1 ? "" : "s"} already marked failed — this is the headline.`
                  : "Required unless individual checks have been failed."
              }
            >
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field label="Re-inspection fee" hint="Small and relentless. Nobody argues one back to a trade without a number.">
              <input type="number" min={0} step="10" className="input" value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
          </>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Record it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BookReinspection({
  inspection,
  onClose,
  onDone,
}: {
  inspection: Inspection;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState("");
  const [fee, setFee] = useState("");

  return (
    <Modal open title="Book a re-inspection" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Re-inspection booked", () =>
            api.scheduleReinspection(inspection.id, {
              scheduled_date: when,
              fee: fee || undefined,
            }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The new booking points back at this one, so &ldquo;how many times did this fail before it
          passed&rdquo; can be asked — which is what tells you whose work is costing you
          re-inspection fees.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
          <Field label="Fee">
            <input type="number" min={0} step="10" className="input" value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Booking…" : "Book it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewLog({
  jobs,
  defaultJob,
  onClose,
  onDone,
}: {
  jobs: { id: string; job_number: string }[];
  defaultJob: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [jobId, setJobId] = useState(defaultJob);
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState("");
  const [crew, setCrew] = useState("");
  const [trades, setTrades] = useState("");
  const [work, setWork] = useState("");
  const [delays, setDelays] = useState("");

  return (
    <Modal open title="Daily log" onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Log filed", () =>
            api.createDailyLog({
              job_id: jobId,
              log_date: when,
              weather: weather || undefined,
              crew_count: crew ? Number(crew) : undefined,
              trades_on_site: trades || undefined,
              work_performed: work || undefined,
              delays: delays || undefined,
            }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The record that makes a delay defensible later. Weather and crew counts are what
          substantiate a claim against a trade.
        </p>
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
          <Field label="Day" hint="Filing again for a day adds to that entry.">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Weather">
            <input className="input" value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Rain, 14C" />
          </Field>
          <Field label="Crew on site">
            <input type="number" min={0} className="input" value={crew} onChange={(e) => setCrew(e.target.value)} />
          </Field>
        </div>
        <Field label="Trades on site">
          <input className="input" value={trades} onChange={(e) => setTrades(e.target.value)} />
        </Field>
        <Field label="What happened">
          <textarea className="input" rows={3} value={work} onChange={(e) => setWork(e.target.value)} />
        </Field>
        <Field label="Delays" hint="What stopped work, and why.">
          <input className="input" value={delays} onChange={(e) => setDelays(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Filing…" : "File it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
