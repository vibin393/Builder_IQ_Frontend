"use client";

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
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { CoverageStatus, Priority, ServiceOrder, WarrantyRequest } from "@/types/api";

const CLOSED = ["resolved", "closed", "declined"];

const CATEGORIES = [
  "structural", "roofing", "plumbing", "electrical", "heating", "exterior",
  "interior", "joinery", "appliance", "damp", "drainage", "landscaping", "other",
];

function priorityTone(p: Priority) {
  return p === "emergency" ? "danger" : p === "high" ? "warn" : "neutral";
}
function coverageTone(c: CoverageStatus) {
  return c === "in_warranty" ? "ok" : c === "out_of_warranty" ? "danger" : c === "goodwill" ? "brand" : "neutral";
}

export default function WarrantyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const request = useAsync(() => api.getWarrantyRequest(id), [id]);
  const vendors = useAsync(() => api.listVendors(), []);
  const users = useAsync(() => api.listUsers().then((p) => p.items), []);

  if (request.loading) return <Loading label="Loading claim" />;
  if (!request.data) return <ErrorNote message={request.error ?? "Not found"} />;

  const r = request.data;
  const reload = () => request.reload();

  return (
    <>
      <PageHeader
        title={`${r.request_number} — ${r.title}`}
        subtitle={[r.location, titleCase(r.category), r.reported_via ? `via ${r.reported_via}` : null]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {r.is_overdue && <Badge tone="danger">Overdue</Badge>}
            <Badge tone={priorityTone(r.priority)}>{titleCase(r.priority)}</Badge>
            <Badge tone={coverageTone(r.coverage)}>{titleCase(r.coverage)}</Badge>
            <StatusBadge status={r.status} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ClaimDetails r={r} onChange={reload} />
          <ServiceOrders r={r} vendors={vendors.data ?? []} onChange={reload} />
          <Appointments r={r} vendors={vendors.data ?? []} users={users.data ?? []} onChange={reload} />
          <ActivityLog r={r} onChange={reload} />
        </div>

        <div className="space-y-6">
          <ActionsPanel r={r} onChange={reload} />
          <CoverageCard jobId={r.job_id} />
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

function ClaimDetails({ r, onChange }: { r: WarrantyRequest; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const editable = !["closed", "declined"].includes(r.status);
  return (
    <Card
      title="Claim"
      action={
        editable ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>
            Edit
          </button>
        ) : undefined
      }
    >
      <EditClaim r={r} open={edit} onClose={() => setEdit(false)} onDone={() => { setEdit(false); onChange(); }} />
      <Row label="Category">{titleCase(r.category)}</Row>
      <Row label="Submitted">{day(r.submitted_date)}</Row>
      <Row label="Acknowledged">{day(r.acknowledged_date)}</Row>
      <Row label="SLA due">
        <span style={{ color: r.is_overdue ? "var(--danger)" : undefined }}>{day(r.due_date)}</span>
      </Row>
      {r.resolved_date && <Row label="Resolved">{day(r.resolved_date)}</Row>}
      {r.closed_date && <Row label="Closed">{day(r.closed_date)}</Row>}
      {r.description && (
        <p className="mt-3 border-t pt-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
          {r.description}
        </p>
      )}
      {r.assessment_notes && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <span className="font-medium">Assessment:</span> {r.assessment_notes}
        </p>
      )}
      {r.decline_reason && (
        <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          <span className="font-medium">Declined:</span> {r.decline_reason}
        </p>
      )}
    </Card>
  );
}

function EditClaim({
  r,
  open,
  onClose,
  onDone,
}: {
  r: WarrantyRequest;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(r.title);
  const [location, setLocation] = useState(r.location ?? "");
  const [description, setDescription] = useState(r.description ?? "");
  const [priority, setPriority] = useState<string>(r.priority);
  const [category, setCategory] = useState<string>(r.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateWarrantyRequest(r.id, {
        title,
        location: location || undefined,
        description: description || undefined,
        priority,
        category,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Edit claim" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Issue">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="emergency">Emergency (habitability)</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Changing priority re-sets the SLA due date from the original submission date.
        </p>
        <Field label="Location">
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- service orders */

function ServiceOrders({
  r,
  vendors,
  onChange,
}: {
  r: WarrantyRequest;
  vendors: { id: string; name: string }[];
  onChange: () => void;
}) {
  const vendor = byId(vendors);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [completing, setCompleting] = useState<ServiceOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const canDispatch = !CLOSED.includes(r.status);

  async function cancel(orderId: string) {
    setBusy(true);
    try {
      await api.cancelServiceOrder(orderId);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Service orders"
      padded={false}
      action={
        canDispatch ? (
          <button className="btn btn-primary btn-sm" onClick={() => setDispatchOpen(true)}>
            Dispatch a trade
          </button>
        ) : undefined
      }
    >
      <DataTable
        columns={[
          { key: "trade", label: "Trade" },
          { key: "inst", label: "Instructions" },
          { key: "nte", label: "NTE", align: "right" },
          { key: "cost", label: "Cost", align: "right" },
          { key: "status", label: "Status" },
          { key: "act", label: "", align: "right" },
        ]}
        empty="Nothing dispatched yet. Assign a trade to start work."
      >
        {r.service_orders.map((o) => (
          <tr key={o.id}>
            <td className="font-medium">
              {o.vendor_id ? vendor.get(o.vendor_id)?.name ?? "—" : "Unassigned"}
              {o.back_charge && (
                <div className="mt-0.5">
                  <Badge tone="warn">Back-charge</Badge>
                </div>
              )}
            </td>
            <td style={{ color: "var(--fg-muted)" }}>{o.instructions ?? "—"}</td>
            <td className="num text-sm">{money(o.nte_amount)}</td>
            <td className="num text-sm">{money(o.cost_amount)}</td>
            <td><StatusBadge status={o.status} /></td>
            <td className="num">
              {o.status !== "complete" && o.status !== "cancelled" && (
                <div className="flex justify-end gap-1.5">
                  <button className="btn btn-primary btn-sm" onClick={() => setCompleting(o)} disabled={busy}>
                    Complete
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => cancel(o.id)} disabled={busy}>
                    Cancel
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
        When every service order is complete, the claim resolves automatically.
      </p>

      <DispatchModal
        open={dispatchOpen}
        requestId={r.id}
        vendors={vendors}
        onClose={() => setDispatchOpen(false)}
        onDone={() => {
          setDispatchOpen(false);
          onChange();
        }}
      />
      <CompleteModal
        order={completing}
        onClose={() => setCompleting(null)}
        onDone={() => {
          setCompleting(null);
          onChange();
        }}
      />
    </Card>
  );
}

function DispatchModal({
  open,
  requestId,
  vendors,
  onClose,
  onDone,
}: {
  open: boolean;
  requestId: string;
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [nte, setNte] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.dispatchServiceOrder(requestId, {
        vendor_id: vendorId || undefined,
        instructions: instructions || undefined,
        scheduled_date: scheduled || undefined,
        nte_amount: nte || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dispatch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Dispatch a trade" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Trade">
          <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
            <option value="">Select…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Instructions">
          <textarea className="input" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Scheduled date">
            <input type="date" className="input" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </Field>
          <Field label="Not-to-exceed ($)">
            <input type="number" min="0" step="0.01" className="input" value={nte} onChange={(e) => setNte(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Dispatching…" : "Dispatch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CompleteModal({
  order,
  onClose,
  onDone,
}: {
  order: ServiceOrder | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [resolution, setResolution] = useState("");
  const [cost, setCost] = useState("");
  const [backCharge, setBackCharge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      await api.completeServiceOrder(order.id, {
        resolution: resolution || undefined,
        cost_amount: cost || undefined,
        back_charge: backCharge || undefined,
      });
      setResolution("");
      setCost("");
      setBackCharge(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!order} title="Complete service order" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Resolution">
          <textarea className="input" rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="What was done" />
        </Field>
        <Field label="Actual cost ($)">
          <input type="number" min="0" step="0.01" className="input" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={backCharge} onChange={(e) => setBackCharge(e.target.checked)} />{" "}
          Charge this back to the trade (their defect)
        </label>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Complete"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- appointments */

function Appointments({
  r,
  vendors,
  users,
  onChange,
}: {
  r: WarrantyRequest;
  vendors: { id: string; name: string }[];
  users: { id: string; full_name: string }[];
  onChange: () => void;
}) {
  const vendor = byId(vendors);
  const user = byId(users);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function mark(appointmentId: string, status: string) {
    setBusy(true);
    try {
      await api.updateWarrantyAppointment(appointmentId, { status });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Appointments"
      padded={false}
      action={
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Book a visit
        </button>
      }
    >
      <DataTable
        columns={[
          { key: "kind", label: "Kind" },
          { key: "when", label: "When" },
          { key: "who", label: "Attending" },
          { key: "status", label: "Status" },
          { key: "act", label: "", align: "right" },
        ]}
        empty="No visits booked."
      >
        {r.appointments.map((a) => (
          <tr key={a.id}>
            <td className="font-medium">{titleCase(a.kind)}</td>
            <td className="text-sm">
              {day(a.scheduled_for)}
              {a.slot && <span style={{ color: "var(--fg-subtle)" }}> · {a.slot}</span>}
            </td>
            <td className="text-sm">
              {a.vendor_id ? vendor.get(a.vendor_id)?.name : a.assignee_id ? user.get(a.assignee_id)?.full_name : "—"}
            </td>
            <td><StatusBadge status={a.status} /></td>
            <td className="num">
              {a.status === "scheduled" && (
                <div className="flex justify-end gap-1.5">
                  <button className="btn btn-primary btn-sm" onClick={() => mark(a.id, "completed")} disabled={busy}>
                    Done
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => mark(a.id, "no_show")} disabled={busy}>
                    No-show
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </DataTable>

      <BookModal
        open={open}
        requestId={r.id}
        vendors={vendors}
        users={users}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          onChange();
        }}
      />
    </Card>
  );
}

function BookModal({
  open,
  requestId,
  vendors,
  users,
  onClose,
  onDone,
}: {
  open: boolean;
  requestId: string;
  vendors: { id: string; name: string }[];
  users: { id: string; full_name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState("service_visit");
  const [when, setWhen] = useState("");
  const [slot, setSlot] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.bookWarrantyAppointment(requestId, {
        kind,
        scheduled_for: when,
        slot: slot || undefined,
        vendor_id: vendorId || undefined,
        assignee_id: assigneeId || undefined,
        notes: notes || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book the visit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Book a visit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kind">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="assessment">Assessment</option>
              <option value="service_visit">Service visit</option>
              <option value="inspection">Inspection</option>
              <option value="follow_up">Follow-up</option>
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Slot">
            <input className="input" value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="AM / PM / 9–12" />
          </Field>
          <Field label="Trade (optional)">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Staff attending (optional)">
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Booking…" : "Book"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------- activity log */

function ActivityLog({ r, onChange }: { r: WarrantyRequest; onChange: () => void }) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addWarrantyNote(r.id, { body, visibility });
      setBody("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Activity log">
      <form onSubmit={submit} className="mb-4 space-y-2">
        <textarea
          className="input"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
        />
        <div className="flex items-center justify-between gap-2">
          <select className="input max-w-[12rem]" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="internal">Internal only</option>
            <option value="homeowner">Visible to homeowner</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !body.trim()}>
            {busy ? "Adding…" : "Add note"}
          </button>
        </div>
        {error && <ErrorNote message={error} />}
      </form>

      {r.notes.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {r.notes.map((n) => (
            <li key={n.id} className="border-l-2 pl-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-0.5 flex items-center gap-2">
                <Badge tone={n.visibility === "homeowner" ? "brand" : "neutral"}>
                  {n.visibility === "homeowner" ? "Homeowner" : "Internal"}
                </Badge>
                <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>{day(n.created_at)}</span>
              </div>
              <p className="text-sm">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- actions */

function ActionsPanel({ r, onChange }: { r: WarrantyRequest; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<string>(r.coverage === "pending" ? "in_warranty" : r.coverage);
  const [assessNotes, setAssessNotes] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const terminal = ["closed", "declined"].includes(r.status);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
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

      {r.status === "submitted" && (
        <button className="btn btn-primary w-full mb-3" disabled={busy} onClick={() => run(() => api.acknowledgeWarranty(r.id))}>
          Acknowledge (start SLA)
        </button>
      )}

      {!terminal && (
        <div className="mb-4 space-y-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-medium">Assess coverage</p>
          <select className="input" value={coverage} onChange={(e) => setCoverage(e.target.value)}>
            <option value="in_warranty">In warranty (builder pays)</option>
            <option value="out_of_warranty">Out of warranty</option>
            <option value="goodwill">Goodwill</option>
          </select>
          <input className="input" value={assessNotes} onChange={(e) => setAssessNotes(e.target.value)} placeholder="Assessment notes" />
          <input
            className="input"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Decline reason (declines the claim)"
          />
          <button
            className="btn btn-primary w-full"
            disabled={busy}
            onClick={() =>
              run(() =>
                api.assessWarranty(r.id, {
                  coverage,
                  assessment_notes: assessNotes || undefined,
                  decline_reason: declineReason || undefined,
                }),
              )
            }
          >
            {declineReason ? "Decline claim" : "Record assessment"}
          </button>
        </div>
      )}

      {["resolved", "in_progress", "triaged"].includes(r.status) && (
        <button className="btn btn-ghost w-full border" style={{ borderColor: "var(--border)" }} disabled={busy} onClick={() => run(() => api.closeWarranty(r.id))}>
          Close claim
        </button>
      )}

      {terminal && (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          This claim is {r.status}. No further action.
        </p>
      )}
    </Card>
  );
}

function CoverageCard({ jobId }: { jobId: string }) {
  const coverage = useAsync(() => api.warrantyCoverage(jobId), [jobId]);
  const c = coverage.data;

  return (
    <Card title="Warranty cover">
      {coverage.loading ? (
        <Loading />
      ) : !c ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>Not available.</p>
      ) : c.closing_date == null ? (
        <p className="text-sm" style={{ color: "var(--fg-subtle)" }}>
          This home has no completion date yet, so cover cannot be measured.
        </p>
      ) : (
        <>
          <Row label="Completed">{day(c.closing_date)}</Row>
          <Row label="Defects (2 yr)">
            <span style={{ color: c.defects_active ? "var(--ok)" : "var(--danger)" }}>
              {day(c.defects_until)} {c.defects_active ? "· active" : "· expired"}
            </span>
          </Row>
          <Row label="Structural (10 yr)">
            <span style={{ color: c.structural_active ? "var(--ok)" : "var(--danger)" }}>
              {day(c.structural_until)} {c.structural_active ? "· active" : "· expired"}
            </span>
          </Row>
          <p className="mt-3 border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--fg-subtle)" }}>
            NHBC-style Buildmark windows from legal completion.
          </p>
        </>
      )}
    </Card>
  );
}
