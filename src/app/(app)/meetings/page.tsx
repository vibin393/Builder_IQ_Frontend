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
import type { Correspondence, Meeting, MeetingItem, MeetingType } from "@/types/api";

const TABS = ["Meetings", "Correspondence"] as const;
type Tab = (typeof TABS)[number];

const KINDS = ["letter", "notice", "email", "phone_call", "site_instruction", "other"];

const TYPES: MeetingType[] = [
  "pre_construction",
  "coordination",
  "oac",
  "progress",
  "pre_install",
  "safety",
  "handover",
  "other",
];

function typeLabel(t: string) {
  if (t === "oac") return "OAC";
  return titleCase(t);
}

export default function MeetingsPage() {
  const summary = useAsync(() => api.meetingsSummary(), []);
  const meetings = useAsync(() => api.listMeetings(), []);
  const [awaitingOnly, setAwaitingOnly] = useState(false);
  const correspondence = useAsync(
    () => api.listCorrespondence({ awaiting_only: awaitingOnly || undefined }),
    [awaitingOnly],
  );
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);

  const [tab, setTab] = useState<Tab>("Meetings");
  const [newMeeting, setNewMeeting] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [itemFor, setItemFor] = useState<Meeting | null>(null);
  const [editItem, setEditItem] = useState<{ meeting: Meeting; item: MeetingItem } | null>(null);
  const [newLetter, setNewLetter] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const job = byId(jobs.data);
  const vendor = byId(vendors.data);

  const rows = meetings.data ?? [];
  const s = summary.data;

  function refresh() {
    meetings.reload();
    summary.reload();
  }
  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }
  async function run(fn: () => Promise<unknown>, fallback: string, msg?: string) {
    setError(null);
    try {
      await fn();
      if (msg) setNote(msg);
      refresh();
    } catch (err) {
      fail(err, fallback);
    }
  }

  async function create(form: FormData) {
    setError(null);
    try {
      await api.createMeeting({
        title: String(form.get("title")),
        meeting_type: String(form.get("meeting_type") || "coordination"),
        job_id: String(form.get("job_id") || "") || undefined,
        meeting_date: String(form.get("meeting_date") || "") || undefined,
        location: String(form.get("location") || "") || undefined,
        attendees: String(form.get("attendees") || "") || undefined,
      });
      setNewMeeting(false);
      refresh();
    } catch (err) {
      fail(err, "Could not create the meeting");
    }
  }

  async function saveMeeting(form: FormData) {
    if (!editMeeting) return;
    setError(null);
    try {
      await api.updateMeeting(editMeeting.id, {
        title: String(form.get("title")),
        meeting_type: String(form.get("meeting_type")),
        meeting_date: String(form.get("meeting_date") || "") || undefined,
        location: String(form.get("location") || "") || undefined,
        attendees: String(form.get("attendees") || "") || undefined,
        notes: String(form.get("notes") || "") || undefined,
      });
      setEditMeeting(null);
      refresh();
    } catch (err) {
      fail(err, "Could not save the meeting");
    }
  }

  async function addItem(form: FormData) {
    if (!itemFor) return;
    setError(null);
    try {
      await api.addMeetingItem(itemFor.id, {
        topic: String(form.get("topic")),
        discussion: String(form.get("discussion") || "") || undefined,
        is_action: form.get("is_action") === "on",
        due_on: String(form.get("due_on") || "") || undefined,
      });
      setItemFor(null);
      refresh();
    } catch (err) {
      fail(err, "Could not add the item");
    }
  }

  async function saveItem(form: FormData) {
    if (!editItem) return;
    setError(null);
    try {
      await api.updateMeetingItem(editItem.meeting.id, editItem.item.id, {
        topic: String(form.get("topic")),
        discussion: String(form.get("discussion") || "") || undefined,
        is_action: form.get("is_action") === "on",
        due_on: String(form.get("due_on") || "") || undefined,
      });
      setEditItem(null);
      refresh();
    } catch (err) {
      fail(err, "Could not save the item");
    }
  }

  async function logLetter(form: FormData) {
    setError(null);
    try {
      await api.createCorrespondence({
        subject: String(form.get("subject")),
        body: String(form.get("body") || "") || undefined,
        kind: String(form.get("kind") || "letter"),
        direction: String(form.get("direction") || "outbound"),
        job_id: String(form.get("job_id") || "") || undefined,
        vendor_id: String(form.get("vendor_id") || "") || undefined,
        occurred_on: String(form.get("occurred_on") || "") || undefined,
        requires_response: form.get("requires_response") === "on",
        response_due: String(form.get("response_due") || "") || undefined,
      });
      setNewLetter(false);
      correspondence.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not log the correspondence");
    }
  }

  async function respond(c: Correspondence) {
    setError(null);
    try {
      await api.respondCorrespondence(c.id);
      correspondence.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not record the reply");
    }
  }

  const newAction =
    tab === "Meetings"
      ? { label: "Schedule a meeting", run: () => setNewMeeting(true) }
      : { label: "Log correspondence", run: () => setNewLetter(true) };

  return (
    <>
      <PageHeader
        title="Meetings & correspondence"
        subtitle="Agenda, minutes and the actions that came out of them, each with an owner and a date — and carried into the next meeting until they are done. Correspondence is the audit trail of what was formally said to whom."
        action={
          <button className="btn btn-primary" onClick={newAction.run}>
            {newAction.label}
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Meetings" value={s?.meetings ?? "—"} />
        <StatTile label="Scheduled" value={s?.scheduled ?? "—"} hint="Still to hold" />
        <StatTile
          label="Open actions"
          value={s?.open_actions ?? "—"}
          tone={s?.overdue_actions ? "danger" : s?.open_actions ? "warn" : "ok"}
          hint={s?.overdue_actions ? `${s.overdue_actions} overdue` : "Agreed but not done"}
        />
        <StatTile
          label="Correspondence"
          value={s?.correspondence ?? "—"}
          tone={s?.awaiting_response ? "warn" : "default"}
          hint={s?.awaiting_response ? `${s.awaiting_response} awaiting reply` : "Logged"}
        />
      </div>

      {note && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
          {note}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} counts={{ Meetings: s?.open_actions ?? 0 }} />

      {tab === "Meetings" &&
        (meetings.loading ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            {rows.length === 0 ? (
              <Card>
                <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                  No meetings yet.
                </p>
              </Card>
            ) : (
              rows.map((m) => (
                <Card
                  key={m.id}
                  title={m.title}
                  padded={false}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{typeLabel(m.meeting_type)}</Badge>
                      {m.job_id && <Badge tone="neutral">{job.get(m.job_id)?.job_number ?? "Home"}</Badge>}
                      {m.meeting_date && <span className="text-xs">{day(m.meeting_date)}</span>}
                      <StatusBadge status={m.status} />
                      {m.overdue_actions > 0 ? (
                        <Badge tone="danger">{m.overdue_actions} overdue</Badge>
                      ) : m.open_actions > 0 ? (
                        <Badge tone="warn">{m.open_actions} open</Badge>
                      ) : null}
                      {m.previous_meeting_id && <Badge tone="brand">Follow-up</Badge>}
                      {m.status !== "cancelled" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setItemFor(m)}>
                          Add item
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                      >
                        {expanded === m.id ? "Hide" : `${m.item_count} items`}
                      </button>
                      {m.status === "scheduled" && (
                        <Button variant="primary" size="sm" onClick={() => run(() => api.holdMeeting(m.id), "Could not mark held")}>
                          Mark held
                        </Button>
                      )}
                      {m.status === "scheduled" && (
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => run(() => api.cancelMeeting(m.id), "Could not cancel")}>
                          Cancel
                        </button>
                      )}
                      {m.status !== "cancelled" && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditMeeting(m)}>
                          Edit
                        </button>
                      )}
                      {m.status === "held" && m.open_actions > 0 && (
                        <button
                          className="btn btn-ghost btn-sm border"
                          style={{ borderColor: "var(--border)" }}
                          onClick={() =>
                            run(
                              () => api.followUpMeeting(m.id),
                              "Could not schedule the follow-up",
                              `Follow-up scheduled — ${m.open_actions} open action${m.open_actions === 1 ? "" : "s"} carried forward.`,
                            )
                          }
                        >
                          Schedule follow-up
                        </button>
                      )}
                    </div>
                  }
                >
                  {expanded === m.id ? (
                    <DataTable
                      columns={[
                        { key: "n", label: "#", align: "right" },
                        { key: "topic", label: "Topic" },
                        { key: "kind", label: "Kind" },
                        { key: "due", label: "Due" },
                        { key: "done", label: "Completed" },
                        { key: "act", label: "" },
                      ]}
                      empty="No agenda items yet."
                    >
                      {m.items.map((it) => (
                        <tr key={it.id} style={it.is_overdue ? { background: "var(--danger-soft)" } : undefined}>
                          <td className="num tnum">{it.sequence}</td>
                          <td>
                            <div className="font-medium">{it.topic}</div>
                            {it.discussion && (
                              <div className="mt-0.5 max-w-xl text-xs" style={{ color: "var(--fg-muted)" }}>
                                {it.discussion}
                              </div>
                            )}
                            {it.carried_from_id && (
                              <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                                Carried from a previous meeting
                              </div>
                            )}
                          </td>
                          <td>{it.is_action ? <Badge tone="warn">Action</Badge> : <Badge>Discussion</Badge>}</td>
                          <td>
                            <span style={{ color: it.is_overdue ? "var(--danger)" : undefined }}>{day(it.due_on)}</span>
                          </td>
                          <td>{it.completed_on ? <Badge tone="ok">{day(it.completed_on)}</Badge> : "—"}</td>
                          <td>
                            <div className="flex justify-end gap-1.5">
                              {it.is_action &&
                                (it.completed_on ? (
                                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.reopenMeetingAction(it.id), "Could not reopen")}>
                                    Reopen
                                  </button>
                                ) : (
                                  <button className="btn btn-primary btn-sm" onClick={() => run(() => api.completeMeetingAction(it.id), "Could not complete")}>
                                    Done
                                  </button>
                                ))}
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditItem({ meeting: m, item: it })}>
                                Edit
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => run(() => api.removeMeetingItem(m.id, it.id), "Could not remove")}>
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </DataTable>
                  ) : (
                    <div className="px-5 py-3 text-sm" style={{ color: "var(--fg-muted)" }}>
                      {[m.location, m.attendees].filter(Boolean).join(" · ") || "No location or attendees recorded."}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        ))}

      {tab === "Correspondence" && (
        <div className="space-y-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={awaitingOnly} onChange={(e) => setAwaitingOnly(e.target.checked)} />
            Awaiting a reply only
          </label>
          <Card title="Correspondence log" padded={false}>
            {correspondence.loading ? (
              <Loading />
            ) : (
              <DataTable
                columns={[
                  { key: "date", label: "Date" },
                  { key: "subject", label: "Subject" },
                  { key: "kind", label: "Kind" },
                  { key: "dir", label: "Direction" },
                  { key: "home", label: "Home" },
                  { key: "reply", label: "Reply" },
                  { key: "act", label: "" },
                ]}
                empty="Nothing logged yet."
              >
                {(correspondence.data ?? []).map((c) => (
                  <tr key={c.id} style={c.is_overdue ? { background: "var(--danger-soft)" } : undefined}>
                    <td>{day(c.occurred_on)}</td>
                    <td>
                      <div className="font-medium">{c.subject}</div>
                      {c.body && (
                        <div className="mt-0.5 max-w-xl text-xs" style={{ color: "var(--fg-muted)" }}>
                          {c.body.slice(0, 160)}
                          {c.body.length > 160 ? "…" : ""}
                        </div>
                      )}
                    </td>
                    <td>{titleCase(c.kind)}</td>
                    <td>
                      <Badge tone={c.direction === "inbound" ? "brand" : "neutral"}>{titleCase(c.direction)}</Badge>
                    </td>
                    <td>{c.job_id ? (job.get(c.job_id)?.job_number ?? "—") : "—"}</td>
                    <td>
                      {!c.requires_response ? (
                        <span style={{ color: "var(--fg-subtle)" }}>—</span>
                      ) : c.responded_on ? (
                        <Badge tone="ok">Replied {day(c.responded_on)}</Badge>
                      ) : (
                        <Badge tone={c.is_overdue ? "danger" : "warn"}>
                          {c.response_due ? `Due ${day(c.response_due)}` : "Awaiting"}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {c.is_awaiting_response && (
                          <Button variant="ghost" size="sm" onClick={() => respond(c)}>
                            Mark replied
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      )}

      {/* --- modals --- */}

      <Modal open={newMeeting} title="Schedule a meeting" onClose={() => setNewMeeting(false)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create(new FormData(e.currentTarget)); }}>
          <Field label="Title">
            <input name="title" className="input" required placeholder="Weekly trade coordination" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select name="meeting_type" className="input" defaultValue="coordination">
                {TYPES.map((t) => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input name="meeting_date" type="date" className="input" />
            </Field>
          </div>
          <Field label="Home">
            <select name="job_id" className="input" defaultValue="">
              <option value="">Not home-specific</option>
              {(jobs.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>{j.job_number}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input name="location" className="input" placeholder="Site office" />
          </Field>
          <Field label="Attendees">
            <textarea name="attendees" className="input" rows={2} placeholder="Names, comma separated" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewMeeting(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Schedule</button>
          </div>
        </form>
      </Modal>

      <Modal open={editMeeting !== null} title={`Edit ${editMeeting?.title ?? ""}`} onClose={() => setEditMeeting(null)}>
        {editMeeting && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveMeeting(new FormData(e.currentTarget)); }}>
            <Field label="Title">
              <input name="title" className="input" required defaultValue={editMeeting.title} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <select name="meeting_type" className="input" defaultValue={editMeeting.meeting_type}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input name="meeting_date" type="date" className="input" defaultValue={editMeeting.meeting_date ?? ""} />
              </Field>
            </div>
            <Field label="Location">
              <input name="location" className="input" defaultValue={editMeeting.location ?? ""} />
            </Field>
            <Field label="Attendees">
              <textarea name="attendees" className="input" rows={2} defaultValue={editMeeting.attendees ?? ""} />
            </Field>
            <Field label="Minutes / notes">
              <textarea name="notes" className="input" rows={3} defaultValue={editMeeting.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditMeeting(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={itemFor !== null} title={`Add an item to ${itemFor?.title ?? ""}`} onClose={() => setItemFor(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void addItem(new FormData(e.currentTarget)); }}>
          <Field label="Topic">
            <input name="topic" className="input" required />
          </Field>
          <Field label="Discussion">
            <textarea name="discussion" className="input" rows={3} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_action" /> This is an action someone owes, not just a discussion
          </label>
          <Field label="Due">
            <input name="due_on" type="date" className="input" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setItemFor(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      <Modal open={editItem !== null} title="Edit item" onClose={() => setEditItem(null)}>
        {editItem && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void saveItem(new FormData(e.currentTarget)); }}>
            <Field label="Topic">
              <input name="topic" className="input" required defaultValue={editItem.item.topic} />
            </Field>
            <Field label="Discussion">
              <textarea name="discussion" className="input" rows={3} defaultValue={editItem.item.discussion ?? ""} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_action" defaultChecked={editItem.item.is_action} /> This is an action someone owes
            </label>
            <Field label="Due">
              <input name="due_on" type="date" className="input" defaultValue={editItem.item.due_on ?? ""} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditItem(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={newLetter} title="Log correspondence" onClose={() => setNewLetter(false)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void logLetter(new FormData(e.currentTarget)); }}>
          <Field label="Subject">
            <input name="subject" className="input" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind">
              <select name="kind" className="input" defaultValue="letter">
                {KINDS.map((k) => (
                  <option key={k} value={k}>{titleCase(k)}</option>
                ))}
              </select>
            </Field>
            <Field label="Direction">
              <select name="direction" className="input" defaultValue="outbound">
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Home">
              <select name="job_id" className="input" defaultValue="">
                <option value="">Not home-specific</option>
                {(jobs.data ?? []).map((j) => (
                  <option key={j.id} value={j.id}>{j.job_number}</option>
                ))}
              </select>
            </Field>
            <Field label="Trade">
              <select name="vendor_id" className="input" defaultValue="">
                <option value="">None</option>
                {(vendors.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <input name="occurred_on" type="date" className="input" />
            </Field>
            <Field label="Response due" hint="If a reply is expected.">
              <input name="response_due" type="date" className="input" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requires_response" /> This demands a reply — track it until answered
          </label>
          <Field label="Body">
            <textarea name="body" className="input" rows={4} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewLetter(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Log</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
