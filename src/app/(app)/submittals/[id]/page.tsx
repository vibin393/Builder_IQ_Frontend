"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  StatusBadge,
  day,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { BallInCourt, RFIPriority, Submittal, SubmittalStatus, SubmittalType } from "@/types/api";

const COURTS: BallInCourt[] = ["builder", "trade", "architect", "engineer", "buyer", "closed"];
const TYPES: SubmittalType[] = [
  "product_data",
  "shop_drawing",
  "sample",
  "mock_up",
  "certificate",
  "method_statement",
  "o_and_m",
  "warranty_doc",
  "other",
];

const OUTCOMES: { value: SubmittalStatus; label: string; hint: string }[] = [
  { value: "approved", label: "Approved", hint: "Fit it as submitted." },
  { value: "approved_as_noted", label: "Approved as noted", hint: "Fit it, with the noted changes." },
  {
    value: "revise_and_resubmit",
    label: "Revise and resubmit",
    hint: "Bumps the revision and hands it back to the trade.",
  },
  { value: "rejected", label: "Rejected", hint: "Not acceptable. Start again." },
];

function typeLabel(t: string) {
  if (t === "o_and_m") return "O&M manual";
  return titleCase(t);
}
function priorityTone(p: RFIPriority) {
  return p === "urgent" ? "danger" : p === "high" ? "warn" : "neutral";
}
function courtTone(court: BallInCourt) {
  if (court === "closed") return "neutral" as const;
  if (court === "trade") return "warn" as const;
  return "brand" as const;
}

