"use client";

/**
 * The design studio.
 *
 * What happens in this room is a buyer spending an allowance against a deadline,
 * and the old screen showed neither. It listed appointments and signature
 * requests side by side as if they were two equal halves, when actually one
 * produces the other.
 *
 * So the page is built around the three questions a design consultant has:
 *
 *  1. **who is about to run out of time.** After the structural cutoff, "we can
 *     price that" becomes "no". That deadline is the thing the whole conversation
 *     is scheduled around, and it was a line of small text on a row.
 *  2. **what has this buyer got left to spend.** Picking an appointment shows the
 *     allowance, what is committed, what is only chosen, and how far over they
 *     are. That number did not exist before today.
 *  3. **what is sitting unsigned.** An addendum nobody signed is a frame nobody
 *     can start.
 */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Card,
  DataTable,
  day,
  ErrorNote,
  Field,
  Loading,
  LOCALE,
  Menu,
  Modal,
  money,
  PageHeader,
  StatusBadge,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { AllowanceSummary, DesignAppointment, Job, SignatureRequest } from "@/types/api";

const PAGE_SIZE = 25;

/** A date-time in the shape an `<input type="datetime-local">` wants. */
function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function whenLabel(iso: string | null) {
  if (!iso) return "Not set";
  const d = new Date(iso);
  return d.toLocaleString(LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DesignStudioPage() {
  const [tab, setTab] = useState<"appointments" | "signatures">("appointments");
  const [apptStatus, setApptStatus] = useState("");
  const [sigStatus, setSigStatus] = useState("");
  const [selected, setSelected] = useState<DesignAppointment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [dialog, setDialog] = useState<
    | { kind: "book" }
    | { kind: "request" }
    | { kind: "reschedule"; appointment: DesignAppointment }
    | { kind: "cutoff"; appointment: DesignAppointment }
    | { kind: "outcome"; appointment: DesignAppointment; ending: "complete" | "no-show" | "cancel" }
    | { kind: "decline"; request: SignatureRequest }
    | { kind: "void"; request: SignatureRequest }
    | { kind: "allowance"; jobId: string; current: string }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const summary = useAsync(() => api.studioSummary(), []);
  const appointments = useAsync(
    () => api.listAppointments({ status: apptStatus || undefined, size: PAGE_SIZE }),
    [apptStatus],
  );
  const signatures = useAsync(
    () => api.listSignatures({ status: sigStatus || undefined, size: PAGE_SIZE }),
    [sigStatus],
  );
  const jobs = useAsync(() => api.jobOptions(), []);
  const staff = useAsync(() => api.listUsers().then((p) => p.items), []);

  const job = byId(jobs.data as Job[] | null);
  const people = byId(staff.data);

  // Only loaded for the appointment being looked at: the allowance is one query
  // per home, and firing it for every row would be twenty-five to show one.
  const allowance = useAsync(
    () => (selected ? api.getAllowance(selected.job_id) : Promise.resolve(null)),
    [selected?.job_id],
  );

  const refresh = useCallback(() => {
    summary.reload();
    appointments.reload();
    signatures.reload();
    allowance.reload();
  }, [summary, appointments, signatures, allowance]);

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

  const apptRows = appointments.data?.items ?? [];
  const sigRows = signatures.data?.items ?? [];

  /* Appointments whose cutoff is close enough to matter. This is the list the
     studio works from, so it goes first rather than being something you filter
     your way to. */
  const urgent = useMemo(
    () =>
      apptRows
        .filter((a) => a.is_open && a.days_to_cutoff !== null && a.days_to_cutoff <= 30)
        .sort((a, b) => (a.days_to_cutoff ?? 0) - (b.days_to_cutoff ?? 0)),
    [apptRows],
  );

  return (
    <>
      <PageHeader
        title="Design studio"
        subtitle="Where the buyer spends their options allowance, against a cutoff that is enforced rather than advisory."
        action={
          <>
            <button className="btn btn-ghost" onClick={() => setDialog({ kind: "request" })}>
              Request a signature
            </button>
            <button className="btn btn-primary" onClick={() => setDialog({ kind: "book" })}>
              Book an appointment
            </button>
          </>
        }
      />

      {/* One strip rather than four cards. The numbers are small and the work is
          below them, so the furniture should be too. */}
      {summary.data && (
        <div className="metric-strip mb-5">
          <div className="metric">
            <span className="metric-label">Booked</span>
            <span className="metric-value">{summary.data.scheduled}</span>
            <span className="metric-hint">Sessions in the diary</span>
          </div>
          <div className="metric">
            <span className="metric-label">Cutoff in 30 days</span>
            <span
              className="metric-value"
              style={summary.data.cutoff_soon > 0 ? { color: "var(--warn)" } : undefined}
            >
              {summary.data.cutoff_soon}
            </span>
            <span className="metric-hint">Structural choices closing</span>
          </div>
          <div className="metric">
            <span className="metric-label">Awaiting signature</span>
            <span
              className="metric-value"
              style={summary.data.awaiting_signature > 0 ? { color: "var(--warn)" } : undefined}
            >
              {summary.data.awaiting_signature}
            </span>
            <span className="metric-hint">Agreed, not committed</span>
          </div>
          <div className="metric">
            <span className="metric-label">Signed</span>
            <span className="metric-value">{summary.data.signed}</span>
            <span className="metric-hint">Addendums on file</span>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {/* Segmented control and the status filter on one line, so the list
              starts immediately below rather than after two more rows. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-[var(--radius)] p-0.5"
              style={{ background: "var(--neutral-soft)" }}
              role="tablist"
            >
              {(["appointments", "signatures"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className="btn btn-sm"
                  onClick={() => setTab(t)}
                  style={
                    tab === t
                      ? { background: "var(--surface)", boxShadow: "var(--shadow-sm)", fontWeight: 600 }
                      : { background: "transparent", color: "var(--fg-muted)" }
                  }
                >
                  {titleCase(t)}
                  <span className="tnum ml-1.5 opacity-60">
                    {t === "appointments"
                      ? (appointments.data?.total ?? 0)
                      : (signatures.data?.total ?? 0)}
                  </span>
                </button>
              ))}
            </div>

            {urgent.length > 0 && tab === "appointments" && (
              <span
                className="pill"
                style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                title="Homes whose structural cutoff is within 30 days"
              >
                {urgent.length} closing soon
              </span>
            )}

            <select
              className="input ml-auto w-auto max-w-[11rem]"
              value={tab === "appointments" ? apptStatus : sigStatus}
              onChange={(e) =>
                tab === "appointments" ? setApptStatus(e.target.value) : setSigStatus(e.target.value)
              }
            >
              <option value="">Any status</option>
              {(tab === "appointments"
                ? ["scheduled", "complete", "no_show", "cancelled"]
                : ["draft", "sent", "viewed", "signed", "declined", "expired"]
              ).map((st) => (
                <option key={st} value={st}>
                  {titleCase(st)}
                </option>
              ))}
            </select>
          </div>

          {tab === "appointments" ? (
            <Card padded={false}>
              {appointments.loading ? (
                <Loading />
              ) : (
                <DataTable
                  columns={[
                    { key: "home", label: "Home" },
                    { key: "when", label: "When" },
                    { key: "cutoff", label: "Structural cutoff" },
                    { key: "status", label: "Status" },
                    { key: "actions", label: "", align: "right" },
                  ]}
                  empty="No appointments booked."
                >
                  {apptRows.map((a) => {
                    const closing =
                      a.is_open && a.days_to_cutoff !== null && a.days_to_cutoff <= 30;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => setSelected(a)}
                        style={{
                          cursor: "pointer",
                          // Urgency lives on the row it belongs to, rather than
                          // in a second card repeating the same homes.
                          ...(closing
                            ? {
                                boxShadow: `inset 3px 0 0 0 ${
                                  (a.days_to_cutoff ?? 99) <= 7 ? "var(--danger)" : "var(--warn)"
                                }`,
                              }
                            : {}),
                          ...(selected?.id === a.id ? { background: "var(--brand-soft)" } : {}),
                          ...(a.status === "cancelled" || a.status === "no_show"
                            ? { opacity: 0.55 }
                            : {}),
                        }}
                      >
                        <td>
                          <Link
                            href={`/jobs/${a.job_id}`}
                            className="font-medium"
                            style={{ color: "var(--brand)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {job.get(a.job_id)?.job_number ?? "—"}
                          </Link>
                          {a.consultant_id && (
                            <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                              {people.get(a.consultant_id)?.full_name ?? ""}
                            </div>
                          )}
                        </td>
                        <td className="text-sm">
                          {whenLabel(a.scheduled_for)}
                          <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                            {a.duration_minutes} min{a.location ? ` · ${a.location}` : ""}
                          </div>
                        </td>
                        <td className="text-sm">
                          {a.structural_cutoff ? (
                            <>
                              {day(a.structural_cutoff)}
                              {a.days_to_cutoff !== null && (
                                <div className="mt-0.5">
                                  {a.structural_cutoff_passed ? (
                                    <span
                                      className="pill"
                                      style={{
                                        background: "var(--danger-soft)",
                                        color: "var(--danger)",
                                      }}
                                    >
                                      closed
                                    </span>
                                  ) : (
                                    <span
                                      className="pill"
                                      style={
                                        closing
                                          ? {
                                              background: "var(--warn-soft)",
                                              color: "var(--warn)",
                                            }
                                          : {
                                              background: "var(--neutral-soft)",
                                              color: "var(--fg-muted)",
                                            }
                                      }
                                    >
                                      {a.days_to_cutoff} days left
                                    </span>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDialog({ kind: "cutoff", appointment: a });
                              }}
                            >
                              Set a cutoff
                            </button>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={a.status} />
                          {a.rescheduled_from_id && (
                            <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                              rebooked
                            </div>
                          )}
                        </td>
                        <td className="num" onClick={(e) => e.stopPropagation()}>
                          <AppointmentActions
                            appointment={a}
                            busy={busy === a.id}
                            onDialog={setDialog}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}
            </Card>
          ) : (
            <Card padded={false}>
              {signatures.loading ? (
                <Loading />
              ) : (
                <DataTable
                  columns={[
                    { key: "doc", label: "Document" },
                    { key: "signer", label: "Signer" },
                    { key: "status", label: "Status" },
                    { key: "actions", label: "", align: "right" },
                  ]}
                  empty="Nothing out for signature."
                >
                  {sigRows.map((r) => (
                    <tr
                      key={r.id}
                      style={
                        r.is_expired ? { boxShadow: "inset 3px 0 0 0 var(--danger)" } : undefined
                      }
                    >
                      <td>
                        <span className="font-medium">{r.document_name}</span>
                        <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {titleCase(r.document_kind)} ·{" "}
                          <Link href={`/jobs/${r.job_id}`} style={{ color: "var(--brand)" }}>
                            {job.get(r.job_id)?.job_number ?? "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="text-sm">
                        {r.signer_name}
                        <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {r.signer_email}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                        {r.is_outstanding && r.days_outstanding !== null && (
                          <div
                            className="mt-0.5 text-xs"
                            style={{
                              color: r.days_outstanding > 7 ? "var(--warn)" : "var(--fg-subtle)",
                            }}
                          >
                            {r.days_outstanding}d out
                            {r.reminders_sent > 0 && ` · chased ${r.reminders_sent}×`}
                          </div>
                        )}
                        {r.decline_reason && (
                          <div className="mt-0.5 text-xs" style={{ color: "var(--danger)" }}>
                            {r.decline_reason}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        <SignatureActions
                          request={r}
                          busy={busy === r.id}
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

          <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
            Signature records track what happened. Connecting a provider such as DocuSign is what
            makes a signature legally binding; marking one signed here asserts that it was.
          </p>
        </div>

        {/* The allowance. The distinctive thing on this screen and the answer to
            the question actually being asked in the room, so it gets a rail of its
            own and follows you down the list. */}
        <aside className="rail-sticky">
          <Card title="Options allowance">
            {!selected ? (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  Pick an appointment to see what that buyer has left to spend.
                </p>
                {urgent.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm w-full"
                    onClick={() => setSelected(urgent[0])}
                  >
                    Open the one closing soonest
                  </button>
                )}
              </div>
            ) : allowance.loading ? (
              <Loading variant="text" />
            ) : !allowance.data ? (
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                Nothing to show.
              </p>
            ) : (
              <AllowancePanel
                summary={allowance.data}
                jobNumber={job.get(selected.job_id)?.job_number ?? ""}
                cutoffDays={selected.days_to_cutoff}
                cutoffPassed={selected.structural_cutoff_passed}
                onEdit={() =>
                  setDialog({
                    kind: "allowance",
                    jobId: selected.job_id,
                    current: allowance.data!.allowance,
                  })
                }
              />
            )}
          </Card>
        </aside>
      </div>

      {dialog?.kind === "book" && (
        <BookAppointment
          jobs={(jobs.data as Job[]) ?? []}
          staff={staff.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "request" && (
        <RequestSignature
          jobs={(jobs.data as Job[]) ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "reschedule" && (
        <Reschedule
          appointment={dialog.appointment}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "cutoff" && (
        <SetCutoff
          appointment={dialog.appointment}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "outcome" && (
        <RecordOutcome
          appointment={dialog.appointment}
          ending={dialog.ending}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "decline" && (
        <DeclineOrVoid
          request={dialog.request}
          mode="decline"
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "void" && (
        <DeclineOrVoid
          request={dialog.request}
          mode="void"
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "allowance" && (
        <EditAllowance
          jobId={dialog.jobId}
          current={dialog.current}
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

/* ---------------------------------------------------------- the allowance */

function AllowancePanel({
  summary,
  jobNumber,
  cutoffDays,
  cutoffPassed,
  onEdit,
}: {
  summary: AllowanceSummary;
  jobNumber: string;
  cutoffDays: number | null;
  cutoffPassed: boolean;
  onEdit: () => void;
}) {
  const allowance = Number(summary.allowance);
  const spent = Number(summary.spent);
  // Capped at 100 so an overspend does not draw a bar off the card; the number
  // beneath says how far over, which is the part that matters.
  const pct = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : spent > 0 ? 100 : 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          {jobNumber}
        </p>
        <p className="tnum text-2xl font-semibold">
          {summary.is_over ? (
            <span style={{ color: "var(--danger)" }}>{money(summary.over_by)} over</span>
          ) : (
            <span>{money(summary.remaining)} left</span>
          )}
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--neutral-soft)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: summary.is_over ? "var(--danger)" : "var(--brand)",
          }}
        />
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="Allowance" value={money(summary.allowance)} />
        <Row label="Confirmed" value={money(summary.confirmed)} hint="On a signed addendum" />
        <Row label="Chosen, not signed" value={money(summary.pending)} />
        <Row label="Spent" value={money(summary.spent)} strong />
      </dl>

      {!summary.has_contract && (
        <p className="text-xs" style={{ color: "var(--warn)" }}>
          This home has no contract yet, so there is nowhere for an allowance to sit.
        </p>
      )}
      {summary.is_over && (
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Going over is normal — it is how options make margin. The overage goes on the contract as
          an extra.
        </p>
      )}

      {/* Both questions a consultant has about this buyer, in one place: how
          much is left, and how long they have to spend it. */}
      {cutoffDays !== null && (
        <div
          className="rounded-[var(--radius)] px-3 py-2 text-xs"
          style={
            cutoffPassed
              ? { background: "var(--danger-soft)", color: "var(--danger)" }
              : cutoffDays <= 30
                ? { background: "var(--warn-soft)", color: "var(--warn)" }
                : { background: "var(--neutral-soft)", color: "var(--fg-muted)" }
          }
        >
          {cutoffPassed
            ? "Structural cutoff has passed — those choices now need a change order."
            : `${cutoffDays} days left for structural choices.`}
        </div>
      )}

      <button className="btn btn-ghost btn-sm w-full" onClick={onEdit}>
        Change the allowance
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: "var(--fg-muted)" }}>
        {label}
        {hint && (
          <span className="block text-xs" style={{ color: "var(--fg-subtle)" }}>
            {hint}
          </span>
        )}
      </dt>
      <dd className={`tnum ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- actions */

type StudioDialog =
  | { kind: "reschedule"; appointment: DesignAppointment }
  | { kind: "cutoff"; appointment: DesignAppointment }
  | { kind: "outcome"; appointment: DesignAppointment; ending: "complete" | "no-show" | "cancel" }
  | { kind: "decline"; request: SignatureRequest }
  | { kind: "void"; request: SignatureRequest };

function AppointmentActions({
  appointment,
  busy,
  onDialog,
}: {
  appointment: DesignAppointment;
  busy: boolean;
  onDialog: (d: StudioDialog) => void;
}) {
  const a = appointment;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (a.is_open) {
    items.push({
      label: "Mark it happened",
      run: () => onDialog({ kind: "outcome", appointment: a, ending: "complete" }),
    });
    items.push({
      label: "Reschedule…",
      run: () => onDialog({ kind: "reschedule", appointment: a }),
    });
    items.push({
      label: a.structural_cutoff ? "Change the cutoff…" : "Set the cutoff…",
      run: () => onDialog({ kind: "cutoff", appointment: a }),
    });
    items.push({
      label: "Nobody came…",
      tone: "danger",
      run: () => onDialog({ kind: "outcome", appointment: a, ending: "no-show" }),
    });
    items.push({
      label: "Cancel it…",
      tone: "danger",
      run: () => onDialog({ kind: "outcome", appointment: a, ending: "cancel" }),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {titleCase(a.status)}
      </span>
    );
  }
  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

function SignatureActions({
  request,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  request: SignatureRequest;
  busy: boolean;
  onDialog: (d: StudioDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  const r = request;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (r.status === "draft") {
    items.push({
      label: "Send for signature",
      run: () => onAct(r.id, `${r.document_name} sent`, () => api.sendForSignature(r.id)),
    });
  }
  if (r.is_outstanding) {
    items.push({
      label: "Send a reminder",
      run: () => onAct(r.id, "Reminder sent", () => api.remindSignature(r.id)),
    });
    items.push({
      label: "Mark signed",
      run: () =>
        onConfirm({
          title: `Mark ${r.document_name} as signed?`,
          body: "This records that the document came back signed. It asserts that signing happened — it does not make it binding. That takes a provider such as DocuSign.",
          confirmLabel: "Mark signed",
          onConfirm: () => onAct(r.id, "Recorded as signed", () => api.markSigned(r.id)),
        }),
    });
    items.push({
      label: "Buyer declined…",
      tone: "danger",
      run: () => onDialog({ kind: "decline", request: r }),
    });
  }
  if (r.status !== "signed") {
    items.push({
      label: "Withdraw it…",
      tone: "danger",
      run: () => onDialog({ kind: "void", request: r }),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {r.signed_at ? day(r.signed_at) : titleCase(r.status)}
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

function BookAppointment({
  jobs,
  staff,
  onClose,
  onDone,
}: {
  jobs: Job[];
  staff: { id: string; full_name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const [jobId, setJobId] = useState("");
  const [when, setWhen] = useState(localInput(tomorrow));
  const [duration, setDuration] = useState("180");
  const [consultant, setConsultant] = useState("");
  const [location, setLocation] = useState("Design studio");
  const [cutoff, setCutoff] = useState("");

  // A handed-over or cancelled home has nothing left to choose, and the API
  // refuses it - so it is not offered.
  const eligible = jobs.filter(
    (j) => !["closed", "warranty", "cancelled", "planned"].includes(j.status),
  );

  return (
    <Modal open title="Book a design appointment" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Appointment booked", () =>
            api.bookAppointment({
              job_id: jobId,
              scheduled_for: new Date(when).toISOString(),
              duration_minutes: Number(duration) || 180,
              consultant_id: consultant || undefined,
              location: location || undefined,
              structural_cutoff: cutoff || undefined,
            }),
          );
        }}
      >
        <Field
          label="Home"
          hint={
            eligible.length === 0
              ? "No homes are at a stage where selections are still open."
              : "Only homes that have been sold and not yet handed over."
          }
        >
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
            <option value="">Choose…</option>
            {eligible.map((j) => (
              <option key={j.id} value={j.id}>
                {j.job_number} — {titleCase(j.status)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When">
            <input
              type="datetime-local"
              className="input"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              required
            />
          </Field>
          <Field label="How long" hint="Minutes. A full studio session is usually three hours.">
            <input
              type="number"
              min={15}
              step={15}
              className="input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Consultant">
            <select className="input" value={consultant} onChange={(e) => setConsultant(e.target.value)}>
              <option value="">Nobody yet</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Where">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>

        <Field
          label="Structural cutoff"
          hint="After this date, structural options are refused — a moved staircase needs a change order instead."
        >
          <input type="date" className="input" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        </Field>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !eligible.length}>
            {busy ? "Booking…" : "Book it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Reschedule({
  appointment,
  onClose,
  onDone,
}: {
  appointment: DesignAppointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const next = new Date();
  next.setDate(next.getDate() + 7);
  next.setHours(10, 0, 0, 0);
  const [when, setWhen] = useState(localInput(next));
  const [note, setNote] = useState("");

  return (
    <Modal open title="Move the appointment" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Appointment moved", () =>
            api.rescheduleAppointment(appointment.id, {
              scheduled_for: new Date(when).toISOString(),
              note: note || undefined,
            }),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The old booking is cancelled and a new one created pointing back at it, rather than the
          date being edited — a buyer who has moved three times is worth being able to see.
        </p>
        <Field label="New date and time">
          <input
            type="datetime-local"
            className="input"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            required
          />
        </Field>
        <Field label="Why">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Buyer away"
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Moving…" : "Move it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SetCutoff({
  appointment,
  onClose,
  onDone,
}: {
  appointment: DesignAppointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [cutoff, setCutoff] = useState(appointment.structural_cutoff ?? "");

  return (
    <Modal open title="Structural cutoff" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Cutoff set", () => api.setStructuralCutoff(appointment.id, cutoff));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          After this date the system refuses structural options on this home — a moved staircase,
          an extra window, a garage conversion. They have to be decided before the frame goes up,
          and afterwards the honest answer is a change order rather than a yes.
        </p>
        <Field label="Cutoff date">
          <input
            type="date"
            className="input"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            required
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Set it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecordOutcome({
  appointment,
  ending,
  onClose,
  onDone,
}: {
  appointment: DesignAppointment;
  ending: "complete" | "no-show" | "cancel";
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [note, setNote] = useState("");

  const copy = {
    complete: {
      title: "The session happened",
      body: "Records that the appointment took place. Anything the buyer chose is already on the home.",
      label: "Mark it happened",
      done: "Appointment completed",
      call: () => api.completeAppointment(appointment.id, note || undefined),
    },
    "no-show": {
      title: "Nobody came",
      body: "Its own ending rather than a cancellation: a cancellation is somebody telling you, a no-show is a wasted slot and a consultant sitting alone for three hours.",
      label: "Record a no-show",
      done: "Recorded as a no-show",
      call: () => api.markNoShow(appointment.id, note || undefined),
    },
    cancel: {
      title: "Cancel the appointment",
      body: "Book a new one afterwards rather than editing this record — how many times a buyer moved is worth keeping.",
      label: "Cancel it",
      done: "Appointment cancelled",
      call: () => api.cancelAppointment(appointment.id, note || undefined),
    },
  }[ending];

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
        <Field label="Note">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
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

function RequestSignature({
  jobs,
  onClose,
  onDone,
}: {
  jobs: Job[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [jobId, setJobId] = useState("");
  const [name, setName] = useState("Design selections addendum");
  const [kind, setKind] = useState("addendum");
  const [signer, setSigner] = useState("");
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [sendNow, setSendNow] = useState(true);

  return (
    <Modal open title="Request a signature" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(sendNow ? "Sent for signature" : "Draft created", async () => {
            const req = await api.createSignatureRequest({
              job_id: jobId,
              document_kind: kind,
              document_name: name,
              signer_name: signer,
              signer_email: email,
              expires_on: expires || undefined,
            });
            if (sendNow) await api.sendForSignature(req.id);
          });
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
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              {["addendum", "contract", "change_order", "warranty", "other"].map((k) => (
                <option key={k} value={k}>
                  {titleCase(k)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Document">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Signer">
            <input className="input" value={signer} onChange={(e) => setSigner(e.target.value)} required />
          </Field>
          <Field label="Their email">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Expires" hint="Optional. An unsigned document past this shows as expired.">
          <input type="date" className="input" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />{" "}
          Send it straight away
        </label>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : sendNow ? "Create and send" : "Save as draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeclineOrVoid({
  request,
  mode,
  onClose,
  onDone,
}: {
  request: SignatureRequest;
  mode: "decline" | "void";
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [reason, setReason] = useState("");

  const declining = mode === "decline";

  return (
    <Modal
      open
      title={declining ? "The buyer declined" : "Withdraw the document"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(declining ? "Recorded as declined" : "Document withdrawn", () =>
            declining
              ? api.declineSignature(request.id, reason)
              : api.voidSignature(request.id, reason),
          );
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {declining
            ? "A declined addendum means the selections behind it are wrong. Without knowing why, the next version will be wrong the same way — so the reason is required."
            : "Somebody was asked to sign this and will ask why it vanished."}
        </p>
        <Field label="Reason">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            placeholder={
              declining ? "Worktop is the wrong colour on page 2" : "Superseded by addendum #2"
            }
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : declining ? "Record the decline" : "Withdraw it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditAllowance({
  jobId,
  current,
  onClose,
  onDone,
}: {
  jobId: string;
  current: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [amount, setAmount] = useState(current);

  return (
    <Modal open title="Options allowance" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("Allowance updated", () => api.setAllowance(jobId, amount));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          What the buyer may spend on options before it costs them extra. It is money inside the
          base price, so it lives on the contract.
        </p>
        <Field label="Allowance">
          <input
            type="number"
            min={0}
            step="100"
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Zero is a legitimate answer — everything the buyer chooses is then an extra on top.
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

