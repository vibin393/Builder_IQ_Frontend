"use client";

/**
 * One lead, in full.
 *
 * The list is for scanning a pipeline; this is for working one person, and it
 * answers a different question - "what do I need to know before I ring them". So
 * the layout follows a phone call rather than the database:
 *
 *  - **the header carries what you say out loud**: their name, whether they are
 *    hot, whether they can actually buy, and the number to dial.
 *  - **the trail is the main column**, because the first thing anybody does before
 *    ringing is read what happened last time. Logging a touch sits at the top of
 *    it rather than in a separate card, since reading and adding are one motion.
 *  - **what they want and whether they can pay are side panels**, read once and
 *    referred back to.
 *  - **the endings are explained, not just flagged.** A lost lead shows the reason
 *    and who won it; a converted one shows what its source is now attributed to.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  ErrorNote,
  Field,
  Loading,
  Menu,
  Modal,
  PageHeader,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { ActivityType, LeadDetail, LeadRating, LeadSource } from "@/types/api";

const TOUCHES: { type: ActivityType; label: string }[] = [
  { type: "call", label: "Call" },
  { type: "email", label: "Email" },
  { type: "text", label: "Text" },
  { type: "visit", label: "Site visit" },
  { type: "appointment", label: "Appointment" },
  { type: "note", label: "Note" },
];

const SOURCES: LeadSource[] = [
  "website",
  "walk_in",
  "referral",
  "realtor",
  "portal",
  "campaign",
  "signage",
  "social",
  "event",
  "other",
];

function ratingColour(rating: LeadRating) {
  return rating === "hot" ? "var(--danger)" : rating === "warm" ? "var(--warn)" : "var(--fg-subtle)";
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const lead = useAsync(() => api.getLead(id), [id]);
  const activities = useAsync(() => api.listLeadActivities(id), [id]);
  const dupes = useAsync(() => api.leadDuplicates(id), [id]);
  const communities = useAsync(() => api.listCommunities(), []);
  const realtors = useAsync(() => api.listRealtors(), []);
  const staff = useAsync(() => api.listUsers().then((p) => p.items), []);

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (lead.loading) return <Loading label="Loading lead" />;
  if (lead.error) return <ErrorNote message={lead.error} />;
  if (!lead.data) return null;

  const l = lead.data;
  const comm = byId(communities.data);
  const agents = byId(realtors.data);
  const people = byId(staff.data);

  const refresh = () => {
    lead.reload();
    activities.reload();
    dupes.reload();
  };

  const act = async (done: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  /* Same rule as the list: an action that would always be refused is not offered,
     so no button here exists only to produce an error message. */
  const actions: { label: string; run: () => void; tone?: "danger" }[] = [];
  if (l.is_open) {
    if (l.status === "new")
      actions.push({
        label: "Mark contacted",
        run: () => act("Marked contacted", () => api.setLeadStatus(id, { status: "contacted" })),
      });
    if (l.status === "new" || l.status === "contacted")
      actions.push({
        label: "Qualify",
        run: () => act("Qualified", () => api.setLeadStatus(id, { status: "qualified" })),
      });
    if (l.status === "contacted" || l.status === "qualified")
      actions.push({
        label: "Book appointment",
        run: () =>
          act("Appointment booked", () => api.setLeadStatus(id, { status: "appointment" })),
      });
    if (l.status === "qualified" || l.status === "appointment")
      actions.push({
        label: "Convert to buyer",
        run: () =>
          confirm({
            title: `Convert ${l.full_name} to a buyer?`,
            body: "This creates the buyer record the contract is written against, and keeps the link back to this lead so the sale can be traced to its source. The lead stops being worked.",
            confirmLabel: "Convert",
            onConfirm: () => act("Converted to buyer", () => api.convertLead(id)),
          }),
      });
    for (const r of ["hot", "warm", "cold"] as LeadRating[])
      if (l.rating !== r)
        actions.push({
          label: `Rate ${r}`,
          run: () => act(`Rated ${r}`, () => api.setLeadRating(id, r)),
        });
    actions.push({
      label: "Archive as junk",
      tone: "danger",
      run: () =>
        confirm({
          title: `Archive ${l.full_name}?`,
          body: "For bot submissions and wrong numbers. The record is kept and can be restored from here afterwards.",
          confirmLabel: "Archive",
          tone: "danger",
          onConfirm: () => act("Archived", () => api.archiveLead(id, "Junk enquiry")),
        }),
    });
  } else if (l.status === "lost") {
    actions.push({
      label: "Reopen",
      run: () => act("Reopened", () => api.reopenLead(id, "Came back to us")),
    });
  }
  if (l.is_archived)
    actions.push({
      label: "Restore from archive",
      run: () => act("Restored", () => api.restoreLead(id)),
    });

  return (
    <>
      <PageHeader
        title={l.full_name}
        subtitle={
          [l.email, l.mobile ?? l.phone, l.city].filter(Boolean).join(" · ") ||
          "No contact details on file"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/leads" className="btn btn-ghost">
              All leads
            </Link>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            {l.is_open && (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => act("Assigned to you", () => api.claimLead(id))}
              >
                {l.assigned_to_id ? "Take over" : "Claim"}
              </button>
            )}
            <Menu label={busy ? "Working…" : "Actions"} items={actions} disabled={busy} />
          </div>
        }
      />

      {/* The state of the lead said in one line, rather than inferred from badges
          scattered over three cards. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={l.status} />
        {l.rating && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: ratingColour(l.rating) }}
            />
            {titleCase(l.rating)}
          </span>
        )}
        {l.is_prequalified && <Badge tone="ok">Prequalified</Badge>}
        {l.is_contingent && <Badge tone="warn">Has a home to sell</Badge>}
        {l.follow_up_overdue && <Badge tone="danger">Follow-up overdue</Badge>}
        {l.is_archived && <Badge tone="neutral">Archived</Badge>}
        {l.days_since_contact !== null && (
          <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
            Last contacted {l.days_since_contact} day{l.days_since_contact === 1 ? "" : "s"} ago
          </span>
        )}
      </div>

      {/* How it ended, and why. A status badge alone throws away the only part
          anybody needs six months later. */}
      {l.status === "lost" && (
        <div
          className="mb-5 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <strong>Lost{l.lost_on ? ` on ${day(l.lost_on)}` : ""}.</strong> {l.lost_reason}
          {l.lost_to && ` Went to ${l.lost_to}.`}
        </div>
      )}
      {l.converted_buyer_id && (
        <div
          className="mb-5 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
        >
          <strong>Converted{l.converted_on ? ` on ${day(l.converted_on)}` : ""}.</strong> The buyer
          record keeps this lead&apos;s source, so the sale is attributed to {titleCase(l.source)}{" "}
          rather than disappearing from the marketing report.
        </div>
      )}

      {(dupes.data ?? []).length > 0 && (
        <div
          className="mb-5 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <strong>Possible duplicate.</strong> These share an email or phone number:{" "}
          {(dupes.data ?? []).map((d, i) => (
            <span key={d.id}>
              {i > 0 && ", "}
              <Link href={`/leads/${d.id}`} className="underline">
                {d.full_name}
              </Link>{" "}
              ({titleCase(d.status)})
            </span>
          ))}
          . Worth checking before you ring - they may already have been spoken to.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LogTouch leadId={id} open={l.is_open} onDone={refresh} />

          <Card title="History" padded={false}>
            {activities.loading ? (
              <Loading />
            ) : (activities.data ?? []).length === 0 ? (
              <p className="p-5 text-sm" style={{ color: "var(--fg-subtle)" }}>
                Nothing logged yet.
              </p>
            ) : (
              <ul>
                {(activities.data ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="px-5 py-3"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {/* System entries look different from what a person did. A
                            trail that cannot tell "Priya rang them" from "status
                            moved to qualified" is hard to read at speed. */}
                        <Badge tone={a.is_system ? "neutral" : "brand"}>
                          {titleCase(a.activity_type)}
                        </Badge>
                        {a.outcome !== "none" && (
                          <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                            {titleCase(a.outcome)}
                          </span>
                        )}
                        {a.user_id && (
                          <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                            {people.get(a.user_id)?.full_name ?? ""}
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {day(a.occurred_on)}
                      </span>
                    </div>
                    <p
                      className="mt-1.5 text-sm"
                      style={a.is_system ? { color: "var(--fg-muted)" } : undefined}
                    >
                      {a.summary}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="What they want">
            <dl className="space-y-3 text-sm">
              <Detail
                label="Community"
                value={l.community_id ? (comm.get(l.community_id)?.name ?? "—") : "—"}
              />
              <Detail
                label="Budget"
                value={
                  l.price_min || l.price_max
                    ? `${l.price_min ? money(l.price_min) : "up to"}${
                        l.price_max ? ` – ${money(l.price_max)}` : "+"
                      }`
                    : "Not stated"
                }
              />
              <Detail label="Bedrooms" value={l.bedrooms_needed ? String(l.bedrooms_needed) : "—"} />
              <Detail
                label="Wants to move in"
                value={l.desired_move_in ? day(l.desired_move_in) : "No deadline given"}
              />
            </dl>
          </Card>

          <Card title="Can they buy">
            <dl className="space-y-3 text-sm">
              <Detail label="Prequalified" value={l.is_prequalified ? "Yes" : "Not yet"} />
              <Detail
                label="Financing"
                value={l.financing_type ? titleCase(l.financing_type) : "—"}
              />
              <Detail label="Lender" value={l.lender_name ?? "—"} />
              <Detail label="Home to sell" value={l.has_home_to_sell ? "Yes" : "No"} />
            </dl>
            {l.has_home_to_sell && (
              <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
                Their timeline depends on somebody else&apos;s sale completing, so a move-in date
                from them is an intention rather than a commitment.
              </p>
            )}
          </Card>

          <Card title="Where they came from">
            <dl className="space-y-3 text-sm">
              <Detail label="Source" value={titleCase(l.source)} />
              {l.realtor_id && (
                <Detail label="Agent" value={agents.get(l.realtor_id)?.name ?? "—"} />
              )}
              {l.referred_by && <Detail label="Referred by" value={l.referred_by} />}
              <Detail label="Campaign" value={l.campaign ?? "—"} />
            </dl>
          </Card>

          <Card title="Working it">
            <dl className="space-y-3 text-sm">
              <Detail
                label="Owner"
                value={l.assigned_to_id ? (people.get(l.assigned_to_id)?.full_name ?? "—") : "Nobody"}
              />
              <Detail
                label="Next follow-up"
                value={l.next_follow_up ? day(l.next_follow_up) : "Not scheduled"}
              />
              <Detail
                label="Prefers"
                value={l.preferred_contact ? titleCase(l.preferred_contact) : "No preference"}
              />
              <Detail label="Best time" value={l.best_time_to_call ?? "—"} />
            </dl>
          </Card>
        </div>
      </div>

      {editing && (
        <EditLead
          lead={l}
          communities={communities.data ?? []}
          realtors={realtors.data ?? []}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
      {confirmDialog}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: "var(--fg-muted)" }}>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- log a touch */

function LogTouch({ leadId, open, onDone }: { leadId: string; open: boolean; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<ActivityType>("call");
  const [outcome, setOutcome] = useState("reached");
  const [summary, setSummary] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  // A closed lead is not being worked, and the API refuses the follow-up anyway.
  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.logLeadActivity(leadId, {
        activity_type: type,
        summary,
        outcome: outcome as never,
        next_follow_up: next || undefined,
      });
      toast.success("Logged", next ? `Next follow-up set for ${next}.` : undefined);
      setSummary("");
      setNext("");
      onDone();
    } catch (err) {
      toast.error("Could not log that", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Log a touch">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="What happened">
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as ActivityType)}
            >
              {TOUCHES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Outcome" hint="Booking moves the lead on by itself.">
            <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="reached">Reached them</option>
              <option value="no_answer">No answer</option>
              <option value="left_message">Left a message</option>
              <option value="booked">Booked an appointment</option>
              <option value="not_interested">Not interested</option>
              <option value="none">Not applicable</option>
            </select>
          </Field>
          <Field label="Next follow-up">
            <input
              type="date"
              className="input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Summary">
          <input
            className="input"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
            placeholder="Talked through the Maple; sending the brochure."
          />
        </Field>
        <div className="flex justify-end">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Log it"}
          </button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------- editing */

/**
 * Correcting a lead.
 *
 * There was no way to do this at all until now. A mistyped email meant the lead
 * was permanently uncontactable, and the only route to a correct record was to
 * capture a second one - creating exactly the duplicate the system spends its
 * time warning about.
 *
 * Status is deliberately absent. It moves through its own routes, which check the
 * transition and write the history entry; a form that set it directly would route
 * round both.
 */
function EditLead({
  lead,
  communities,
  realtors,
  onClose,
  onDone,
}: {
  lead: LeadDetail;
  communities: { id: string; name: string }[];
  realtors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    mobile: lead.mobile ?? "",
    preferred_contact: lead.preferred_contact ?? "",
    best_time_to_call: lead.best_time_to_call ?? "",
    address: lead.address ?? "",
    city: lead.city ?? "",
    postcode: lead.postcode ?? "",
    source: lead.source as string,
    campaign: lead.campaign ?? "",
    realtor_id: lead.realtor_id ?? "",
    referred_by: lead.referred_by ?? "",
    community_id: lead.community_id ?? "",
    price_min: lead.price_min ?? "",
    price_max: lead.price_max ?? "",
    bedrooms_needed: lead.bedrooms_needed?.toString() ?? "",
    desired_move_in: lead.desired_move_in ?? "",
    is_prequalified: lead.is_prequalified,
    lender_name: lead.lender_name ?? "",
    financing_type: lead.financing_type ?? "",
    has_home_to_sell: lead.has_home_to_sell,
    notes: lead.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [k]:
          e.target instanceof HTMLInputElement && e.target.type === "checkbox"
            ? e.target.checked
            : e.target.value,
      }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Only what actually changed is sent. A PATCH that resends every field would
      // stamp `updated_by` on a record nobody edited, and would fight anyone else
      // working the same lead.
      const changed = Object.fromEntries(
        Object.entries(form).filter(([k, v]) => {
          const was = (lead as unknown as Record<string, unknown>)[k];
          return v !== (was ?? "") && !(v === "" && was == null);
        }),
      );
      if (!Object.keys(changed).length) {
        onClose();
        return;
      }
      await api.updateLead(lead.id, changed as never);
      toast.success(`${form.first_name} ${form.last_name} updated`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Edit ${lead.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <section className="space-y-4">
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-subtle)" }}
          >
            Who they are
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input
                className="input"
                value={form.first_name}
                onChange={set("first_name")}
                required
              />
            </Field>
            <Field label="Last name">
              <input className="input" value={form.last_name} onChange={set("last_name")} required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Email">
              <input type="email" className="input" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={set("phone")} />
            </Field>
            <Field label="Mobile">
              <input className="input" value={form.mobile} onChange={set("mobile")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefers">
              <select
                className="input"
                value={form.preferred_contact}
                onChange={set("preferred_contact")}
              >
                <option value="">No preference</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="text">Text</option>
              </select>
            </Field>
            <Field label="Best time">
              <input
                className="input"
                value={form.best_time_to_call}
                onChange={set("best_time_to_call")}
              />
            </Field>
            <Field label="Town">
              <input className="input" value={form.city} onChange={set("city")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Address">
              <input className="input" value={form.address} onChange={set("address")} />
            </Field>
            <Field label="Postcode">
              <input
                className="input"
                value={form.postcode}
                onChange={set("postcode")}
                placeholder="BH15 1AA"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-subtle)" }}
          >
            Where they came from
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source">
              <select className="input" value={form.source} onChange={set("source")}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
            </Field>
            {form.source === "realtor" ? (
              <Field label="Agent">
                <select className="input" value={form.realtor_id} onChange={set("realtor_id")}>
                  <option value="">Unknown</option>
                  {realtors.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : form.source === "referral" ? (
              <Field label="Referred by">
                <input className="input" value={form.referred_by} onChange={set("referred_by")} />
              </Field>
            ) : (
              <Field label="Campaign">
                <input className="input" value={form.campaign} onChange={set("campaign")} />
              </Field>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-subtle)" }}
          >
            What they want
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Community of interest">
              <select className="input" value={form.community_id} onChange={set("community_id")}>
                <option value="">None yet</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bedrooms needed">
              <input
                type="number"
                min={0}
                className="input"
                value={form.bedrooms_needed}
                onChange={set("bedrooms_needed")}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Budget from">
              <input
                type="number"
                className="input"
                value={form.price_min}
                onChange={set("price_min")}
              />
            </Field>
            <Field label="Budget to">
              <input
                type="number"
                className="input"
                value={form.price_max}
                onChange={set("price_max")}
              />
            </Field>
            <Field label="Wants to move in">
              <input
                type="date"
                className="input"
                value={form.desired_move_in}
                onChange={set("desired_move_in")}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-subtle)" }}
          >
            Can they buy
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Financing">
              <select
                className="input"
                value={form.financing_type}
                onChange={set("financing_type")}
              >
                <option value="">Unknown</option>
                <option value="cash">Cash</option>
                <option value="conventional">Conventional</option>
                <option value="fha">FHA</option>
                <option value="va">VA</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Lender">
              <input className="input" value={form.lender_name} onChange={set("lender_name")} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_prequalified}
                onChange={set("is_prequalified")}
              />
              Prequalified
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.has_home_to_sell}
                onChange={set("has_home_to_sell")}
              />
              Has a home to sell
            </label>
          </div>
        </section>

        <Field label="Notes">
          <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
        </Field>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
