"use client";

/**
 * The build schedule.
 *
 * The old page was a template editor with a cycle-time tile on top. That is
 * configuration, and configuration is read once and then left alone — while a
 * superintendent opens this screen every morning to ask two questions:
 *
 *  1. **what has stopped, or should have finished and has not**
 *  2. **what is due in the next fortnight, across every house**
 *
 * Neither could be asked. The only view of live work was one job's task list, so
 * planning the week meant opening eight of them. Those two queues are now the
 * page, and the templates sit behind a tab.
 *
 * Durations throughout are working days. They used to be calendar days, so a
 * ten-day task starting Thursday finished Sunday — and over a 115-day build the
 * error compounded to about a third of the programme.
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
import type { JobTask, ScheduleTemplate, ScheduleTemplateTask } from "@/types/api";

type Tab = "work" | "templates" | "calendar";

export default function SchedulePage() {
  const [tab, setTab] = useState<Tab>("work");
  const [tradeFilter, setTradeFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "block"; task: JobTask }
    | { kind: "skip"; task: JobTask }
    | { kind: "move"; task: JobTask }
    | { kind: "template" }
    | { kind: "templateTask"; template: ScheduleTemplate; task?: ScheduleTemplateTask }
    | { kind: "duplicate"; template: ScheduleTemplate }
    | { kind: "holiday" }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const summary = useAsync(() => api.scheduleSummary(), []);
  const behind = useAsync(
    () => api.behindSchedule({ vendor_id: tradeFilter || undefined }),
    [tradeFilter],
  );
  const soon = useAsync(
    () => api.lookahead({ days: 14, vendor_id: tradeFilter || undefined }),
    [tradeFilter],
  );
  const templates = useAsync(() => api.listScheduleTemplates(), []);
  const holidays = useAsync(() => api.listHolidays(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);

  const job = byId(jobs.data);
  const vendor = byId(vendors.data);

  const refresh = useCallback(() => {
    summary.reload();
    behind.reload();
    soon.reload();
  }, [summary, behind, soon]);

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

  /**
   * Finishing a task, and saying what it did to the rest of the programme.
   *
   * Reported as a success with detail rather than as an error: moving twenty
   * trades is the schedule doing its job, and the superintendent needs to know it
   * happened.
   */
  const completeTask = async (task: JobTask) => {
    if (busy) return;
    setBusy(task.id);
    try {
      const r = await api.completeTask(task.id);
      toast.success(
        `${task.name} complete`,
        r.tasks_shifted > 0
          ? `${r.days_late} day${r.days_late === 1 ? "" : "s"} late — ${r.tasks_shifted} task${r.tasks_shifted === 1 ? "" : "s"} moved behind it.`
          : "On schedule. Nothing behind it moved.",
      );
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
  // A task already in the behind list should not appear again under "coming up".
  const behindIds = new Set((behind.data ?? []).map((t) => t.id));
  const upcoming = (soon.data ?? []).filter((t) => !behindIds.has(t.id));

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="What is running, what has stopped, and what is due. Durations are working days — the calendar stretches around weekends and holidays."
        action={
          <>
            <button className="btn btn-ghost" onClick={() => setDialog({ kind: "holiday" })}>
              Non-working days
            </button>
            <button className="btn btn-primary" onClick={() => setDialog({ kind: "template" })}>
              New template
            </button>
          </>
        }
      />

      {s && (
        <div className="metric-strip mb-5">
          <div className="metric">
            <span className="metric-label">On site now</span>
            <span className="metric-value">{s.in_progress}</span>
            <span className="metric-hint">Tasks started</span>
          </div>
          <div className="metric">
            <span className="metric-label">Overdue</span>
            <span
              className="metric-value"
              style={s.overdue > 0 ? { color: "var(--danger)" } : undefined}
            >
              {s.overdue}
            </span>
            <span className="metric-hint">Should have finished</span>
          </div>
          <div className="metric">
            <span className="metric-label">Stopped</span>
            <span
              className="metric-value"
              style={s.blocked > 0 ? { color: "var(--warn)" } : undefined}
            >
              {s.blocked}
            </span>
            <span className="metric-hint">Blocked, with a reason</span>
          </div>
          <div className="metric">
            <span className="metric-label">Due in 14 days</span>
            <span className="metric-value">{s.due_soon}</span>
            <span className="metric-hint">Trades to book</span>
          </div>
          <div className="metric">
            <span className="metric-label">Templates</span>
            <span className="metric-value">{s.templates}</span>
            <span className="metric-hint">Build sequences</span>
          </div>
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
              ["work", "The work"],
              ["templates", "Templates"],
              ["calendar", "Calendar"],
            ] as const
          ).map(([key, label]) => (
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
            </button>
          ))}
        </div>

        {tab === "work" && (
          <select
            className="input ml-auto w-auto max-w-[13rem]"
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
          >
            <option value="">Every trade</option>
            {(vendors.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "work" && (
        <div className="space-y-5">
          {/* Overdue first. It is the only thing on this page that is costing
              money right now. */}
          <Card title={`Behind schedule (${behind.data?.length ?? 0})`} padded={false}>
            {behind.loading ? (
              <Loading />
            ) : (
              <TaskTable
                tasks={behind.data ?? []}
                job={job}
                vendor={vendor}
                busy={busy}
                emptyText="Nothing overdue. Every task is inside its dates."
                onDialog={setDialog}
                onComplete={completeTask}
                onAct={act}
                onConfirm={confirm}
              />
            )}
          </Card>

          <Card title={`Coming up — next 14 days (${upcoming.length})`} padded={false}>
            {soon.loading ? (
              <Loading />
            ) : (
              <TaskTable
                tasks={upcoming}
                job={job}
                vendor={vendor}
                busy={busy}
                emptyText="Nothing due in the next fortnight."
                onDialog={setDialog}
                onComplete={completeTask}
                onAct={act}
                onConfirm={confirm}
              />
            )}
          </Card>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-5">
          {templates.loading ? (
            <Loading />
          ) : (templates.data ?? []).length === 0 ? (
            <Card>
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                No templates yet. A template is the standard build sequence, configured once — every
                home generates its own task list from one.
              </p>
            </Card>
          ) : (
            (templates.data ?? []).map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                vendor={vendor}
                onChanged={() => {
                  templates.reload();
                  summary.reload();
                }}
                onAddTask={() => setDialog({ kind: "templateTask", template: t })}
                onEditTask={(task) => setDialog({ kind: "templateTask", template: t, task })}
                onDuplicate={() => setDialog({ kind: "duplicate", template: t })}
              />
            ))
          )}
        </div>
      )}

      {tab === "calendar" && (
        <Card title="Days we do not work" padded={false}>
          <p className="px-5 py-3 text-sm" style={{ color: "var(--fg-muted)" }}>
            Weekends are excluded everywhere. These are the extra days — bank holidays, the
            Christmas shutdown. Every duration in the schedule stretches around them.
          </p>
          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "name", label: "What" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty="Weekends only."
          >
            {(holidays.data ?? []).map((hday) => (
              <tr key={hday.id}>
                <td className="text-sm">{day(hday.on_date)}</td>
                <td className="text-sm">{hday.name}</td>
                <td className="num">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      confirm({
                        title: `Remove ${hday.name}?`,
                        body: "Schedules already generated keep their dates — those were agreed with trades who have them in their diaries. Only future ones will change.",
                        confirmLabel: "Remove",
                        tone: "danger",
                        onConfirm: async () => {
                          await api.removeHoliday(hday.id);
                          toast.success("Removed");
                          holidays.reload();
                        },
                      })
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
          <div className="flex justify-end px-5 py-3">
            <button className="btn btn-primary btn-sm" onClick={() => setDialog({ kind: "holiday" })}>
              Add a day
            </button>
          </div>
        </Card>
      )}

      {behind.error && <ErrorNote message={behind.error} />}

      {dialog?.kind === "block" && (
        <ReasonDialog
          title={`Why has ${dialog.task.name} stopped?`}
          body="A schedule that cannot say why it stopped is one nobody trusts. Somebody will ask why the trade did not turn up."
          placeholder="Plot waterlogged after the storm"
          label="Block it"
          onClose={() => setDialog(null)}
          onSubmit={(reason) => api.blockTask(dialog.task.id, reason)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "skip" && (
        <ReasonDialog
          title={`Skip ${dialog.task.name}?`}
          body="A skipped task did not happen — counting it as done would report work nobody did. It is part of the standard sequence, so leaving it out is a decision about this house."
          placeholder="Timber frame delivered pre-assembled"
          label="Skip it"
          onClose={() => setDialog(null)}
          onSubmit={(reason) => api.skipTask(dialog.task.id, reason)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "move" && (
        <MoveTask
          task={dialog.task}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "template" && (
        <NewTemplate
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            templates.reload();
            summary.reload();
          }}
        />
      )}
      {dialog?.kind === "templateTask" && (
        <NewTemplateTask
          template={dialog.template}
          task={dialog.task}
          vendors={vendors.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            templates.reload();
          }}
        />
      )}
      {dialog?.kind === "duplicate" && (
        <DuplicateTemplate
          template={dialog.template}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            templates.reload();
          }}
        />
      )}
      {dialog?.kind === "holiday" && (
        <NewHoliday
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            holidays.reload();
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

/* ------------------------------------------------------------ the work */

type TaskDialog =
  | { kind: "block"; task: JobTask }
  | { kind: "skip"; task: JobTask }
  | { kind: "move"; task: JobTask };

function TaskTable({
  tasks,
  job,
  vendor,
  busy,
  emptyText,
  onDialog,
  onAct,
  onComplete,
  onConfirm,
}: {
  tasks: JobTask[];
  job: Map<string, { job_number: string }>;
  vendor: Map<string, { name: string }>;
  busy: string | null;
  emptyText: string;
  onDialog: (d: TaskDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onComplete: (task: JobTask) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  return (
    <DataTable
      columns={[
        { key: "home", label: "Home" },
        { key: "task", label: "Task" },
        { key: "trade", label: "Trade" },
        { key: "dates", label: "Dates", align: "right" },
        { key: "status", label: "Status" },
        { key: "actions", label: "", align: "right" },
      ]}
      empty={emptyText}
    >
      {tasks.map((t) => (
        <tr
          key={t.id}
          style={
            t.status === "blocked"
              ? { boxShadow: "inset 3px 0 0 0 var(--warn)" }
              : t.is_overdue
                ? { boxShadow: "inset 3px 0 0 0 var(--danger)" }
                : undefined
          }
        >
          <td>
            <Link
              href={`/jobs/${t.job_id}`}
              className="font-medium"
              style={{ color: "var(--brand)" }}
            >
              {job.get(t.job_id)?.job_number ?? "—"}
            </Link>
          </td>
          <td>
            <span className={t.is_milestone ? "font-medium" : undefined}>{t.name}</span>
            {t.is_milestone && (
              <Badge tone="brand">
                <span className="text-[0.65rem]">Milestone</span>
              </Badge>
            )}
            {t.blocked_reason && (
              <div className="mt-0.5 text-xs" style={{ color: "var(--warn)" }}>
                {t.blocked_reason}
              </div>
            )}
          </td>
          <td className="text-sm">
            {t.vendor_id ? (
              (vendor.get(t.vendor_id)?.name ?? "—")
            ) : (
              <span style={{ color: "var(--fg-subtle)" }}>Unassigned</span>
            )}
          </td>
          <td className="num text-sm">
            {day(t.scheduled_start)} – {day(t.scheduled_finish)}
            <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              {t.duration_days} working day{t.duration_days === 1 ? "" : "s"}
            </div>
          </td>
          <td>
            <StatusBadge status={t.status} />
            {t.days_overdue !== null && (
              <div className="mt-0.5 text-xs font-semibold" style={{ color: "var(--danger)" }}>
                {t.days_overdue}d over
              </div>
            )}
          </td>
          <td className="num">
            <TaskActions
              task={t}
              busy={busy === t.id}
              onDialog={onDialog}
              onAct={onAct}
              onComplete={onComplete}
              onConfirm={onConfirm}
            />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function TaskActions({
  task,
  busy,
  onDialog,
  onAct,
  onComplete,
  onConfirm,
}: {
  task: JobTask;
  busy: boolean;
  onDialog: (d: TaskDialog) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onComplete: (task: JobTask) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  const t = task;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (t.status === "blocked") {
    items.push({
      label: "It can go ahead",
      run: () => onAct(t.id, `${t.name} unblocked`, () => api.unblockTask(t.id)),
    });
  } else if (t.is_open) {
    if (!t.actual_start) {
      items.push({
        label: "Trade is on site",
        run: () => onAct(t.id, `${t.name} started`, () => api.startTask(t.id)),
      });
    }
    items.push({
      label: "Mark it finished",
      run: () =>
        onConfirm({
          title: `Finish ${t.name}?`,
          body: "Anything behind it in the sequence moves by however late this is — which is the whole reason the schedule is worth keeping.",
          confirmLabel: "Finished",
          // The ripple is reported through the success message rather than by
          // throwing: shifting twenty trades is the schedule working, not an
          // error, and an error toast would say the opposite.
          onConfirm: () => onComplete(t),
        }),
    });
    items.push({ label: "It has stopped…", run: () => onDialog({ kind: "block", task: t }) });
    items.push({ label: "Move the dates…", run: () => onDialog({ kind: "move", task: t }) });
    items.push({
      label: "Not needed here…",
      tone: "danger",
      run: () => onDialog({ kind: "skip", task: t }),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        {titleCase(t.status)}
      </span>
    );
  }
  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

/* --------------------------------------------------------- templates */

function TemplateCard({
  template,
  vendor,
  onChanged,
  onAddTask,
  onEditTask,
  onDuplicate,
}: {
  template: ScheduleTemplate;
  vendor: Map<string, { name: string }>;
  onChanged: () => void;
  onAddTask: () => void;
  onEditTask: (task: ScheduleTemplateTask) => void;
  onDuplicate: () => void;
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const tasks = [...template.tasks].sort((a, b) => a.sequence - b.sequence);

  // The last task's offset plus its duration, which is what the programme
  // actually spans — the template's own name may say something else entirely.
  const span = tasks.length
    ? Math.max(...tasks.map((t) => t.offset_days + t.duration_days))
    : 0;

  const move = async (index: number, delta: number) => {
    const next = [...tasks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.reorderTemplate(
        template.id,
        next.map((t) => t.id),
      );
      onChanged();
    } catch (err) {
      toast.error("Could not reorder", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <Card
      title={`${template.code} — ${template.name}`}
      padded={false}
      action={
        <div className="flex items-center gap-2">
          <span className="tnum text-xs" style={{ color: "var(--fg-subtle)" }}>
            {tasks.length} tasks · {span} working days
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onDuplicate}>
            Duplicate
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onAddTask}>
            Add task
          </button>
        </div>
      }
    >
      <DataTable
        columns={[
          { key: "seq", label: "#" },
          { key: "task", label: "Task" },
          { key: "trade", label: "Trade" },
          { key: "offset", label: "Starts day", align: "right" },
          { key: "duration", label: "Duration", align: "right" },
          { key: "actions", label: "", align: "right" },
        ]}
        empty="No steps yet."
      >
        {tasks.map((t, i) => (
          <tr key={t.id}>
            <td className="tnum text-sm" style={{ color: "var(--fg-subtle)" }}>
              {t.sequence}
            </td>
            <td>
              {t.name}
              {t.is_milestone && <Badge tone="brand">Milestone</Badge>}
            </td>
            <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
              {t.vendor_id ? (vendor.get(t.vendor_id)?.name ?? "—") : "—"}
            </td>
            <td className="num tnum text-sm">{t.offset_days}</td>
            <td className="num tnum text-sm">{t.duration_days}d</td>
            <td className="num">
              <div className="inline-flex gap-1">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move earlier"
                >
                  ↑
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={i === tasks.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move later"
                >
                  ↓
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onEditTask(t)}>
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    confirm({
                      title: `Remove "${t.name}"?`,
                      body: "Schedules already generated from this template are separate records and are untouched.",
                      confirmLabel: "Remove",
                      tone: "danger",
                      onConfirm: async () => {
                        await api.deleteTemplateTask(t.id);
                        toast.success("Step removed");
                        onChanged();
                      },
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
        Offsets and durations are working days. A task starting on day 15 for 10 days runs for two
        calendar weeks, and never lands a trade on a Saturday.
      </p>
      {dialog}
    </Card>
  );
}

/* ----------------------------------------------------------- dialogs */

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

function ReasonDialog({
  title,
  body,
  placeholder,
  label,
  onClose,
  onSubmit,
  onDone,
}: {
  title: string;
  body: string;
  placeholder: string;
  label: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [reason, setReason] = useState("");

  return (
    <Modal open title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Recorded", () => onSubmit(reason));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          {body}
        </p>
        <Field label="Reason">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            placeholder={placeholder}
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Back
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : label}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MoveTask({
  task,
  onClose,
  onDone,
}: {
  task: JobTask;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState(task.scheduled_start ?? "");
  const [cascade, setCascade] = useState(true);

  return (
    <Modal open title={`Move ${task.name}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Dates moved", () =>
            api.rescheduleTask(task.id, { scheduled_start: when, cascade }),
          );
        }}
      >
        <Field label="New start" hint="Moved to the next working day if this is a weekend.">
          <input
            type="date"
            className="input"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            required
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={cascade}
            onChange={(e) => setCascade(e.target.checked)}
          />
          <span>
            Move everything behind it too.{" "}
            <span style={{ color: "var(--fg-muted)" }}>
              Leaving this off books the next trade for a day the site will not be ready.
            </span>
          </span>
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Moving…" : "Move it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewTemplate({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <Modal open title="New schedule template" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${name} created`, () => api.createScheduleTemplate({ code, name }));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          The standard build sequence, configured once. Every home generates its own task list from
          one of these.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">
            <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        </div>
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

function NewTemplateTask({
  template,
  task,
  vendors,
  onClose,
  onDone,
}: {
  template: ScheduleTemplate;
  /** Present when correcting an existing step rather than adding one. A wrong
   * duration used to mean deleting the step and re-adding it, which lost its
   * place in the sequence. */
  task?: ScheduleTemplateTask;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const editing = !!task;
  const [name, setName] = useState(task?.name ?? "");
  const [offset, setOffset] = useState(String(task?.offset_days ?? 0));
  const [duration, setDuration] = useState(String(task?.duration_days ?? 5));
  const [vendorId, setVendorId] = useState(task?.vendor_id ?? "");
  const [milestone, setMilestone] = useState(task?.is_milestone ?? false);

  return (
    <Modal open title={editing ? `Edit ${task!.name}` : `Add a step to ${template.code}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const body = {
            name,
            offset_days: Number(offset) || 0,
            duration_days: Number(duration) || 1,
            vendor_id: vendorId || undefined,
            is_milestone: milestone,
          };
          run(editing ? `${name} updated` : `${name} added`, () =>
            editing
              ? api.updateTemplateTask(task!.id, body as never)
              : api.addTemplateTask(template.id, body),
          );
        }}
      >
        <Field label="Task">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts day" hint="Working days after the build begins.">
            <input type="number" min={0} className="input" value={offset} onChange={(e) => setOffset(e.target.value)} />
          </Field>
          <Field label="Duration" hint="Working days the trade needs.">
            <input type="number" min={1} className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
        </div>
        <Field label="Trade">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Decide per house</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} />
          A milestone
        </label>
        {!editing && (
          <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            Appended to the end unless you reorder it. Two steps at the same position would generate
            a schedule whose order depends on the database.
          </p>
        )}
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DuplicateTemplate({
  template,
  onClose,
  onDone,
}: {
  template: ScheduleTemplate;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [code, setCode] = useState(`${template.code}-2`);
  const [name, setName] = useState(`${template.name} (copy)`);

  return (
    <Modal open title={`Duplicate ${template.code}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run("Template copied", () => api.duplicateTemplate(template.id, { code, name }));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          All {template.tasks.length} steps are copied. A second house type is usually the first
          with three steps changed, and retyping forty tasks is how a template ends up wrong.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">
            <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} required />
          </Field>
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Copying…" : "Duplicate"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewHoliday({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState("");
  const [name, setName] = useState("");

  return (
    <Modal open title="A day we do not work" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(`${name} added`, () => api.addHoliday({ on_date: when, name }));
        }}
      >
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Weekends are already excluded. These are the extra days, and every duration in schedules
          generated afterwards stretches around them.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
          <Field label="What is it">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="August bank holiday"
            />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
