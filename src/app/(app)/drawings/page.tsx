"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
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
  Tabs,
  day,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { Drawing, DrawingSet, Specification, TransmittalPurpose } from "@/types/api";

const TABS = ["Drawing sets", "Specifications", "Transmittals"] as const;
type Tab = (typeof TABS)[number];

const DISCIPLINES = [
  "architectural",
  "structural",
  "mechanical",
  "electrical",
  "plumbing",
  "civil",
  "landscape",
  "other",
];

const PURPOSES: TransmittalPurpose[] = [
  "for_construction",
  "for_review",
  "for_approval",
  "for_information",
  "for_record",
];

function purposeLabel(p: string) {
  return titleCase(p.replace(/^for_/, "For "));
}

export default function DrawingsPage() {
  const summary = useAsync(() => api.drawingsSummary(), []);
  const sets = useAsync(() => api.listDrawingSets(), []);
  const specs = useAsync(() => api.listSpecifications(), []);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const transmittals = useAsync(
    () => api.listTransmittals({ overdue_only: overdueOnly || undefined }),
    [overdueOnly],
  );
  const plans = useAsync(() => api.listPlans(), []);
  const communities = useAsync(() => api.listCommunities(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const jobs = useAsync(() => api.jobOptions(), []);

  const [tab, setTab] = useState<Tab>("Drawing sets");
  const [newSet, setNewSet] = useState(false);
  const [editSet, setEditSet] = useState<DrawingSet | null>(null);
  const [sheetFor, setSheetFor] = useState<DrawingSet | null>(null);
  const [editSheet, setEditSheet] = useState<{ set: DrawingSet; sheet: Drawing } | null>(null);
  const [newSpec, setNewSpec] = useState(false);
  const [revising, setRevising] = useState<Specification | null>(null);
  const [newTransmittal, setNewTransmittal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const plan = byId(plans.data);
  const vendor = byId(vendors.data);
  const code = byId(codes.data);

  const setRows = sets.data ?? [];
  const s = summary.data;

  function refreshAll() {
    sets.reload();
    summary.reload();
  }
  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  async function createSet(form: FormData) {
    setError(null);
    try {
      await api.createDrawingSet({
        name: String(form.get("name")),
        plan_id: String(form.get("plan_id") || "") || undefined,
        community_id: String(form.get("community_id") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      setNewSet(false);
      refreshAll();
    } catch (err) {
      fail(err, "Could not create the set");
    }
  }

  async function saveSet(form: FormData) {
    if (!editSet) return;
    setError(null);
    try {
      await api.updateDrawingSet(editSet.id, {
        name: String(form.get("name")),
        plan_id: String(form.get("plan_id") || "") || undefined,
        community_id: String(form.get("community_id") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      setEditSet(null);
      refreshAll();
    } catch (err) {
      fail(err, "Could not save the set");
    }
  }

  async function addSheet(form: FormData) {
    if (!sheetFor) return;
    setError(null);
    try {
      await api.addDrawing(sheetFor.id, {
        sheet_number: String(form.get("sheet_number")),
        title: String(form.get("title")),
        discipline: String(form.get("discipline") || "architectural"),
        notes: String(form.get("notes") || "") || undefined,
      });
      setSheetFor(null);
      refreshAll();
    } catch (err) {
      fail(err, "Could not add the sheet");
    }
  }

  async function saveSheet(form: FormData) {
    if (!editSheet) return;
    setError(null);
    try {
      await api.updateDrawing(editSheet.set.id, editSheet.sheet.id, {
        sheet_number: String(form.get("sheet_number")),
        title: String(form.get("title")),
        discipline: String(form.get("discipline")),
        notes: String(form.get("notes") || "") || undefined,
      });
      setEditSheet(null);
      refreshAll();
    } catch (err) {
      fail(err, "Could not save the sheet");
    }
  }

  async function removeSheet(set: DrawingSet, sheet: Drawing) {
    setError(null);
    try {
      await api.removeDrawing(set.id, sheet.id);
      refreshAll();
    } catch (err) {
      fail(err, "Could not remove the sheet");
    }
  }

  async function run(fn: () => Promise<unknown>, msg: string | null, fallback: string) {
    setError(null);
    try {
      await fn();
      if (msg) setNote(msg);
      refreshAll();
      transmittals.reload();
    } catch (err) {
      fail(err, fallback);
    }
  }

  async function createSpec(form: FormData) {
    setError(null);
    try {
      await api.createSpecification({
        section: String(form.get("section")),
        title: String(form.get("title")),
        body: String(form.get("body") || "") || undefined,
        plan_id: String(form.get("plan_id") || "") || undefined,
        cost_code_id: String(form.get("cost_code_id") || "") || undefined,
        issue_now: form.get("issue_now") !== null,
      });
      setNewSpec(false);
      specs.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not create the specification");
    }
  }

  async function reviseSpec(form: FormData) {
    if (!revising) return;
    setError(null);
    try {
      const next = await api.reviseSpecification(revising.id, {
        title: String(form.get("title") || "") || undefined,
        body: String(form.get("body") || "") || undefined,
      });
      setNote(
        `${next.section} is now revision ${next.revision}. Revision ${revising.revision} is superseded but kept as the record of what trades priced against.`,
      );
      setRevising(null);
      specs.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not revise the specification");
    }
  }

  async function createTransmittal(form: FormData) {
    setError(null);
    const vendorIds = form.getAll("vendor_ids").map(String);
    if (vendorIds.length === 0) {
      setError("Choose at least one recipient — a transmittal with nobody on it proves nothing.");
      return;
    }
    try {
      await api.createTransmittal({
        subject: String(form.get("subject")),
        purpose: String(form.get("purpose") || "for_construction"),
        vendor_ids: vendorIds,
        message: String(form.get("message") || "") || undefined,
        drawing_set_id: String(form.get("drawing_set_id") || "") || undefined,
        specification_id: String(form.get("specification_id") || "") || undefined,
        job_id: String(form.get("job_id") || "") || undefined,
        response_due: String(form.get("response_due") || "") || undefined,
      });
      setNewTransmittal(false);
      transmittals.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not send the transmittal");
    }
  }

  async function acknowledge(tId: string, vendorId: string) {
    setError(null);
    try {
      await api.acknowledgeTransmittal(tId, vendorId);
      transmittals.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not record the acknowledgement");
    }
  }

  const newAction =
    tab === "Drawing sets"
      ? { label: "New drawing set", run: () => setNewSet(true) }
      : tab === "Specifications"
        ? { label: "New specification", run: () => setNewSpec(true) }
        : { label: "New transmittal", run: () => setNewTransmittal(true) };

  return (
    <>
      <PageHeader
        title="Drawings & specifications"
        subtitle="Issued drawing sets and specs supersede each other rather than being overwritten, because a superseded revision is the evidence of what a trade priced and built from. A transmittal proves they were told."
        action={
          <button className="btn btn-primary" onClick={newAction.run}>
            {newAction.label}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Live sets" value={s?.live_sets ?? "—"} tone="ok" hint="Build from these" />
        <StatTile label="Superseded" value={s?.superseded_sets ?? "—"} hint="Kept as evidence" />
        <StatTile label="Specifications" value={s?.specifications ?? "—"} hint="Current sections" />
        <StatTile
          label="Overdue transmittals"
          value={s?.overdue_transmittals ?? "—"}
          tone={s?.overdue_transmittals ? "danger" : "ok"}
          hint="Past due, unconfirmed"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Draft sets" value={s?.draft_sets ?? "—"} hint="Not yet issued" />
        <StatTile label="Live sheets" value={s?.total_sheets ?? "—"} hint="Across issued sets" />
        <StatTile
          label="Unacknowledged"
          value={s?.unacknowledged ?? "—"}
          tone={s?.unacknowledged ? "warn" : "ok"}
          hint="Trades yet to confirm"
        />
        <StatTile label="Draft specs" value={s?.draft_specs ?? "—"} hint="Not yet issued" />
      </div>

      {note && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
        >
          {note}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      <Tabs
        tabs={TABS}
        active={tab}
        onChange={setTab}
        counts={{ Transmittals: s?.unacknowledged ?? 0 }}
      />

      {tab === "Drawing sets" &&
        (sets.loading ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            {setRows.length === 0 ? (
              <Card>
                <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                  No drawing sets yet.
                </p>
              </Card>
            ) : (
              setRows.map((set) => (
                <Card
                  key={set.id}
                  title={`${set.set_number} — ${set.name}`}
                  padded={false}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">rev {set.revision}</Badge>
                      <StatusBadge status={set.status} />
                      {set.plan_id && <Badge tone="brand">{plan.get(set.plan_id)?.name ?? "Plan"}</Badge>}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpanded(expanded === set.id ? null : set.id)}
                      >
                        {expanded === set.id ? "Hide sheets" : `${set.sheet_count} sheets`}
                      </button>
                      {set.status === "draft" && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditSet(set)}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setSheetFor(set)}>
                            Add sheet
                          </button>
                          <Button variant="primary" size="sm" onClick={() => run(() => api.issueDrawingSet(set.id), `${set.set_number} is issued — this is now what trades should build from.`, "Could not issue")}>
                            Issue
                          </Button>
                        </>
                      )}
                      {set.status === "issued" && (
                        <Button variant="ghost" size="sm" onClick={() => run(() => api.reviseDrawingSet(set.id), `Revision created. Revision ${set.revision} is superseded but kept as evidence.`, "Could not revise")}>
                          Revise
                        </Button>
                      )}
                      {set.status !== "superseded" && set.status !== "void" && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--danger)" }}
                          onClick={() => run(() => api.voidDrawingSet(set.id), null, "Could not void")}
                        >
                          Void
                        </button>
                      )}
                    </div>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
                    {Object.entries(set.disciplines).map(([disc, n]) => (
                      <Badge key={disc} tone="neutral">
                        {titleCase(disc)} · {n}
                      </Badge>
                    ))}
                    {set.sheet_count === 0 && (
                      <span className="text-sm" style={{ color: "var(--fg-subtle)" }}>
                        No sheets yet.
                      </span>
                    )}
                  </div>
                  {expanded === set.id && (
                    <div className="mt-2">
                      <DataTable
                        columns={[
                          { key: "sheet", label: "Sheet" },
                          { key: "title", label: "Title" },
                          { key: "disc", label: "Discipline" },
                          { key: "notes", label: "Notes" },
                          { key: "act", label: "" },
                        ]}
                        empty="No sheets in this set yet."
                      >
                        {set.drawings.map((d) => (
                          <tr key={d.id}>
                            <td className="tnum font-medium">{d.sheet_number}</td>
                            <td>{d.title}</td>
                            <td>{titleCase(d.discipline)}</td>
                            <td style={{ color: "var(--fg-muted)" }}>{d.notes ?? "—"}</td>
                            <td>
                              {set.status === "draft" && (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setEditSheet({ set, sheet: d })}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: "var(--danger)" }}
                                    onClick={() => void removeSheet(set, d)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>
                  )}
                  {expanded !== set.id && (
                    <div className="px-5 py-3 text-sm" style={{ color: "var(--fg-muted)" }}>
                      {set.status === "superseded"
                        ? "Superseded — kept so it can be shown what this trade was working from."
                        : set.status === "void"
                          ? "Void — withdrawn before it was built from."
                          : set.issued_on
                            ? `Issued ${day(set.issued_on)}`
                            : "Draft — not yet released to trades."}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        ))}

      {tab === "Specifications" && (
        <Card title="Specification sections" padded={false}>
          {specs.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "sec", label: "Section" },
                { key: "title", label: "Title" },
                { key: "plan", label: "Plan" },
                { key: "code", label: "Cost code" },
                { key: "rev", label: "Rev", align: "right" },
                { key: "status", label: "Status" },
                { key: "act", label: "" },
              ]}
              empty="No specifications yet."
            >
              {(specs.data ?? []).map((sp) => (
                <tr key={sp.id}>
                  <td className="tnum font-medium">
                    {sp.section}
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      Div {sp.division}
                    </div>
                  </td>
                  <td>
                    <div>{sp.title}</div>
                    {sp.body && (
                      <div className="mt-0.5 max-w-xl text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {sp.body.slice(0, 140)}
                        {sp.body.length > 140 ? "…" : ""}
                      </div>
                    )}
                  </td>
                  <td>{sp.plan_id ? (plan.get(sp.plan_id)?.name ?? "—") : "—"}</td>
                  <td>{sp.cost_code_id ? (code.get(sp.cost_code_id)?.code ?? "—") : "—"}</td>
                  <td className="num tnum">{sp.revision}</td>
                  <td>
                    <StatusBadge status={sp.status} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      {sp.status === "draft" && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            run(() => api.issueSpecification(sp.id), `${sp.section} issued.`, "Could not issue")
                          }
                        >
                          Issue
                        </button>
                      )}
                      {sp.status === "issued" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setRevising(sp)}>
                          Revise
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {tab === "Transmittals" && (
        <div className="space-y-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            Overdue only
          </label>
          {transmittals.loading ? (
            <Loading />
          ) : (transmittals.data ?? []).length === 0 ? (
            <Card>
              <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                {overdueOnly ? "No overdue transmittals." : "Nothing has been transmitted yet."}
              </p>
            </Card>
          ) : (
            (transmittals.data ?? []).map((t) => (
              <Card
                key={t.id}
                title={`${t.transmittal_number} — ${t.subject}`}
                padded={false}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{purposeLabel(t.purpose)}</Badge>
                    {t.is_overdue && <Badge tone="danger">Overdue</Badge>}
                    <Badge tone={t.outstanding ? "warn" : "ok"}>
                      {t.acknowledged_count}/{t.recipients.length} acknowledged
                    </Badge>
                    {t.sent_on && <span className="text-xs">Sent {day(t.sent_on)}</span>}
                    {t.response_due && (
                      <span className="text-xs" style={{ color: t.is_overdue ? "var(--danger)" : "var(--fg-subtle)" }}>
                        Due {day(t.response_due)}
                      </span>
                    )}
                  </div>
                }
              >
                <DataTable
                  columns={[
                    { key: "who", label: "Recipient" },
                    { key: "ack", label: "Acknowledged" },
                    { key: "act", label: "" },
                  ]}
                  empty="No recipients."
                >
                  {t.recipients.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium">{vendor.get(r.vendor_id)?.name ?? "Trade"}</td>
                      <td>
                        {r.acknowledged_at ? (
                          <Badge tone="ok">{day(r.acknowledged_at)}</Badge>
                        ) : (
                          <Badge tone="warn">Outstanding</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          {!r.acknowledged_at && (
                            <Button variant="ghost" size="sm" onClick={() => acknowledge(t.id, r.vendor_id)}>
                              Record receipt
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </Card>
            ))
          )}
        </div>
      )}

      {/* --- modals --- */}

      <Modal open={newSet} title="New drawing set" onClose={() => setNewSet(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void createSet(new FormData(e.currentTarget));
          }}
        >
          <Field label="Name">
            <input name="name" className="input" required placeholder="Maple — construction issue" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan">
              <select name="plan_id" className="input" defaultValue="">
                <option value="">None</option>
                {(plans.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Community">
              <select name="community_id" className="input" defaultValue="">
                <option value="">None</option>
                {(communities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" className="input" rows={2} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewSet(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editSet !== null}
        title={`Edit ${editSet?.set_number ?? ""}`}
        onClose={() => setEditSet(null)}
      >
        {editSet && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSet(new FormData(e.currentTarget));
            }}
          >
            <Field label="Name">
              <input name="name" className="input" required defaultValue={editSet.name} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan">
                <select name="plan_id" className="input" defaultValue={editSet.plan_id ?? ""}>
                  <option value="">None</option>
                  {(plans.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Community">
                <select name="community_id" className="input" defaultValue={editSet.community_id ?? ""}>
                  <option value="">None</option>
                  {(communities.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea name="notes" className="input" rows={2} defaultValue={editSet.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditSet(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={sheetFor !== null}
        title={`Add a sheet to ${sheetFor?.set_number ?? ""}`}
        onClose={() => setSheetFor(null)}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void addSheet(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sheet number">
              <input name="sheet_number" className="input" required placeholder="A-101" />
            </Field>
            <Field label="Discipline">
              <select name="discipline" className="input" defaultValue="architectural">
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {titleCase(d)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title">
            <input name="title" className="input" required placeholder="Ground floor plan" />
          </Field>
          <Field label="Notes">
            <input name="notes" className="input" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setSheetFor(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add sheet
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editSheet !== null}
        title={`Edit ${editSheet?.sheet.sheet_number ?? "sheet"}`}
        onClose={() => setEditSheet(null)}
      >
        {editSheet && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveSheet(new FormData(e.currentTarget));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sheet number">
                <input name="sheet_number" className="input" required defaultValue={editSheet.sheet.sheet_number} />
              </Field>
              <Field label="Discipline">
                <select name="discipline" className="input" defaultValue={editSheet.sheet.discipline}>
                  {DISCIPLINES.map((d) => (
                    <option key={d} value={d}>
                      {titleCase(d)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Title">
              <input name="title" className="input" required defaultValue={editSheet.sheet.title} />
            </Field>
            <Field label="Notes">
              <input name="notes" className="input" defaultValue={editSheet.sheet.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditSheet(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={newSpec} title="New specification" onClose={() => setNewSpec(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void createSpec(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section">
              <input name="section" className="input" required placeholder="09 30 00" />
            </Field>
            <Field label="Cost code" hint="Ties the spec to the budget line.">
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
          <Field label="Title">
            <input name="title" className="input" required placeholder="Tiling" />
          </Field>
          <Field label="Plan">
            <select name="plan_id" className="input" defaultValue="">
              <option value="">None</option>
              {(plans.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Body">
            <textarea name="body" className="input" rows={5} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="issue_now" defaultChecked />
            Issue now (otherwise saved as a draft)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewSpec(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={revising !== null}
        title={`Revise ${revising?.section ?? ""} — rev ${(revising?.revision ?? 0) + 1}`}
        onClose={() => setRevising(null)}
      >
        {revising && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void reviseSpec(new FormData(e.currentTarget));
            }}
          >
            <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              Revision {revising.revision} is kept as the record of what trades priced against.
              Anything you leave unchanged carries forward.
            </p>
            <Field label="Title">
              <input name="title" className="input" defaultValue={revising.title} />
            </Field>
            <Field label="Body">
              <textarea name="body" className="input" rows={5} defaultValue={revising.body ?? ""} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setRevising(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create revision
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={newTransmittal} title="New transmittal" onClose={() => setNewTransmittal(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void createTransmittal(new FormData(e.currentTarget));
          }}
        >
          <Field label="Subject">
            <input name="subject" className="input" required placeholder="Revised structural drawings" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Purpose" hint="Why it is being sent.">
              <select name="purpose" className="input" defaultValue="for_construction">
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {purposeLabel(p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Home">
              <select name="job_id" className="input" defaultValue="">
                <option value="">Not home-specific</option>
                {(jobs.data ?? []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_number}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Drawing set">
              <select name="drawing_set_id" className="input" defaultValue="">
                <option value="">None</option>
                {setRows.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.set_number} rev {set.revision} — {set.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Specification">
              <select name="specification_id" className="input" defaultValue="">
                <option value="">None</option>
                {(specs.data ?? [])
                  .filter((sp) => sp.is_current)
                  .map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.section} — {sp.title}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <Field label="Recipients" hint="Hold Ctrl or Cmd to pick several.">
            <select name="vendor_ids" className="input" multiple size={5} required>
              {(vendors.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Response due">
            <input name="response_due" type="date" className="input" />
          </Field>
          <Field label="Message">
            <textarea name="message" className="input" rows={3} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewTransmittal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
