"use client";

/**
 * Safety and quality.
 *
 * The screen is arranged around the one number here with a legal consequence:
 * **reportable incidents the HSE has not been told about**. Everything else on
 * this page is a fix somebody owes; that one is an obligation with a statutory
 * deadline attached, and it is the only item where being late is a different kind
 * of problem from being behind.
 *
 * Two things changed from the old screen. An observation no longer closes because
 * somebody set its status to closed - the fix is claimed, then somebody else
 * accepts or rejects it. And the subtitle's promise that a failed inspection
 * raises one automatically is now true of the code rather than only of the
 * sentence.
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
import type {
  ActionPlan,
  Incident,
  IncidentType,
  Observation,
  ObservationType,
  RiddorCategory,
  Severity,
} from "@/types/api";

type Tab = "observations" | "incidents" | "plans";

const SEVERITIES: { value: Severity; label: string; hint: string }[] = [
  { value: "critical", label: "Critical", hint: "Due tomorrow. Somebody could be hurt today." },
  { value: "high", label: "High", hint: "Due in three days." },
  { value: "medium", label: "Medium", hint: "Due in a week." },
  { value: "low", label: "Low", hint: "Due in a fortnight." },
];

const OBSERVATION_TYPES: ObservationType[] = [
  "safety",
  "quality",
  "commissioning",
  "work_to_complete",
];

const INCIDENT_TYPES: IncidentType[] = [
  "injury",
  "near_miss",
  "property_damage",
  "illness",
  "environmental",
];

/** What each RIDDOR category means and how long you have. */
const RIDDOR: Record<RiddorCategory, { label: string; hint: string }> = {
  not_reportable: {
    label: "Not reportable",
    hint: "No RIDDOR duty. Still worth recording — near misses are the cheapest data about what is about to go wrong.",
  },
  fatality: {
    label: "Fatality",
    hint: "Notify the HSE without delay, written report within 10 days.",
  },
  specified_injury: {
    label: "Specified injury",
    hint: "Fracture, amputation, sight loss, crush, serious burn and the rest of the list. Without delay, then 10 days.",
  },
  over_7_day: {
    label: "Over-seven-day incapacity",
    hint: "15 days, because the seven have to elapse before anybody knows it qualifies.",
  },
  occupational_disease: {
    label: "Occupational disease",
    hint: "Diagnosed in writing by a doctor. 10 days.",
  },
  dangerous_occurrence: {
    label: "Dangerous occurrence",
    hint: "Scaffold collapse, lifting failure, and the rest of the schedule. Without delay, then 10 days.",
  },
};

function severityTone(s: Severity) {
  return s === "critical" ? "danger" : s === "high" ? "warn" : "neutral";
}