export default function SubmittalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sub = useAsync(() => api.getSubmittal(id), [id]);
  const vendors = useAsync(() => api.listVendors(), []);
  const options = useAsync(() => api.listOptions(), []);
  const jobs = useAsync(() => api.jobOptions(), []);

  if (sub.loading) return <Loading label="Loading submittal" variant="text" />;
  if (!sub.data) return <ErrorNote message={sub.error ?? "Not found"} />;

  const s = sub.data;
  const reload = () => sub.reload();
  const job = byId(jobs.data);

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/submittals" className="hover:underline" style={{ color: "var(--fg-muted)" }}>
          ← All submittals
        </Link>
      </div>
      <PageHeader
        title={`${s.submittal_number} — ${s.title}`}
        subtitle={[
          job.get(s.job_id ?? "")?.job_number,
          typeLabel(s.submittal_type),
          s.manufacturer,
          s.spec_section ? `Spec ${s.spec_section}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {s.is_at_risk && <Badge tone="danger">Procurement at risk</Badge>}
            {s.is_overdue && <Badge tone="warn">Overdue</Badge>}
            <Badge tone={priorityTone(s.priority)}>{titleCase(s.priority)}</Badge>
            <Badge tone={courtTone(s.ball_in_court)}>Ball: {titleCase(s.ball_in_court)}</Badge>
            <Badge tone="neutral">Rev {s.revision}</Badge>
            <StatusBadge status={s.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Details s={s} vendors={vendors.data ?? []} options={options.data ?? []} onChange={reload} />
          <Revisions s={s} />
          <Activity s={s} />
        </div>
        <div className="space-y-6">
          <Actions s={s} onChange={reload} />
          <Procurement s={s} />
          <BallCard s={s} onChange={reload} />
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

function Details({
  s,
  vendors,
  options,
  onChange,
}: {
  s: Submittal;
  vendors: { id: string; name: string }[];
  options: { id: string; name: string }[];
  onChange: () => void;
}) {
  const vendor = byId(vendors);
  const option = byId(options);
  const [edit, setEdit] = useState(false);
  const editable = !["approved", "rejected"].includes(s.status);

  return (
    <Card
      title="Item"
      action={
        editable ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>
            Edit
          </button>
        ) : undefined
      }
    >
      {s.description && <p className="mb-3 whitespace-pre-wrap text-sm">{s.description}</p>}
      <Row label="Type">{typeLabel(s.submittal_type)}</Row>
      {s.manufacturer && <Row label="Manufacturer">{s.manufacturer}</Row>}
      {s.model_number && <Row label="Model">{s.model_number}</Row>}
      {s.spec_section && <Row label="Spec section">{s.spec_section}</Row>}
      <Row label="Trade">
        {s.vendor_id ? vendor.get(s.vendor_id)?.name ?? "—" : "None"}
      </Row>
      <Row label="Buyer selection">
        {s.option_id ? (
          <Badge tone="brand">{option.get(s.option_id)?.name ?? "Linked"}</Badge>
        ) : (
          <span style={{ color: "var(--fg-subtle)" }}>Not linked</span>
        )}
      </Row>
      <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
        <Row label="Submitted">{day(s.submitted_on)}</Row>
        <Row label="Review due">
          <span style={{ color: s.is_overdue ? "var(--danger)" : undefined }}>{day(s.due_on)}</span>
        </Row>
        {s.returned_on && <Row label="Returned">{day(s.returned_on)}</Row>}
        {s.approved_on && <Row label="Approved">{day(s.approved_on)}</Row>}
        {s.review_turnaround_days != null && (
          <Row label="Turnaround">{s.review_turnaround_days} days</Row>
        )}
      </div>

      {s.review_notes && (
        <div className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-2)" }}>
          <span className="font-medium">Review notes:</span> {s.review_notes}
        </div>
      )}

      <EditModal
        s={s}
        vendors={vendors}
        options={options}
        open={edit}
        onClose={() => setEdit(false)}
        onDone={() => {
          setEdit(false);
          onChange();
        }}
      />
    </Card>
  );
}

function EditModal({
  s,
  vendors,
  options,
  open,
  onClose,
  onDone,
}: {
  s: Submittal;
  vendors: { id: string; name: string }[];
  options: { id: string; name: string }[];
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
      await api.updateSubmittal(s.id, {
        title: String(form.get("title")),
        submittal_type: String(form.get("submittal_type")),
        priority: String(form.get("priority")),
        manufacturer: String(form.get("manufacturer") || "") || undefined,
        model_number: String(form.get("model_number") || "") || undefined,
        spec_section: String(form.get("spec_section") || "") || undefined,
        vendor_id: String(form.get("vendor_id") || "") || undefined,
        option_id: String(form.get("option_id") || "") || undefined,
        required_on_site: String(form.get("required_on_site") || "") || undefined,
        lead_time_days: Number(form.get("lead_time_days") || 0),
        due_on: String(form.get("due_on") || "") || undefined,
        description: String(form.get("description") || "") || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Edit submittal" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(new FormData(e.currentTarget));
        }}
      >
        <Field label="Item">
          <input name="title" className="input" defaultValue={s.title} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select name="submittal_type" className="input" defaultValue={s.submittal_type}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" className="input" defaultValue={s.priority}>
              {["urgent", "high", "normal", "low"].map((p) => (
                <option key={p} value={p}>
                  {titleCase(p)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Manufacturer">
            <input name="manufacturer" className="input" defaultValue={s.manufacturer ?? ""} />
          </Field>
          <Field label="Model number">
            <input name="model_number" className="input" defaultValue={s.model_number ?? ""} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Trade">
            <select name="vendor_id" className="input" defaultValue={s.vendor_id ?? ""}>
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Buyer selection">
            <select name="option_id" className="input" defaultValue={s.option_id ?? ""}>
              <option value="">None</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Spec section">
            <input name="spec_section" className="input" defaultValue={s.spec_section ?? ""} />
          </Field>
          <Field label="Needed on site">
            <input name="required_on_site" type="date" className="input" defaultValue={s.required_on_site ?? ""} />
          </Field>
          <Field label="Lead time (days)">
            <input name="lead_time_days" type="number" min={0} className="input" defaultValue={s.lead_time_days} />
          </Field>
        </div>
        <Field label="Review due">
          <input name="due_on" type="date" className="input" defaultValue={s.due_on ?? ""} />
        </Field>
        <Field label="Description">
          <textarea name="description" className="input" rows={2} defaultValue={s.description ?? ""} />
        </Field>
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

/* --------------------------------------------------------- revision history */

function Revisions({ s }: { s: Submittal }) {
  return (
    <Card title={`Revision history (${s.revisions.length})`} padded={false}>
      <DataTable
        columns={[
          { key: "rev", label: "Rev" },
          { key: "outcome", label: "Outcome" },
          { key: "submitted", label: "Submitted" },
          { key: "returned", label: "Returned" },
          { key: "notes", label: "Notes" },
        ]}
        empty="No completed review rounds yet. Each decision records one here."
      >
        {s.revisions.map((r) => (
          <tr key={r.id}>
            <td className="tnum font-medium">{r.revision}</td>
            <td>
              <StatusBadge status={r.outcome} />
            </td>
            <td className="text-sm">{day(r.submitted_on)}</td>
            <td className="text-sm">{day(r.returned_on)}</td>
            <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
              {r.review_notes ?? "—"}
            </td>
          </tr>
        ))}
      </DataTable>
    </Card>
  );
}

/* ------------------------------------------------------------- activity log */

function Activity({ s }: { s: Submittal }) {
  const tone: Record<string, string> = {
    created: "brand",
    submitted: "warn",
    review_started: "brand",
    approved: "ok",
    approved_as_noted: "ok",
    revise_and_resubmit: "warn",
    rejected: "danger",
    resubmitted: "warn",
    reassigned: "brand",
  };
  return (
    <Card title="Activity">
      {s.activity.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          No activity yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {s.activity.map((a) => (
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

function Actions({ s, onChange }: { s: Submittal; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const canSubmit = s.status === "draft";
  const canStart = s.status === "submitted";
  const canReview = ["submitted", "under_review"].includes(s.status);
  const canResubmit = s.status === "revise_and_resubmit";

  async function run(fn: () => Promise<unknown>, fallback: string, msg?: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (msg) setNote(msg);
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
        {canSubmit && (
          <button
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() => run(() => api.submitSubmittal(s.id), "Could not submit")}
          >
            Submit for review
          </button>
        )}
        {canStart && (
          <button
            className="btn btn-ghost w-full border"
            style={{ borderColor: "var(--border)" }}
            disabled={busy}
            onClick={() => run(() => api.startSubmittalReview(s.id), "Could not start review")}
          >
            Start review
          </button>
        )}
        {canReview && (
          <button className="btn btn-primary w-full" onClick={() => setReviewing(true)}>
            Record decision
          </button>
        )}
        {canResubmit && (
          <button
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(
                () => api.resubmitSubmittal(s.id),
                "Could not resubmit",
                `Revision ${s.revision} resubmitted for review.`,
              )
            }
          >
            Resubmit revision {s.revision}
          </button>
        )}
        {["approved", "rejected"].includes(s.status) && (
          <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            This submittal is {s.status}. No further action.
          </p>
        )}
      </div>

      <ReviewModal
        s={s}
        open={reviewing}
        onClose={() => setReviewing(false)}
        onDone={(msg) => {
          setReviewing(false);
          setNote(msg);
          onChange();
        }}
      />
    </Card>
  );
}

function ReviewModal({
  s,
  open,
  onClose,
  onDone,
}: {
  s: Submittal;
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const status = String(form.get("status")) as SubmittalStatus;
    try {
      const updated = await api.reviewSubmittal(s.id, {
        status,
        review_notes: String(form.get("review_notes") || "") || undefined,
      });
      onDone(
        status === "revise_and_resubmit"
          ? `${updated.submittal_number} is now revision ${updated.revision} and back with the trade.`
          : `${updated.submittal_number} marked ${titleCase(status)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={`Review ${s.submittal_number}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(new FormData(e.currentTarget));
        }}
      >
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-2)" }}>
          <strong>{s.title}</strong>
          <div style={{ color: "var(--fg-muted)" }}>
            Revision {s.revision}
            {s.manufacturer ? ` · ${s.manufacturer}` : ""}
          </div>
        </div>
        <Field label="Outcome">
          <div className="space-y-2">
            {OUTCOMES.map((o, i) => (
              <label key={o.value} aria-label={o.label} className="flex items-start gap-2.5 text-sm">
                <input type="radio" name="status" value={o.value} defaultChecked={i === 0} className="mt-1" />
                <span>
                  <span className="font-medium">{o.label}</span>
                  <span className="block text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {o.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Review notes">
          <textarea name="review_notes" className="input" rows={3} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Recording…" : "Record review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------- procurement */

function Procurement({ s }: { s: Submittal }) {
  return (
    <Card title="Procurement">
      {s.required_on_site == null ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          No needed-on-site date, so procurement runway cannot be tracked. Add one to catch
          long-lead items before they are late.
        </p>
      ) : (
        <>
          <Row label="Needed on site">{day(s.required_on_site)}</Row>
          <Row label="Lead time">{s.lead_time_days} days</Row>
          <Row label="Order by">{day(s.order_by_date)}</Row>
          <Row label="Submit by">
            <span style={{ color: s.is_at_risk ? "var(--danger)" : undefined }}>
              {day(s.submit_by_date)}
            </span>
          </Row>
          <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            {s.is_at_risk ? (
              <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
                At risk — there is no longer enough runway to review and order this before it
                is needed on site.
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--ok)" }}>
                On track — enough runway to review and order in time.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ ball in court */

function BallCard({ s, onChange }: { s: Submittal; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled = ["approved", "rejected"].includes(s.status);

  async function move(court: string) {
    setBusy(true);
    setError(null);
    try {
      await api.reassignSubmittal(s.id, { ball_in_court: court });
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
        Currently with{" "}
        <span className="font-semibold" style={{ color: "var(--fg)" }}>
          {titleCase(s.ball_in_court)}
        </span>
        .
      </p>
      {settled ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          This submittal is {s.status}; there is no ball to move.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {COURTS.filter((c) => c !== "closed").map((c) => (
              <button
                key={c}
                className="btn btn-ghost btn-sm border"
                style={{
                  borderColor: c === s.ball_in_court ? "var(--brand)" : "var(--border)",
                  color: c === s.ball_in_court ? "var(--brand-fg)" : undefined,
                  background: c === s.ball_in_court ? "var(--brand-soft)" : undefined,
                }}
                disabled={busy || c === s.ball_in_court}
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
