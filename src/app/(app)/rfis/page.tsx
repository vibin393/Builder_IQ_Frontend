"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatTile,
  StatusBadge,
  day,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { BallInCourt, RFI, RFICategory } from "@/types/api";

const CATEGORIES: RFICategory[] = [
  "design",
  "structural",
  "architectural",
  "mep",
  "civils",
  "coordination",
  "site_condition",
  "materials",
  "building_control",
  "other",
];

/** Human labels for the categories whose raw value reads oddly. */
function categoryLabel(c: string) {
  if (c === "mep") return "MEP";
  return titleCase(c);
}

/** Whose move it is. The whole point of an RFI log is that this is never ambiguous. */
function courtTone(court: BallInCourt) {
  if (court === "closed") return "neutral" as const;
  if (court === "builder") return "warn" as const;
  return "brand" as const;
}

export default function RFIsPage() {
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courtFilter, setCourtFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const rfis = useAsync(
    () =>
      api.listRFIs({
        job_id: jobFilter || undefined,
        status: statusFilter || undefined,
        ball_in_court: courtFilter || undefined,
        category: categoryFilter || undefined,
        overdue_only: overdueOnly || undefined,
      }),
    [jobFilter, statusFilter, courtFilter, categoryFilter, overdueOnly],
  );
  const summary = useAsync(() => api.rfiSummary(jobFilter || undefined), [jobFilter]);
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const codes = useAsync(() => api.listCostCodes(), []);

  const [newOpen, setNewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const job = byId(jobs.data);

  const rows = rfis.data ?? [];
  const s = summary.data;

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  async function create(form: FormData) {
    setError(null);
    try {
      await api.createRFI({
        job_id: String(form.get("job_id")),
        subject: String(form.get("subject")),
        question: String(form.get("question")),
        priority: String(form.get("priority") || "normal"),
        category: String(form.get("category") || "other"),
        assigned_vendor_id: String(form.get("assigned_vendor_id") || "") || undefined,
        cost_code_id: String(form.get("cost_code_id") || "") || undefined,
        location: String(form.get("location") || "") || undefined,
        spec_reference: String(form.get("spec_reference") || "") || undefined,
        ball_in_court: String(form.get("ball_in_court") || "builder"),
        due_on: String(form.get("due_on") || "") || undefined,
        is_blocking: form.get("is_blocking") === "on",
      });
      setNewOpen(false);
      rfis.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not raise the RFI");
    }
  }

  async function reassign(rfi: RFI, court: BallInCourt) {
    setError(null);
    try {
      await api.reassignRFI(rfi.id, { ball_in_court: court });
      rfis.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not reassign");
    }
  }

  return (
    <>
      <PageHeader
        title="RFIs"
        subtitle="Questions that must be answered before work can proceed. Every one names whose court the ball is in, so nothing sits unowned."
        action={
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            Raise an RFI
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open" value={s?.open ?? "—"} />
        <StatTile
          label="Overdue"
          value={s?.overdue ?? "—"}
          tone={s?.overdue ? "danger" : "ok"}
        />
        <StatTile
          label="Blocking work"
          value={s?.blocking ?? "—"}
          tone={s?.blocking ? "danger" : "ok"}
          hint="Site is stopped"
        />
        <StatTile
          label="In our court"
          value={s?.in_our_court ?? "—"}
          tone={s?.in_our_court ? "warn" : "ok"}
          hint="We owe the answer"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Due this week" value={s?.due_this_week ?? "—"} tone={s?.due_this_week ? "warn" : "default"} />
        <StatTile
          label="Avg response"
          value={s?.avg_response_days != null ? `${s.avg_response_days}d` : "—"}
          hint="Raised to answered"
        />
        <StatTile label="Unassigned" value={s?.unassigned ?? "—"} hint="No trade named yet" />
        <StatTile label="Answered" value={s?.answered ?? "—"} tone="ok" hint="Awaiting close-out" />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      {s && (s.open > 0 || rows.length > 0) && <AgingStrip aging={s.aging} />}

      <Card
        title="RFI log"
        padded={false}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input"
              style={{ width: "auto" }}
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
            <select
              className="input"
              style={{ width: "auto" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Any status</option>
              {["draft", "open", "answered", "closed", "void"].map((st) => (
                <option key={st} value={st}>
                  {titleCase(st)}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: "auto" }}
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
            >
              <option value="">Any court</option>
              {["builder", "trade", "architect", "engineer", "buyer", "closed"].map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: "auto" }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Any type</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              Overdue only
            </label>
          </div>
        }
      >
        {rfis.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "no", label: "RFI" },
              { key: "subject", label: "Subject" },
              { key: "home", label: "Home" },
              { key: "court", label: "Ball in court" },
              { key: "status", label: "Status" },
              { key: "due", label: "Due" },
              { key: "age", label: "Days open", align: "right" },
              { key: "act", label: "" },
            ]}
            empty="No RFIs match."
          >
            {rows.map((r) => (
              <tr key={r.id} style={r.is_overdue ? { background: "var(--danger-soft)" } : undefined}>
                <td className="tnum font-medium">
                  <Link href={`/rfis/${r.id}`} className="hover:underline">
                    {r.rfi_number}
                  </Link>
                </td>
                <td>
                  <Link href={`/rfis/${r.id}`} className="font-medium hover:underline">
                    {r.subject}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge tone="neutral">{categoryLabel(r.category)}</Badge>
                    {r.is_blocking && r.status === "open" && <Badge tone="danger">Blocking</Badge>}
                    {r.priority === "urgent" && <Badge tone="danger">Urgent</Badge>}
                    {r.cost_impact && <Badge tone="warn">Cost impact</Badge>}
                    {r.schedule_impact_days > 0 && <Badge tone="warn">+{r.schedule_impact_days}d</Badge>}
                    {r.response_count > 0 && (
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {r.response_count} {r.response_count === 1 ? "reply" : "replies"}
                      </span>
                    )}
                  </div>
                  {r.location && (
                    <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {r.location}
                    </div>
                  )}
                </td>
                <td>{job.get(r.job_id)?.job_number ?? "—"}</td>
                <td>
                  {r.status === "closed" || r.status === "void" ? (
                    <Badge tone={courtTone(r.ball_in_court)}>{titleCase(r.ball_in_court)}</Badge>
                  ) : (
                    <select
                      className="input"
                      aria-label={`Ball in court for ${r.rfi_number}`}
                      style={{ width: "auto", padding: "0.2rem 0.5rem", fontSize: "0.8rem" }}
                      value={r.ball_in_court}
                      onChange={(e) => void reassign(r, e.target.value as BallInCourt)}
                    >
                      {["builder", "trade", "architect", "engineer", "buyer", "closed"].map((c) => (
                        <option key={c} value={c}>
                          {titleCase(c)}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{day(r.due_on)}</td>
                <td className="num tnum">{r.days_open ?? "—"}</td>
                <td>
                  <div className="flex justify-end">
                    <Link href={`/rfis/${r.id}`} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={newOpen} title="Raise an RFI" onClose={() => setNewOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(new FormData(e.currentTarget));
          }}
        >
          <Field label="Home">
            <select name="job_id" className="input" required defaultValue="">
              <option value="" disabled>
                Choose a home
              </option>
              {(jobs.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input name="subject" className="input" required placeholder="Beam bearing at grid C" />
          </Field>
          <Field label="Question">
            <textarea name="question" className="input" rows={3} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select name="category" className="input" defaultValue="other">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" className="input" defaultValue="normal">
                {["urgent", "high", "normal", "low"].map((p) => (
                  <option key={p} value={p}>
                    {titleCase(p)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" hint="Where on the home the question bites.">
              <input name="location" className="input" placeholder="Plot 47, first floor" />
            </Field>
            <Field label="Spec / drawing ref">
              <input name="spec_reference" className="input" placeholder="S-201 / rev C" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ball in court" hint="Who owes the first answer.">
              <select name="ball_in_court" className="input" defaultValue="builder">
                {["builder", "architect", "engineer", "trade", "buyer"].map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input name="due_on" type="date" className="input" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assigned trade">
              <select name="assigned_vendor_id" className="input" defaultValue="">
                <option value="">Nobody yet</option>
                {(vendors.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cost code">
              <select name="cost_code_id" className="input" defaultValue="">
                <option value="">None</option>
                {(codes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_blocking" />
            Work is stopped until this is answered
          </label>
          <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            Leave the due date blank and it is set from the priority — urgent 2 days, high 5,
            normal 10, low 15.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Raise
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** A one-line read of how old the open queue is getting, bucketed by days open. */
function AgingStrip({ aging }: { aging: Record<string, number> }) {
  const order = ["0-3", "4-7", "8-14", "15+"];
  const labels: Record<string, string> = {
    "0-3": "0–3 days",
    "4-7": "4–7 days",
    "8-14": "8–14 days",
    "15+": "15+ days",
  };
  const tones: Record<string, string> = {
    "0-3": "var(--ok)",
    "4-7": "var(--fg)",
    "8-14": "var(--warn)",
    "15+": "var(--danger)",
  };
  const total = order.reduce((sum, k) => sum + (aging[k] ?? 0), 0);
  if (total === 0) return null;

  return (
    <div className="mb-6">
      <Card title="Open RFIs by age">
        <div className="flex flex-wrap gap-6">
          {order.map((k) => (
            <div key={k}>
              <p className="tnum text-2xl font-semibold" style={{ color: tones[k] }}>
                {aging[k] ?? 0}
              </p>
              <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                {labels[k]}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
