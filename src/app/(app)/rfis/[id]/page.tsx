"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Card,
  ErrorNote,
  Field,
  Loading,
  Modal,
  PageHeader,
  StatusBadge,
  day,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { BallInCourt, RFI, RFICategory, RFIPriority } from "@/types/api";

const COURTS: BallInCourt[] = ["builder", "trade", "architect", "engineer", "buyer", "closed"];
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

function categoryLabel(c: string) {
  return c === "mep" ? "MEP" : titleCase(c);
}
function priorityTone(p: RFIPriority) {
  return p === "urgent" ? "danger" : p === "high" ? "warn" : "neutral";
}
function courtTone(court: BallInCourt) {
  if (court === "closed") return "neutral" as const;
  if (court === "builder") return "warn" as const;
  return "brand" as const;
}

export default function RFIDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rfi = useAsync(() => api.getRFI(id), [id]);
  const vendors = useAsync(() => api.listVendors(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const jobs = useAsync(() => api.jobOptions(), []);

  if (rfi.loading) return <Loading label="Loading RFI" variant="text" />;
  if (!rfi.data) return <ErrorNote message={rfi.error ?? "Not found"} />;

  const r = rfi.data;
  const reload = () => rfi.reload();
  const job = byId(jobs.data);

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/rfis" className="hover:underline" style={{ color: "var(--fg-muted)" }}>
          ← All RFIs
        </Link>
      </div>
      <PageHeader
        title={`${r.rfi_number} — ${r.subject}`}
        subtitle={[
          job.get(r.job_id)?.job_number,
          categoryLabel(r.category),
          r.location,
          r.spec_reference ? `ref ${r.spec_reference}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {r.is_overdue && <Badge tone="danger">Overdue</Badge>}
            {r.is_blocking && r.status === "open" && <Badge tone="danger">Blocking</Badge>}
            <Badge tone={priorityTone(r.priority)}>{titleCase(r.priority)}</Badge>
            <Badge tone={courtTone(r.ball_in_court)}>Ball: {titleCase(r.ball_in_court)}</Badge>
            <StatusBadge status={r.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Question r={r} vendors={vendors.data ?? []} codes={codes.data ?? []} onChange={reload} />
          <Thread r={r} onChange={reload} />
          <Activity r={r} />
        </div>
        <div className="space-y-6">
          <Actions r={r} codes={codes.data ?? []} onChange={reload} />
          <BallCard r={r} onChange={reload} />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ details */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span style={{ color: "var(--fg-subtle)" }}>{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function Question({
  r,
  vendors,
  codes,
  onChange,
}: {
  r: RFI;
  vendors: { id: string; name: string }[];
  codes: { id: string; code: string; name: string }[];
  onChange: () => void;
}) {
  const vendor = byId(vendors);
  const code = byId(codes);
  const [edit, setEdit] = useState(false);
  const editable = !["closed", "void"].includes(r.status);

  return (
    <Card
      title="Question"
      action={
        editable ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>
            Edit
          </button>
        ) : undefined
      }
    >
      <p className="whitespace-pre-wrap text-sm">{r.question}</p>

      <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <Row label="Type">{categoryLabel(r.category)}</Row>
        {r.location && <Row label="Location">{r.location}</Row>}
        {r.spec_reference && <Row label="Spec / drawing">{r.spec_reference}</Row>}
        <Row label="Raised">{day(r.raised_on)}</Row>
        <Row label="Due">
          <span style={{ color: r.is_overdue ? "var(--danger)" : undefined }}>{day(r.due_on)}</span>
        </Row>
        {r.answered_on && <Row label="Answered">{day(r.answered_on)}</Row>}
        {r.closed_on && <Row label="Closed">{day(r.closed_on)}</Row>}
        <Row label="Days open">{r.days_open ?? "—"}</Row>
        {r.days_to_answer != null && <Row label="Days to answer">{r.days_to_answer}</Row>}
        <Row label="Assigned trade">
          {r.assigned_vendor_id ? vendor.get(r.assigned_vendor_id)?.name ?? "—" : "Nobody yet"}
        </Row>
        {r.cost_code_id && <Row label="Cost code">{code.get(r.cost_code_id)?.code ?? "—"}</Row>}
      </div>

      {r.answer && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--ok-soft)" }}
        >
          <p className="mb-1 flex items-center gap-2 font-semibold" style={{ color: "var(--ok)" }}>
            Official answer
            {r.cost_impact && <Badge tone="warn">Cost impact</Badge>}
            {r.schedule_impact_days > 0 && <Badge tone="warn">+{r.schedule_impact_days}d</Badge>}
          </p>
          <p className="whitespace-pre-wrap">{r.answer}</p>
        </div>
      )}

      <EditRFI r={r} vendors={vendors} codes={codes} open={edit} onClose={() => setEdit(false)} onDone={() => { setEdit(false); onChange(); }} />
    </Card>
  );
}

function EditRFI({
  r,
  vendors,
  codes,
  open,
  onClose,
  onDone,
}: {
  r: RFI;
  vendors: { id: string; name: string }[];
  codes: { id: string; code: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      await api.updateRFI(r.id, {
        subject: String(form.get("subject")),
        question: String(form.get("question")),
        category: String(form.get("category")),
        priority: String(form.get("priority")),
        location: String(form.get("location") || "") || undefined,
        spec_reference: String(form.get("spec_reference") || "") || undefined,
        assigned_vendor_id: String(form.get("assigned_vendor_id") || "") || undefined,
        cost_code_id: String(form.get("cost_code_id") || "") || undefined,
        due_on: String(form.get("due_on") || "") || undefined,
        is_blocking: form.get("is_blocking") === "on",
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Edit RFI" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(new FormData(e.currentTarget));
        }}
      >
        <Field label="Subject">
          <input name="subject" className="input" defaultValue={r.subject} required />
        </Field>
        <Field label="Question">
          <textarea name="question" className="input" rows={3} defaultValue={r.question} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select name="category" className="input" defaultValue={r.category}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" className="input" defaultValue={r.priority}>
              {["urgent", "high", "normal", "low"].map((p) => (
                <option key={p} value={p}>
                  {titleCase(p)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Location">
            <input name="location" className="input" defaultValue={r.location ?? ""} />
          </Field>
          <Field label="Spec / drawing ref">
            <input name="spec_reference" className="input" defaultValue={r.spec_reference ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Assigned trade">
            <select name="assigned_vendor_id" className="input" defaultValue={r.assigned_vendor_id ?? ""}>
              <option value="">Nobody yet</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due">
            <input name="due_on" type="date" className="input" defaultValue={r.due_on ?? ""} />
          </Field>
        </div>
        <Field label="Cost code">
          <select name="cost_code_id" className="input" defaultValue={r.cost_code_id ?? ""}>
            <option value="">None</option>
            {codes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_blocking" defaultChecked={r.is_blocking} />{" "}
          Work is stopped until this is answered
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
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

/* -------------------------------------------------------------------- thread */

function Thread({ r, onChange }: { r: RFI; onChange: () => void }) {
  const [body, setBody] = useState("");
  const [court, setCourt] = useState<string>("architect");
  const [official, setOfficial] = useState(false);
  const [costImpact, setCostImpact] = useState(false);
  const [scheduleDays, setScheduleDays] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRespond = !["closed", "void"].includes(r.status);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addRFIResponse(r.id, {
        body,
        court,
        is_official: official,
        cost_impact: costImpact,
        schedule_impact_days: Number(scheduleDays || 0),
      });
      setBody("");
      setOfficial(false);
      setCostImpact(false);
      setScheduleDays("0");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the response");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`Responses (${r.responses.length})`}>
      {r.responses.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          No responses yet. The thread is how several parties weigh in before one answer is
          made official.
        </p>
      ) : (
        <ul className="space-y-3">
          {r.responses.map((resp) => (
            <li
              key={resp.id}
              className="rounded-lg border p-3"
              style={{
                borderColor: resp.is_official ? "var(--ok)" : "var(--border)",
                background: resp.is_official ? "var(--ok-soft)" : undefined,
              }}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={courtTone(resp.court as BallInCourt)}>{titleCase(resp.court)}</Badge>
                {resp.is_official && <Badge tone="ok">Official answer</Badge>}
                {resp.cost_impact && <Badge tone="warn">Cost impact</Badge>}
                {resp.schedule_impact_days > 0 && <Badge tone="warn">+{resp.schedule_impact_days}d</Badge>}
                <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {day(resp.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{resp.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canRespond ? (
        <form onSubmit={submit} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <textarea
            className="input"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a response…"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From">
              <select className="input" value={court} onChange={(e) => setCourt(e.target.value)}>
                {COURTS.filter((c) => c !== "closed").map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />{" "}
              This is the official answer
            </label>
          </div>
          {official && (
            <div className="grid gap-3 sm:grid-cols-2 rounded-lg px-3 py-2" style={{ background: "var(--surface-2)" }}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={costImpact} onChange={(e) => setCostImpact(e.target.checked)} />{" "}
                Has a cost impact
              </label>
              <Field label="Schedule impact (days)">
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={scheduleDays}
                  onChange={(e) => setScheduleDays(e.target.value)}
                />
              </Field>
            </div>
          )}
          {error && <ErrorNote message={error} />}
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
              {busy ? "Adding…" : official ? "Record official answer" : "Add response"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 border-t pt-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--fg-subtle)" }}>
          This RFI is {r.status}. Reopen it to add a response.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- activity log */

function Activity({ r }: { r: RFI }) {
  const tone: Record<string, string> = {
    raised: "brand",
    answered: "ok",
    closed: "neutral",
    reopened: "warn",
    voided: "danger",
    change_order: "warn",
    reassigned: "brand",
  };
  return (
    <Card title="Activity">
      {r.activity.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          No activity yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {r.activity.map((a) => (
            <li key={a.id} className="border-l-2 pl-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-0.5 flex items-center gap-2">
                <Badge tone={(tone[a.kind] ?? "neutral") as "brand"}>{titleCase(a.kind)}</Badge>
                <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {day(a.created_at)}
                </span>
              </div>
              {a.detail && <p className="text-sm">{a.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- actions */

function Actions({
  r,
  codes,
  onChange,
}: {
  r: RFI;
  codes: { id: string; code: string; name: string }[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [charging, setCharging] = useState(false);

  const canAnswer = ["open", "draft"].includes(r.status);
  const canClose = r.status === "answered";
  const canReopen = ["answered", "closed"].includes(r.status);
  const canVoid = !["closed", "void"].includes(r.status);
  const canCharge = r.cost_impact && ["answered", "closed"].includes(r.status);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Actions">
      {error && (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      )}
      {note && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
          {note}
        </div>
      )}

      <div className="space-y-2">
        {canAnswer && (
          <button className="btn btn-primary w-full" onClick={() => setAnswering(true)}>
            Answer
          </button>
        )}
        {canCharge && (
          <button className="btn btn-ghost w-full border" style={{ borderColor: "var(--border)" }} onClick={() => setCharging(true)}>
            Raise change order
          </button>
        )}
        {canClose && (
          <button
            className="btn btn-ghost w-full border"
            style={{ borderColor: "var(--border)" }}
            disabled={busy}
            onClick={() => run(() => api.closeRFI(r.id), "Could not close")}
          >
            Close
          </button>
        )}
        {canReopen && (
          <button
            className="btn btn-ghost w-full border"
            style={{ borderColor: "var(--border)" }}
            disabled={busy}
            onClick={() => run(() => api.reopenRFI(r.id), "Could not reopen")}
          >
            Reopen
          </button>
        )}
        {canVoid && (
          <button
            className="btn btn-ghost w-full"
            style={{ color: "var(--danger)" }}
            disabled={busy}
            onClick={() => run(() => api.voidRFI(r.id), "Could not void")}
          >
            Void
          </button>
        )}
        {!canAnswer && !canClose && !canReopen && !canVoid && (
          <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            This RFI is settled. No further action.
          </p>
        )}
      </div>

      <AnswerModal
        r={r}
        open={answering}
        onClose={() => setAnswering(false)}
        onDone={() => {
          setAnswering(false);
          onChange();
        }}
      />
      <ChargeModal
        r={r}
        codes={codes}
        open={charging}
        onClose={() => setCharging(false)}
        onDone={(detail) => {
          setCharging(false);
          setNote(detail);
          onChange();
        }}
      />
    </Card>
  );
}

function AnswerModal({
  r,
  open,
  onClose,
  onDone,
}: {
  r: RFI;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      await api.answerRFI(r.id, {
        answer: String(form.get("answer")),
        cost_impact: form.get("cost_impact") === "on",
        schedule_impact_days: Number(form.get("schedule_impact_days") || 0),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the answer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={`Answer ${r.rfi_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(new FormData(e.currentTarget));
        }}
      >
        <p className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-2)" }}>
          {r.question}
        </p>
        <Field label="Answer">
          <textarea name="answer" className="input" rows={4} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="cost_impact" />{" "}
            This answer has a cost impact
          </label>
          <Field label="Schedule impact (days)">
            <input name="schedule_impact_days" type="number" min={0} defaultValue={0} className="input" />
          </Field>
        </div>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Recording an answer marks it the official response and hands the ball back.
        </p>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Recording…" : "Record answer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChargeModal({
  r,
  codes,
  open,
  onClose,
  onDone,
}: {
  r: RFI;
  codes: { id: string; code: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onDone: (detail: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const amount = String(form.get("amount") || "");
      const result = await api.changeOrderFromRFI(r.id, {
        responsible_party: String(form.get("responsible_party") || "builder"),
        price_delta: String(form.get("price_delta") || "0"),
        reason: String(form.get("reason") || "") || undefined,
        cost_lines: amount ? [{ cost_code_id: String(form.get("cost_code_id")), amount }] : [],
      });
      onDone(result.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise the change order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={`Change order from ${r.rfi_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(new FormData(e.currentTarget));
        }}
      >
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-2)" }}>
          <strong>{r.subject}</strong>
          {r.answer && (
            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>
              {r.answer}
            </p>
          )}
          {r.schedule_impact_days > 0 && (
            <p className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
              The {r.schedule_impact_days}-day schedule impact carries across automatically.
            </p>
          )}
        </div>

        <Field
          label="Who absorbs it"
          hint="Buyer bills and raises the budget. Builder raises the budget only. Trade is backcharged, so neither moves."
        >
          <select name="responsible_party" className="input" defaultValue="builder">
            <option value="buyer">Buyer — billed</option>
            <option value="builder">Builder — absorbed</option>
            <option value="trade">Trade — backcharged</option>
          </select>
        </Field>
        <Field label="Price to the buyer" hint="Leave at 0 unless the buyer is being billed.">
          <input name="price_delta" className="input" inputMode="decimal" defaultValue="0" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost code">
            <select name="cost_code_id" className="input" defaultValue="">
              <option value="">None</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost">
            <input name="amount" className="input" inputMode="decimal" placeholder="3200.00" />
          </Field>
        </div>
        <Field label="Reason" hint="Defaults to the RFI answer.">
          <textarea name="reason" className="input" rows={2} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Raising…" : "Raise change order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ ball in court */

function BallCard({ r, onChange }: { r: RFI; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled = ["closed", "void"].includes(r.status);

  async function move(court: string) {
    setBusy(true);
    setError(null);
    try {
      await api.reassignRFI(r.id, { ball_in_court: court });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reassign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Ball in court">
      <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
        Exactly one party owes the next move. Right now it is{" "}
        <span className="font-semibold" style={{ color: "var(--fg)" }}>
          {titleCase(r.ball_in_court)}
        </span>
        .
      </p>
      {settled ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          This RFI is {r.status}; there is no ball to move.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {COURTS.filter((c) => c !== "closed").map((c) => (
              <button
                key={c}
                className="btn btn-ghost btn-sm border"
                style={{
                  borderColor: c === r.ball_in_court ? "var(--brand)" : "var(--border)",
                  color: c === r.ball_in_court ? "var(--brand-fg)" : undefined,
                  background: c === r.ball_in_court ? "var(--brand-soft)" : undefined,
                }}
                disabled={busy || c === r.ball_in_court}
                onClick={() => void move(c)}
              >
                {titleCase(c)}
              </button>
            ))}
          </div>
          {error && (
            <div className="mt-3">
              <ErrorNote message={error} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