export default function SafetyPage() {
  const [tab, setTab] = useState<Tab>("observations");
  const [jobFilter, setJobFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(true);
  /** Narrow the incident tab to the ones with a deadline running. */
  const [riddorOnly, setRiddorOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "newObservation" }
    | { kind: "assign"; obs: Observation }
    | { kind: "edit"; obs: Observation }
    | { kind: "submit"; obs: Observation }
    | { kind: "reason"; obs: Observation; mode: "reject" | "reopen" }
    | { kind: "newIncident" }
    | { kind: "classify"; incident: Incident }
    | { kind: "hseReport"; incident: Incident }
    | { kind: "rootCause"; incident: Incident }
    | { kind: "newPlan" }
    | { kind: "planSteps"; plan: ActionPlan }
    | { kind: "startPlan"; template: ActionPlan }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const scope = jobFilter || undefined;
  const summary = useAsync(() => api.safetySummary(scope), [jobFilter]);
  const observations = useAsync(
    () => api.listObservations({ job_id: scope, size: 100 }),
    [jobFilter],
  );
  const incidents = useAsync(() => api.listIncidents({ job_id: scope, size: 100 }), [jobFilter]);
  const plans = useAsync(() => api.listActionPlans({ job_id: scope, size: 100 }), [jobFilter]);
  const templates = useAsync(() => api.listActionPlans({ templates: true, size: 100 }), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  /**
   * Asked of the server rather than filtered out of the rows on screen. Both
   * lists are paged, so deriving either here would quietly under-report as soon
   * as a home had more than a page - and these are the two numbers on this screen
   * somebody acts on.
   */
  const owedHere = useAsync(
    () => (jobFilter ? api.openObservations(jobFilter) : Promise.resolve([])),
    [jobFilter],
  );
  const awaitingReport = useAsync(() => api.incidentsAwaitingReport(), []);

  const job = byId(jobs.data);
  const vendor = byId(vendors.data);

  const refresh = useCallback(() => {
    summary.reload();
    observations.reload();
    incidents.reload();
    plans.reload();
    templates.reload();
    owedHere.reload();
    awaitingReport.reload();
  }, [summary, observations, incidents, plans, templates, owedHere, awaitingReport]);

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
  const obsRows = (observations.data?.items ?? []).filter((o) => !openOnly || o.is_open);
  const incidentRows = (incidents.data?.items ?? []).filter(
    (i) => !riddorOnly || (i.reportable && !i.reported_to_hse_on),
  );
  const planRows = plans.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Safety & quality"
        subtitle="Observations are owed fixes with a due date, not notes. A failed inspection raises one automatically, so the inspection record shows what was done about the problem."
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
            <button className="btn btn-ghost" onClick={() => setDialog({ kind: "newIncident" })}>
              Report an incident
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setDialog({ kind: "newObservation" })}
            >
              Raise an observation
            </button>
          </>
        }
      />

      {s && (
        <div className="metric-strip mb-5">
          {/* First, because it is the only number on this page with a statutory
              deadline behind it. Everything else is a fix somebody owes. */}
          <div className="metric">
            <span className="metric-label">Awaiting HSE report</span>
            <span
              className="metric-value"
              style={
                s.hse_report_overdue > 0
                  ? { color: "var(--danger)" }
                  : s.awaiting_hse_report > 0
                    ? { color: "var(--warn)" }
                    : { color: "var(--ok)" }
              }
            >
              {s.awaiting_hse_report}
            </span>
            <span className="metric-hint">
              {s.hse_report_overdue > 0 ? `${s.hse_report_overdue} past the deadline` : "RIDDOR"}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Open observations</span>
            <span className="metric-value">{s.open_observations}</span>
            <span className="metric-hint">{s.awaiting_review} awaiting review</span>
          </div>
          <div className="metric">
            <span className="metric-label">Overdue</span>
            <span
              className="metric-value"
              style={s.overdue > 0 ? { color: "var(--danger)" } : undefined}
            >
              {s.overdue}
            </span>
            <span className="metric-hint">Past the date given</span>
          </div>
          <div className="metric">
            <span className="metric-label">Critical</span>
            <span
              className="metric-value"
              style={s.critical > 0 ? { color: "var(--danger)" } : undefined}
            >
              {s.critical}
            </span>
            <span className="metric-hint">Due the next day</span>
          </div>
          <div className="metric">
            <span className="metric-label">From inspections</span>
            <span className="metric-value">{s.from_inspections}</span>
            <span className="metric-hint">Raised by a failure</span>
          </div>
          <div className="metric">
            <span className="metric-label">Incidents</span>
            <span className="metric-value">{s.incidents}</span>
            <span className="metric-hint">
              {s.near_misses} near miss{s.near_misses === 1 ? "" : "es"}
              {s.lost_time > 0 ? `, ${s.lost_time} lost time` : ""}
            </span>
          </div>
        </div>
      )}

      {s && s.hse_report_overdue > 0 && (
        <div
          className="mb-4 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <strong>
            {s.hse_report_overdue} incident{s.hse_report_overdue === 1 ? " is" : "s are"} past the
            RIDDOR deadline.
          </strong>{" "}
          The duty to report does not lapse because the date did. Report it, then record the
          reference here —{" "}
          <button
            className="underline"
            onClick={() => {
              setTab("incidents");
              setRiddorOnly(true);
            }}
            style={{ color: "inherit" }}
          >
            show them
          </button>
          .
          {(awaitingReport.data ?? []).filter((i) => i.report_overdue).length > 0 && (
            <ul className="mt-1.5 list-disc pl-5">
              {(awaitingReport.data ?? [])
                .filter((i) => i.report_overdue)
                .slice(0, 3)
                .map((i) => (
                  <li key={i.id}>
                    {i.title} — {Math.abs(i.days_to_report ?? 0)} days past the{" "}
                    {RIDDOR[i.riddor_category].label.toLowerCase()} deadline
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {jobFilter && (owedHere.data?.length ?? 0) > 0 && (
        <div
          className="mb-4 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <strong>
            {job.get(jobFilter)?.job_number} has {owedHere.data?.length} observation
            {owedHere.data?.length === 1 ? "" : "s"} still owed.
          </strong>{" "}
          Counting the ones sent for review — a claimed fix nobody has looked at is not a closed
          one.
          {(owedHere.data ?? []).filter((o) => o.is_overdue).length > 0 && (
            <>
              {" "}
              {(owedHere.data ?? []).filter((o) => o.is_overdue).length} past the date given.
            </>
          )}
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
              ["observations", "Observations", s?.open_observations ?? 0],
              ["incidents", "Incidents", s?.incidents ?? 0],
              ["plans", "Action plans", s?.plans_in_progress ?? 0],
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

        {tab === "observations" && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            Open only
          </label>
        )}
        {tab === "incidents" && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={riddorOnly}
              onChange={(e) => setRiddorOnly(e.target.checked)}
            />
            Awaiting an HSE report
          </label>
        )}
        {tab === "plans" && (
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setDialog({ kind: "newPlan" })}>
            New plan or template
          </button>
        )}
      </div>

      {observations.error && <ErrorNote message={observations.error} />}

      {/* ------------------------------------------------- observations */}
      {tab === "observations" && (
        <Card padded={false}>
          {observations.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "observation", label: "Observation" },
                { key: "home", label: "Home" },
                { key: "owed", label: "Owed by" },
                { key: "due", label: "Due", align: "right" },
                { key: "status", label: "Status" },
                { key: "actions", label: "", align: "right" },
              ]}
              empty={openOnly ? "Nothing outstanding." : "No observations."}
            >
              {obsRows.map((o) => (
                <tr
                  key={o.id}
                  style={
                    o.is_overdue
                      ? { boxShadow: "inset 3px 0 0 0 var(--danger)" }
                      : o.severity === "critical" && o.is_open
                        ? { boxShadow: "inset 3px 0 0 0 var(--warn)" }
                        : !o.is_open
                          ? { opacity: 0.6 }
                          : undefined
                  }
                >
                  <td>
                    <span className="font-medium">{o.title}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone={severityTone(o.severity)}>{titleCase(o.severity)}</Badge>
                      <Badge tone="neutral">{titleCase(o.observation_type)}</Badge>
                      {o.inspection_id && <Badge tone="brand">From a failed inspection</Badge>}
                      {o.location && (
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {o.location}
                        </span>
                      )}
                    </div>
                    {o.resolution && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                        {o.resolution}
                      </div>
                    )}
                  </td>
                  <td className="text-sm">
                    <Link
                      href={`/jobs/${o.job_id}`}
                      className="font-medium"
                      style={{ color: "var(--brand)" }}
                    >
                      {job.get(o.job_id)?.job_number ?? "—"}
                    </Link>
                  </td>
                  <td className="text-sm">
                    {o.assigned_vendor_id ? (
                      (vendor.get(o.assigned_vendor_id)?.name ?? "—")
                    ) : (
                      <span style={{ color: "var(--fg-subtle)" }}>Unassigned</span>
                    )}
                  </td>
                  <td className="num text-sm">
                    {o.due_on ? day(o.due_on) : "—"}
                    {o.days_overdue !== null && (
                      <div className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
                        {o.days_overdue}d over
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                    {o.closed_on && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {day(o.closed_on)}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <ObservationActions
                      obs={o}
                      busy={busy === o.id}
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

      {/* ---------------------------------------------------- incidents */}
      {tab === "incidents" && (
        <Card padded={false}>
          {incidents.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "incident", label: "Incident" },
                { key: "home", label: "Home" },
                { key: "when", label: "When", align: "right" },
                { key: "riddor", label: "RIDDOR" },
                { key: "hse", label: "HSE report" },
                { key: "actions", label: "", align: "right" },
              ]}
              empty={
                riddorOnly
                  ? "Nothing is waiting on an HSE report."
                  : "No incidents recorded. That is worth checking rather than celebrating — near misses are the cheapest data there is."
              }
            >
              {incidentRows.map((i) => (
                <tr
                  key={i.id}
                  style={
                    i.report_overdue
                      ? { boxShadow: "inset 3px 0 0 0 var(--danger)" }
                      : !i.is_open
                        ? { opacity: 0.6 }
                        : undefined
                  }
                >
                  <td>
                    <span className="font-medium">{i.title}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone={severityTone(i.severity)}>{titleCase(i.severity)}</Badge>
                      <Badge tone="neutral">{titleCase(i.incident_type)}</Badge>
                      {i.lost_time && <Badge tone="warn">Lost time</Badge>}
                      {i.person_involved && (
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {i.person_involved}
                        </span>
                      )}
                    </div>
                    {i.root_cause ? (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                        Cause: {i.root_cause}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        No root cause recorded
                      </div>
                    )}
                  </td>
                  <td className="text-sm">{job.get(i.job_id)?.job_number ?? "—"}</td>
                  <td className="num text-sm">{day(i.occurred_on)}</td>
                  <td className="text-sm">
                    <Badge tone={i.reportable ? "danger" : "neutral"}>
                      {RIDDOR[i.riddor_category].label}
                    </Badge>
                    {i.report_without_delay && !i.reported_to_hse_on && (
                      <div className="mt-0.5 text-xs font-semibold" style={{ color: "var(--danger)" }}>
                        Telephone first
                      </div>
                    )}
                  </td>
                  <td className="text-sm">
                    {i.reported_to_hse_on ? (
                      <>
                        <span style={{ color: "var(--ok)" }}>{day(i.reported_to_hse_on)}</span>
                        {i.hse_reference && (
                          <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                            {i.hse_reference}
                          </div>
                        )}
                      </>
                    ) : i.riddor_deadline ? (
                      <>
                        <span
                          className="font-semibold"
                          style={{ color: i.report_overdue ? "var(--danger)" : "var(--warn)" }}
                        >
                          {i.report_overdue
                            ? `${Math.abs(i.days_to_report ?? 0)}d late`
                            : `${i.days_to_report}d left`}
                        </span>
                        <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          due {day(i.riddor_deadline)}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: "var(--fg-subtle)" }}>Not owed</span>
                    )}
                  </td>
                  <td className="num">
                    <IncidentActions
                      incident={i}
                      busy={busy === i.id}
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

      {/* -------------------------------------------------- action plans */}
      {tab === "plans" && (
        <>
          <div className="mb-4">
          <Card padded={false}>
            {plans.loading ? (
              <Loading />
            ) : (
              <DataTable
                columns={[
                  { key: "plan", label: "Plan" },
                  { key: "home", label: "Home" },
                  { key: "next", label: "Waiting on" },
                  { key: "progress", label: "Progress", align: "right" },
                  { key: "actions", label: "", align: "right" },
                ]}
                empty="No plans running. Start one from a template below."
              >
                {planRows.map((p) => (
                  <tr
                    key={p.id}
                    style={p.is_overdue ? { boxShadow: "inset 3px 0 0 0 var(--danger)" } : undefined}
                  >
                    <td>
                      <span className="font-medium">{p.name}</span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <StatusBadge status={p.status} />
                        {p.started_on && (
                          <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                            started {day(p.started_on)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm">{p.job_id ? (job.get(p.job_id)?.job_number ?? "—") : "—"}</td>
                    <td className="text-sm">
                      {p.next_item ? (
                        <>
                          <span style={{ color: "var(--fg-muted)" }}>{p.next_item.sequence}.</span>{" "}
                          {p.next_item.description}
                        </>
                      ) : p.items.some((i) => i.awaiting_signoff) ? (
                        <span style={{ color: "var(--warn)" }}>
                          A witness for{" "}
                          {p.items.filter((i) => i.awaiting_signoff).length} step
                          {p.items.filter((i) => i.awaiting_signoff).length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--ok)" }}>Nothing</span>
                      )}
                    </td>
                    <td className="num">
                      <div className="flex items-center justify-end gap-2">
                        <div
                          className="h-1.5 w-20 overflow-hidden rounded-full"
                          style={{ background: "var(--neutral-soft)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.percent_complete}%`,
                              background:
                                p.percent_complete === 100 ? "var(--ok)" : "var(--brand)",
                            }}
                          />
                        </div>
                        {/* Finished steps, matching the meter. Showing the
                            claimed count beside a meter that measures finished
                            ones would put two different numbers side by side. */}
                        <span className="tnum text-sm">
                          {p.done_items}/{p.items.length}
                        </span>
                      </div>
                    </td>
                    <td className="num">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDialog({ kind: "planSteps", plan: p })}
                      >
                        Steps
                      </button>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
          </div>

          <Card>
            <h3 className="mb-1 text-sm font-semibold">Templates</h3>
            <p className="mb-3 text-xs" style={{ color: "var(--fg-muted)" }}>
              The sequences run the same way on every home. Starting one copies its steps onto a
              home — copied, not referenced, so editing a template next month never rewrites the
              checklist somebody signed last month.
            </p>
            {(templates.data?.items ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
                None yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(templates.data?.items ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-[var(--radius)] px-3 py-2"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {t.items.length} step{t.items.length === 1 ? "" : "s"}
                    </p>
                    <div className="mt-1.5 flex gap-1">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDialog({ kind: "planSteps", plan: t })}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setDialog({ kind: "startPlan", template: t })}
                      >
                        Start on a home
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ------------------------------------------------------- dialogs */}
      {dialog?.kind === "newObservation" && (
        <NewObservation
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
      {dialog?.kind === "edit" && (
        <EditObservation
          obs={dialog.obs}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "assign" && (
        <AssignObservation
          obs={dialog.obs}
          vendors={vendors.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "submit" && (
        <SubmitFix
          obs={dialog.obs}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "reason" && (
        <ObservationReason
          obs={dialog.obs}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "newIncident" && (
        <NewIncident
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
      {dialog?.kind === "classify" && (
        <ClassifyIncident
          incident={dialog.incident}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "hseReport" && (
        <RecordHseReport
          incident={dialog.incident}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "rootCause" && (
        <RecordRootCause
          incident={dialog.incident}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "newPlan" && (
        <NewPlan
          jobs={jobs.data ?? []}
          defaultJob={jobFilter}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "planSteps" && (
        <PlanSteps
          plan={dialog.plan}
          vendors={vendors.data ?? []}
          onClose={() => setDialog(null)}
          onChanged={refresh}
        />
      )}
      {dialog?.kind === "startPlan" && (
        <StartPlan
          template={dialog.template}
          jobs={jobs.data ?? []}
          defaultJob={jobFilter}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setTab("plans");
            refresh();
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

/* --------------------------------------------------------------- actions */

type SafetyDialog =
  | { kind: "assign"; obs: Observation }
  | { kind: "edit"; obs: Observation }
  | { kind: "submit"; obs: Observation }
  | { kind: "reason"; obs: Observation; mode: "reject" | "reopen" }
  | { kind: "classify"; incident: Incident }
  | { kind: "hseReport"; incident: Incident }
  | { kind: "rootCause"; incident: Incident };

type ConfirmFn = (opts: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<unknown>;
}) => void;

function ObservationActions({
  obs,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  obs: Observation;
  busy: boolean;
  onDialog: (d: SafetyDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: ConfirmFn;
}) {
  const o = obs;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (o.status !== "closed") {
    items.push({ label: "Edit details…", run: () => onDialog({ kind: "edit", obs: o }) });
  }
  if (o.status === "initiated" || o.status === "not_accepted") {
    items.push({
      label: o.assigned_vendor_id ? "Reassign…" : "Give it to a trade…",
      run: () => onDialog({ kind: "assign", obs: o }),
    });
    items.push({ label: "The fix is made…", run: () => onDialog({ kind: "submit", obs: o }) });
  }
  if (o.status === "ready_for_review") {
    items.push({
      label: "Accept the fix",
      run: () =>
        onConfirm({
          title: `Close "${o.title.slice(0, 40)}"?`,
          body: "Records that you have looked at the fix and accepted it — not that somebody said it was done.",
          confirmLabel: "Close it",
          onConfirm: () => onAct(o.id, "Closed", () => api.closeObservation(o.id)),
        }),
    });
    items.push({
      label: "Not accepted…",
      tone: "danger",
      run: () => onDialog({ kind: "reason", obs: o, mode: "reject" }),
    });
  }
  if (o.status === "closed") {
    items.push({
      label: "Reopen it…",
      run: () => onDialog({ kind: "reason", obs: o, mode: "reopen" }),
    });
  }

  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

function IncidentActions({
  incident,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  incident: Incident;
  busy: boolean;
  onDialog: (d: SafetyDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: ConfirmFn;
}) {
  const i = incident;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (i.is_open) {
    items.push({ label: "Record the cause…", run: () => onDialog({ kind: "rootCause", incident: i }) });
    items.push({ label: "RIDDOR category…", run: () => onDialog({ kind: "classify", incident: i }) });
    if (i.reportable && !i.reported_to_hse_on) {
      items.push({
        label: "Record the HSE report…",
        run: () => onDialog({ kind: "hseReport", incident: i }),
      });
    }
    items.push({
      label: "Close the investigation",
      run: () =>
        onConfirm({
          title: `Close "${i.title.slice(0, 40)}"?`,
          body: "Refused while a reportable incident has not been reported, and refused with no root cause recorded — an investigation that concluded nothing leaves nothing to act on.",
          confirmLabel: "Close it",
          onConfirm: () => onAct(i.id, "Investigation closed", () => api.closeIncident(i.id)),
        }),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        Closed {i.closed_on ? day(i.closed_on) : ""}
      </span>
    );
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

function NewObservation({
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<ObservationType>("safety");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [vendorId, setVendorId] = useState("");
  const [due, setDue] = useState("");

  const chosen = SEVERITIES.find((sv) => sv.value === severity)!;

  return (
    <Modal open title="Raise an observation" onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          run("Raised", () =>
            api.createObservation({
              job_id: jobId,
              title,
              description: description || undefined,
              location: location || undefined,
              observation_type: type,
              severity,
              assigned_vendor_id: vendorId || undefined,
              due_on: due || undefined,
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
          <Field label="Kind">
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as ObservationType)}
            >
              {OBSERVATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What was seen">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Unguarded stair opening, first floor"
          />
        </Field>
        <Field label="Detail">
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Temporary guardrail removed for a delivery and not replaced."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Owed by">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Decide later</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="How bad" hint={chosen.hint}>
          <select
            className="input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITIES.map((sv) => (
              <option key={sv.value} value={sv.value}>
                {sv.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Due"
          hint="Left blank, it is set from the severity. An observation with no date is a note."
        >
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Raising…" : "Raise it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditObservation({
  obs,
  onClose,
  onDone,
}: {
  obs: Observation;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [title, setTitle] = useState(obs.title);
  const [location, setLocation] = useState(obs.location ?? "");
  const [severity, setSeverity] = useState<Severity>(obs.severity);
  const [due, setDue] = useState(obs.due_on ?? "");

  const chosen = SEVERITIES.find((sv) => sv.value === severity)!;

  return (
    <Modal open title="Edit the observation" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Saved", () =>
            api.updateObservation(obs.id, {
              title,
              location: location || null,
              severity,
              due_on: due || null,
            }),
          );
        }}
      >
        <Field label="What was seen">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Due">
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label="How bad" hint={chosen.hint}>
          <select
            className="input"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          >
            {SEVERITIES.map((sv) => (
              <option key={sv.value} value={sv.value}>
                {sv.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Status is not editable here. It moves through the actions on the row, which record who
          accepted the fix.
        </p>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignObservation({
  obs,
  vendors,
  onClose,
  onDone,
}: {
  obs: Observation;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [vendorId, setVendorId] = useState(obs.assigned_vendor_id ?? "");
  const [due, setDue] = useState(obs.due_on ?? "");

  return (
    <Modal open title="Give it to a trade" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Assigned", () =>
            api.assignObservation(obs.id, { vendor_id: vendorId, due_on: due || undefined }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          An observation nobody owns is the one that is still open at handover.
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
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Assign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SubmitFix({
  obs,
  onClose,
  onDone,
}: {
  obs: Observation;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [resolution, setResolution] = useState("");

  return (
    <Modal open title="The fix is made" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Sent for review", () => api.submitObservation(obs.id, resolution));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          A claim, not a conclusion — it goes for review rather than closing. What was done is asked
          here rather than at closing, because the person who did the work is the one who knows;
          asking the reviewer produces &ldquo;fixed&rdquo;.
        </p>
        <Field label="What was done">
          <textarea
            className="input"
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            required
            minLength={3}
            placeholder="Guardrail refitted into the studs and fixings checked along the full run."
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send for review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ObservationReason({
  obs,
  mode,
  onClose,
  onDone,
}: {
  obs: Observation;
  mode: "reject" | "reopen";
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [reason, setReason] = useState("");

  const copy = {
    reject: {
      title: "The fix was not accepted",
      body: "The trade has to know what is still wrong. A rejected fix with no reason reads as somebody being difficult.",
      placeholder: "Rail is fixed to the plasterboard, not the stud.",
      label: "Send it back",
      done: "Sent back",
      call: () => api.rejectObservation(obs.id, reason),
    },
    reopen: {
      title: "Reopen the observation",
      body: "It was closed by somebody who accepted the fix, so the record should say what changed. It goes back to the start — a second round is a full round.",
      placeholder: "Failed again at the next walk.",
      label: "Reopen",
      done: "Reopened",
      call: () => api.reopenObservation(obs.id, reason),
    },
  }[mode];

  return (
    <Modal open title={copy.title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(copy.done, copy.call);
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {copy.body}
        </p>
        <Field label="Reason">
          <textarea
            className="input"
            rows={2}
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
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : copy.label}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewIncident({
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
  const [type, setType] = useState<IncidentType>("injury");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [severity, setSeverity] = useState<Severity>("medium");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [person, setPerson] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [lostTime, setLostTime] = useState(false);
  const [treatment, setTreatment] = useState(false);
  const [action, setAction] = useState("");
  const [override, setOverride] = useState<RiddorCategory | "">("");

  /**
   * What the form is about to decide, shown before it decides it. The operator
   * can and should override this - the regulations turn on facts the system does
   * not hold - so deciding silently would be the wrong shape.
   */
  const suggested = useAsync(
    () =>
      api.riddorSuggestion({
        incident_type: type,
        severity,
        lost_time: lostTime,
        medical_treatment: treatment,
      }),
    [type, severity, lostTime, treatment],
  );
  const category = (override || suggested.data || "not_reportable") as RiddorCategory;

  return (
    <Modal open title="Report an incident" onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          run("Recorded", () =>
            api.createIncident({
              job_id: jobId,
              incident_type: type,
              title,
              occurred_on: when,
              severity,
              description: description || undefined,
              location: location || undefined,
              person_involved: person || undefined,
              vendor_id: vendorId || undefined,
              lost_time: lostTime,
              medical_treatment: treatment,
              immediate_action: action || undefined,
              riddor_category: override || undefined,
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
          <Field label="Kind">
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as IncidentType)}
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="What happened">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Laceration to forearm from a utility knife"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When">
            <input
              type="date"
              className="input"
              value={when}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              required
            />
          </Field>
          <Field label="How bad">
            <select
              className="input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              {SEVERITIES.map((sv) => (
                <option key={sv.value} value={sv.value}>
                  {sv.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Detail">
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Who">
            <input className="input" value={person} onChange={(e) => setPerson(e.target.value)} />
          </Field>
        </div>
        <Field label="Whose trade">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Ours, or not applicable</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={lostTime} onChange={(e) => setLostTime(e.target.checked)} />
            More than seven days off work
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={treatment} onChange={(e) => setTreatment(e.target.checked)} />
            Needed medical treatment
          </label>
        </div>

        <div
          className="rounded-[var(--radius)] p-3"
          style={{
            border: "1px solid var(--border)",
            background: category === "not_reportable" ? undefined : "var(--warn-soft)",
          }}
        >
          <p className="text-sm font-semibold">RIDDOR: {RIDDOR[category].label}</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
            {RIDDOR[category].hint}
          </p>
          <select
            className="input mt-2"
            value={override}
            onChange={(e) => setOverride(e.target.value as RiddorCategory | "")}
          >
            <option value="">Use the suggestion above</option>
            {(Object.keys(RIDDOR) as RiddorCategory[]).map((c) => (
              <option key={c} value={c}>
                {RIDDOR[c].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
            A suggestion, not a determination — the regulations turn on things this system does not
            hold. It exists because the alternative is a tick box, and a tick box defaults to
            unticked.
          </p>
        </div>

        <Field label="What was done straight away">
          <textarea
            className="input"
            rows={2}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="First aid on site, driven to urgent care."
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Recording…" : "Record it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ClassifyIncident({
  incident,
  onClose,
  onDone,
}: {
  incident: Incident;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [category, setCategory] = useState<RiddorCategory>(incident.riddor_category);

  return (
    <Modal open title="RIDDOR category" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Reclassified", () => api.classifyIncident(incident.id, category));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The category sets the deadline, so changing it moves the date the report is due.
        </p>
        <Field label="Category" hint={RIDDOR[category].hint}>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value as RiddorCategory)}
          >
            {(Object.keys(RIDDOR) as RiddorCategory[]).map((c) => (
              <option key={c} value={c}>
                {RIDDOR[c].label}
              </option>
            ))}
          </select>
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordHseReport({
  incident,
  onClose,
  onDone,
}: {
  incident: Incident;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  return (
    <Modal open title="Record the HSE report" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Report recorded", () =>
            api.recordHseReport(incident.id, {
              reported_on: when,
              reference: reference || undefined,
            }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          This records that the report has actually gone in. The category said it was owed; only
          this says anybody did it, and that is the part the HSE asks about.
        </p>
        {incident.report_without_delay && (
          <p
            className="rounded-[var(--radius)] px-3 py-2 text-sm"
            style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            A {RIDDOR[incident.riddor_category].label.toLowerCase()} must also be notified without
            delay, by telephone, before the written report.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reported on">
            <input
              type="date"
              className="input"
              value={when}
              min={incident.occurred_on}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              required
            />
          </Field>
          <Field label="Reference" hint="The number the HSE gives back.">
            <input
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="HSE-2026-00814"
            />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Record it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordRootCause({
  incident,
  onClose,
  onDone,
}: {
  incident: Incident;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [cause, setCause] = useState(incident.root_cause ?? "");

  return (
    <Modal open title="Root cause" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Recorded", () => api.recordRootCause(incident.id, cause));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          What actually caused it, rather than what happened. An incident with no cause recorded
          cannot be prevented, which is the only reason to keep the record.
        </p>
        <Field label="Cause">
          <textarea
            className="input"
            rows={3}
            value={cause}
            onChange={(e) => setCause(e.target.value)}
            required
            minLength={3}
            placeholder="Blade retracted too slowly on the knives in use; replaced across all crews."
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Record it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewPlan({
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isTemplate, setIsTemplate] = useState(true);
  const [jobId, setJobId] = useState(defaultJob);
  const [due, setDue] = useState("");

  return (
    <Modal open title="New action plan" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Created", () =>
            api.createActionPlan({
              name,
              description: description || undefined,
              job_id: isTemplate ? undefined : jobId || undefined,
              due_on: due || undefined,
              is_template: isTemplate,
            }),
          );
        }}
      >
        <Field label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Pre-pour checklist"
          />
        </Field>
        <Field label="What it is for">
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
          A template, to run on many homes
        </label>
        {isTemplate ? (
          <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            A template does not belong to a home. Add its steps, then start it against whichever
            homes need it — the steps are copied each time.
          </p>
        ) : (
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
            <Field label="Due">
              <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StartPlan({
  template,
  jobs,
  defaultJob,
  onClose,
  onDone,
}: {
  template: ActionPlan;
  jobs: { id: string; job_number: string }[];
  defaultJob: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [jobId, setJobId] = useState(defaultJob);
  const [due, setDue] = useState("");

  return (
    <Modal open title={`Start "${template.name}" on a home`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Started", () =>
            api.startActionPlan(template.id, { job_id: jobId, due_on: due || undefined }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Copies all {template.items.length} steps onto the home. Copied, not referenced — editing
          this template next month must not rewrite a checklist somebody signed last month.
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
          <Field label="Due">
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Starting…" : "Start it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlanSteps({
  plan,
  vendors,
  onClose,
  onChanged,
}: {
  plan: ActionPlan;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const detail = useAsync(
    () =>
      api.listActionPlans({
        templates: plan.is_template,
        job_id: plan.job_id ?? undefined,
        size: 100,
      }),
    [plan.id],
  );
  const current = detail.data?.items.find((p) => p.id === plan.id) ?? plan;
  const [adding, setAdding] = useState("");
  const [needsSignoff, setNeedsSignoff] = useState(false);
  const [vendorId, setVendorId] = useState("");

  const editable = current.is_template || current.status !== "complete";
  const waitingOn = current.next_item;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      detail.reload();
      onChanged();
    } catch (err) {
      toast.error("That did not go through", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <Modal open title={`${current.name} — steps`} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {current.is_template
            ? "The pattern. Starting it on a home copies these steps, so a change here only affects homes started afterwards."
            : "These run in order. A pre-pour checklist that lets the pour be signed off before the rebar check is a form, not a checklist."}
        </p>

        {current.items.length === 0 && (
          <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            No steps yet.
          </p>
        )}

        {current.items.map((step) => {
          const isNext = waitingOn?.id === step.id;
          return (
            <div
              key={step.id}
              className="rounded-[var(--radius)] p-3"
              style={{
                border: `1px solid ${isNext ? "var(--brand)" : "var(--border)"}`,
                background: step.is_done ? "var(--ok-soft)" : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span style={{ color: "var(--fg-subtle)" }}>{step.sequence}.</span>{" "}
                    {step.description}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {step.requires_signoff && <Badge tone="brand">Needs a witness</Badge>}
                    {step.completed_on && (
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        done {day(step.completed_on)}
                      </span>
                    )}
                    {step.signed_off_on && (
                      <span className="text-xs" style={{ color: "var(--ok)" }}>
                        witnessed {day(step.signed_off_on)}
                      </span>
                    )}
                  </div>
                  {step.notes && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--fg-muted)" }}>
                      {step.notes}
                    </p>
                  )}
                </div>
                {step.is_done ? (
                  <Badge tone="ok">Done</Badge>
                ) : step.awaiting_signoff ? (
                  <Badge tone="warn">Awaiting a witness</Badge>
                ) : null}
              </div>

              {!current.is_template && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {!step.completed_on && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!isNext}
                      title={isNext ? undefined : "Earlier steps come first."}
                      onClick={() =>
                        run("Step done", () => api.completeActionPlanItem(current.id, step.id))
                      }
                    >
                      Mark done
                    </button>
                  )}
                  {step.awaiting_signoff && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        run("Witnessed", () => api.signOffActionPlanItem(current.id, step.id))
                      }
                    >
                      Witness it
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {editable ? (
          <form
            className="flex flex-wrap items-end gap-2 border-t pt-3"
            style={{ borderColor: "var(--border)" }}
            onSubmit={async (e) => {
              e.preventDefault();
              await run("Step added", () =>
                api.addActionPlanItem(current.id, {
                  description: adding,
                  requires_signoff: needsSignoff,
                  vendor_id: vendorId || undefined,
                }),
              );
              setAdding("");
              setNeedsSignoff(false);
            }}
          >
            <input
              className="input min-w-[12rem] flex-1"
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Add a step"
              required
            />
            <select className="input w-auto" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Whose step</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={needsSignoff}
                onChange={(e) => setNeedsSignoff(e.target.checked)}
              />
              Witness
            </label>
            <button className="btn btn-primary btn-sm">Add</button>
          </form>
        ) : (
          <p
            className="border-t pt-3 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--fg-subtle)" }}
          >
            The plan is complete, so its steps are fixed.
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
