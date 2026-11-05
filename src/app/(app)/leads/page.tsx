"use client";

/**
 * The sales pipeline.
 *
 * Four things drive the layout, each from how the page is actually used:
 *
 *  - **the queues come before the list.** A sales manager opens this page to find
 *    out what is going wrong, and the two answers are "leads nobody owns" and
 *    "leads nobody has rung". Those are tabs, not filters somebody has to think
 *    to apply.
 *  - **the row is the unit of work.** Claiming a lead, logging a call and booking
 *    the next one are each one click from the row, because a salesperson doing
 *    forty of them should not open forty pages.
 *  - **selection enables bulk.** Distributing the morning's enquiries is one
 *    action to a manager, so it is one action here.
 *  - **the capture form warns about duplicates while you type.** Not after
 *    submitting, and never as a block - the same family asking about two plans is
 *    legitimate.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  Popover,
  StatTile,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import { api, type LeadQuery } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type {
  ActivityType,
  DuplicateMatch,
  Lead,
  LeadRating,
  LeadSource,
  Realtor,
  User,
} from "@/types/api";

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

const RATINGS: LeadRating[] = ["hot", "warm", "cold"];

const VIEWS = [
  { key: "all", label: "All leads" },
  { key: "open", label: "Open" },
  { key: "unassigned", label: "Unassigned" },
  { key: "overdue", label: "Needs chasing" },
] as const;

type View = (typeof VIEWS)[number]["key"];

const PAGE_SIZE = 25;

/** Hot / warm / cold in the colours a salesperson already reads them in. */
function ratingColour(rating: LeadRating) {
  return rating === "hot"
    ? "var(--danger)"
    : rating === "warm"
      ? "var(--warn)"
      : "var(--fg-subtle)";
}

export default function LeadsPage() {
  const [view, setView] = useState<View>("all");
  const [filters, setFilters] = useState<{ status: string; source: string; rating: string; assigned_to_id: string }>({
    status: "",
    source: "",
    rating: "",
    assigned_to_id: "",
  });
  const [search, setSearch] = useState("");
  /** Archived leads are hidden by default. Without a way back to them, "Archive"
      is a one-way door and the Restore action has nothing to act on. */
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Rows with an action in flight, so a double click cannot fire it twice. */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Which modal is open, and for which lead. One piece of state rather than six
  // booleans, so two dialogs can never be open at once.
  const [dialog, setDialog] = useState<
    | { kind: "capture" }
    | { kind: "log"; lead: Lead }
    | { kind: "lost"; lead: Lead }
    | { kind: "followUp"; lead: Lead }
    | { kind: "assign"; leads: Lead[] }
    | { kind: "realtors" }
    | null
  >(null);

  const query: LeadQuery = useMemo(
    () => ({
      view,
      page,
      size: PAGE_SIZE,
      search: search || undefined,
      include_archived: showArchived || undefined,
      status: filters.status || undefined,
      source: filters.source || undefined,
      rating: filters.rating || undefined,
      assigned_to_id: filters.assigned_to_id || undefined,
    }),
    [view, page, search, showArchived, filters],
  );

  const leads = useAsync(() => api.listLeads(query), [query]);
  const summary = useAsync(() => api.leadSummary(), []);
  const communities = useAsync(() => api.listCommunities(), []);
  const realtors = useAsync(() => api.listRealtors(), []);
  // listUsers is paged; the picker wants the rows.
  const staff = useAsync(() => api.listUsers().then((p) => p.items), []);

  const comm = byId(communities.data);
  const agents = byId(realtors.data);
  const people = byId(staff.data);

  const rows = leads.data?.items ?? [];
  const total = leads.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = useCallback(() => {
    leads.reload();
    summary.reload();
    setSelected(new Set());
  }, [leads, summary]);

  // A filter change must reset to page 1, or a narrowed result set leaves you
  // looking at an empty page 4 and wondering where the leads went.
  const narrow = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const changeView = (v: View) => {
    setView(v);
    setPage(1);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  /** Which filters are on, in the words they were chosen by. */
  const activeFilters = useMemo(() => {
    const owner = (staff.data ?? []).find((u) => u.id === filters.assigned_to_id);
    return [
      filters.status && { key: "status" as const, label: titleCase(filters.status) },
      filters.source && { key: "source" as const, label: titleCase(filters.source) },
      filters.rating && { key: "rating" as const, label: `${titleCase(filters.rating)} leads` },
      filters.assigned_to_id && {
        key: "assigned_to_id" as const,
        label: owner ? owner.full_name : "One owner",
      },
    ].filter(Boolean) as { key: keyof typeof filters; label: string }[];
  }, [filters, staff.data]);

  const selectedLeads = rows.filter((r) => selected.has(r.id));

  /**
   * Every row action runs through here, so all of them behave the same way.
   *
   * Three things this does that the first version did not:
   *
   *  - **says what happened.** A salesperson who clicks Qualify and sees only the
   *    table twitch has no idea whether it worked. Silence on success is how
   *    people end up clicking twice.
   *  - **shows a refusal as a message, not a browser alert.** The API already
   *    explains itself properly ("Nobody has qualified Lin Zhao yet - qualification
   *    is where you find out whether they can actually pay"). An `alert()` box
   *    throws that away visually and blocks the page.
   *  - **marks the lead busy** while it runs, so a double click cannot fire the
   *    same transition twice.
   */
  const act = async (id: string, done: string, fn: () => Promise<unknown>) => {
    if (busyIds.has(id)) return;
    setBusyIds((b) => new Set(b).add(id));
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
      setBusyIds((b) => {
        const next = new Set(b);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Prospects before they become buyers. The source is kept through conversion, so marketing spend can be traced to a completed sale rather than only to an enquiry."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => setDialog({ kind: "realtors" })}>
              Agents
            </button>
            <Link href="/leads/sources" className="btn btn-ghost">
              Lead sources
            </Link>
            <Link href="/reports" className="btn btn-ghost">
              Reports
            </Link>
            <button className="btn btn-primary" onClick={() => setDialog({ kind: "capture" })}>
              Capture lead
            </button>
          </div>
        }
      />

      {summary.data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Open" value={summary.data.open} hint="Still being worked" />
          <StatTile
            label="Unassigned"
            value={summary.data.unassigned}
            hint="Nobody owns these"
            tone={summary.data.unassigned > 0 ? "warn" : "default"}
          />
          <StatTile
            label="Needs chasing"
            value={summary.data.overdue}
            hint="Follow-up date has passed"
            tone={summary.data.overdue > 0 ? "danger" : "ok"}
          />
          <StatTile label="Due today" value={summary.data.due_today} hint="On today's call list" />
        </div>
      )}

      {/* Queues first: they are why somebody opened this page. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist">
        {VIEWS.map((v) => {
          const count =
            v.key === "unassigned"
              ? summary.data?.unassigned
              : v.key === "overdue"
                ? summary.data?.overdue
                : v.key === "open"
                  ? summary.data?.open
                  : undefined;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              className="btn btn-ghost btn-sm"
              onClick={() => changeView(v.key)}
              style={
                view === v.key
                  ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 }
                  : {}
              }
            >
              {v.label}
              {count ? (
                <span
                  className="tnum ml-1.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold"
                  style={{
                    background: v.key === "overdue" ? "var(--danger-soft)" : "var(--neutral-soft)",
                    color: v.key === "overdue" ? "var(--danger)" : "var(--fg-muted)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* One search box and one Filters button, rather than four full-width
          selects stacked down the page. Whatever is switched on is shown as a
          removable chip, so the state of the list is readable without opening
          anything. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1 sm:max-w-sm">
          <input
            className="input"
            placeholder="Search name, email, phone, town…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Popover label="Filters" badge={activeFilters.length} width={300}>
          <div className="space-y-3">
            {view === "all" && (
              <Field label="Status">
                <select
                  className="input"
                  value={filters.status}
                  onChange={(e) => narrow({ status: e.target.value })}
                >
                  <option value="">Any status</option>
                  {["new", "contacted", "qualified", "appointment", "converted", "lost"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {titleCase(s)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            )}
            <Field label="Source">
              <select
                className="input"
                value={filters.source}
                onChange={(e) => narrow({ source: e.target.value })}
              >
                <option value="">Any source</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rating">
              <select
                className="input"
                value={filters.rating}
                onChange={(e) => narrow({ rating: e.target.value })}
              >
                <option value="">Any rating</option>
                {RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Owner">
              <select
                className="input"
                value={filters.assigned_to_id}
                onChange={(e) => narrow({ assigned_to_id: e.target.value })}
              >
                <option value="">Anyone</option>
                {(staff.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <label
              className="flex items-center gap-2 border-t pt-3 text-sm"
              style={{ borderColor: "var(--border)" }}
            >
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Include archived leads
            </label>
          </div>
        </Popover>

        {activeFilters.map((f) => (
          <button
            key={f.key}
            className="chip"
            onClick={() => narrow({ [f.key]: "" } as Partial<typeof filters>)}
            title="Remove this filter"
          >
            {f.label}
            <span aria-hidden className="ml-1 opacity-60">
              ×
            </span>
          </button>
        ))}

        {(search || activeFilters.length > 0) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearch("");
              setFilters({ status: "", source: "", rating: "", assigned_to_id: "" });
              setPage(1);
            }}
          >
            Clear all
          </button>
        )}

        <span className="tnum ml-auto text-sm" style={{ color: "var(--fg-muted)" }}>
          {total === 0 ? "No leads" : `${total} lead${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* The bulk bar only exists when something is selected - an always-visible
          row of disabled buttons is noise. */}
      {selected.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] px-3 py-2"
          style={{ background: "var(--brand-soft)", color: "var(--brand-fg)" }}
        >
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setDialog({ kind: "assign", leads: selectedLeads })}>
            Assign to…
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() =>
              confirm({
                title: `Return ${selected.size} lead${selected.size === 1 ? "" : "s"} to the pool?`,
                body: "They will have no owner and will appear in the Unassigned queue for somebody to pick up.",
                confirmLabel: "Unassign",
                onConfirm: async () => {
                  try {
                    const r = await api.bulkAssignLeads([...selected], null);
                    toast.success(
                      `${r.assigned} lead${r.assigned === 1 ? "" : "s"} returned to the pool`,
                      r.skipped.length ? `${r.skipped.length} skipped: ${r.skipped.join(", ")}` : undefined,
                    );
                    refresh();
                  } catch (err) {
                    toast.error(
                      "Could not unassign those",
                      err instanceof Error ? err.message : undefined,
                    );
                  }
                },
              })
            }
          >
            Unassign
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {leads.error && <ErrorNote message={leads.error} />}

      <Card padded={false}>
        {leads.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              {
                key: "pick",
                label: (
                  <input
                    type="checkbox"
                    aria-label="Select every lead on this page"
                    checked={allOnPageSelected}
                    onChange={() =>
                      setSelected((s) => {
                        // Toggling off clears only this page, not a selection the
                        // user built up across several.
                        const next = new Set(s);
                        if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
                        else rows.forEach((r) => next.add(r.id));
                        return next;
                      })
                    }
                  />
                ),
              },
              { key: "name", label: "Name" },
              { key: "contact", label: "Contact" },
              { key: "source", label: "Source" },
              { key: "interest", label: "Interest" },
              { key: "owner", label: "Owner" },
              { key: "status", label: "Status" },
              { key: "follow", label: "Follow up", align: "right" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty={
              view === "overdue"
                ? "Nothing overdue. Every open lead has been chased on time."
                : view === "unassigned"
                  ? "Every open lead has an owner."
                  : "No leads match this filter."
            }
          >
            {rows.map((l) => (
              <tr
                key={l.id}
                // A left accent rather than a flooded red row. The whole row in
                // danger-soft shouted over the content it was meant to draw you to,
                // and with several overdue leads the table became unreadable.
                style={{
                  ...(l.follow_up_overdue
                    ? { boxShadow: "inset 3px 0 0 0 var(--danger)" }
                    : {}),
                  ...(l.is_archived ? { opacity: 0.55 } : {}),
                }}
              >
                <td style={{ width: 34 }}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${l.full_name}`}
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                </td>

                <td>
                  <div className="flex items-center gap-1.5">
                    {/* Rating as a dot, not a badge: it is read at a glance and a
                        third word competing with the status badge was noise. */}
                    {l.rating && (
                      <span
                        aria-label={`${l.rating} lead`}
                        title={`${titleCase(l.rating)} lead`}
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: ratingColour(l.rating) }}
                      />
                    )}
                    <Link
                      href={`/leads/${l.id}`}
                      className="font-medium"
                      style={{ color: "var(--brand)" }}
                    >
                      {l.full_name}
                    </Link>
                  </div>
                  {(l.is_prequalified || l.has_home_to_sell || l.is_archived) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {l.is_prequalified && <Badge tone="ok">Prequalified</Badge>}
                      {l.has_home_to_sell && <Badge tone="warn">Home to sell</Badge>}
                      {l.is_archived && <Badge tone="neutral">Archived</Badge>}
                    </div>
                  )}
                </td>

                <td className="text-sm">
                  {l.email ? (
                    <a href={`mailto:${l.email}`} style={{ color: "var(--fg-muted)" }}>
                      {l.email}
                    </a>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>No email</span>
                  )}
                  {(l.phone || l.mobile) && (
                    <div className="text-xs">
                      {/* Tappable, because this list is worked from a phone as
                          often as a desk. */}
                      <a href={`tel:${l.mobile ?? l.phone}`} style={{ color: "var(--fg-subtle)" }}>
                        {l.mobile ?? l.phone}
                      </a>
                    </div>
                  )}
                </td>

                <td>
                  <Badge tone="neutral">{titleCase(l.source)}</Badge>
                  {(l.realtor_id || l.campaign) && (
                    <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {l.realtor_id ? (agents.get(l.realtor_id)?.name ?? "Agent") : l.campaign}
                    </div>
                  )}
                </td>

                <td className="text-sm">
                  {l.community_id ? (comm.get(l.community_id)?.name ?? "—") : "—"}
                  {(l.price_min || l.price_max) && (
                    <div className="tnum text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {l.price_min ? money(l.price_min) : "up to"} {l.price_max ? `– ${money(l.price_max)}` : "+"}
                      {l.bedrooms_needed ? ` · ${l.bedrooms_needed} bed` : ""}
                    </div>
                  )}
                </td>

                <td className="text-sm">
                  {l.assigned_to_id ? (
                    (people.get(l.assigned_to_id)?.full_name ?? "—")
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busyIds.has(l.id)}
                      onClick={() =>
                        act(l.id, `${l.full_name} is yours`, () => api.claimLead(l.id))
                      }
                    >
                      Claim
                    </button>
                  )}
                </td>

                <td>
                  <StatusBadge status={l.status} />
                </td>

                <td className="num text-sm">
                  {l.next_follow_up ? (
                    <span
                      className="tnum"
                      style={
                        l.follow_up_overdue
                          ? { color: "var(--danger)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      {day(l.next_follow_up)}
                    </span>
                  ) : l.is_open ? (
                    // Not a dash: a lead with no next step is the thing this
                    // column exists to expose, and one click fixes it.
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDialog({ kind: "followUp", lead: l })}
                    >
                      Set
                    </button>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  )}
                  {l.last_contacted_on && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      last {day(l.last_contacted_on)}
                    </div>
                  )}
                </td>

                <td className="num">
                  <RowActions
                    lead={l}
                    busy={busyIds.has(l.id)}
                    onDialog={(d) =>
                      setDialog(
                        d.kind === "assign"
                          ? { kind: "assign", leads: [d.lead] }
                          : (d as { kind: "log" | "lost" | "followUp"; lead: Lead }),
                      )
                    }
                    onAct={act}
                    onConfirm={confirm}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <div className="mt-3 flex items-center justify-end text-sm" style={{ color: "var(--fg-muted)" }}>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="tnum">
              Page {page} of {pages}
            </span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </div>

      {dialog?.kind === "capture" && (
        <CaptureLead
          communities={communities.data ?? []}
          realtors={realtors.data ?? []}
          staff={staff.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "log" && (
        <LogTouch lead={dialog.lead} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "lost" && (
        <MarkLost lead={dialog.lead} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "followUp" && (
        <SetFollowUp lead={dialog.lead} onClose={() => setDialog(null)} onDone={() => { setDialog(null); refresh(); }} />
      )}
      {dialog?.kind === "assign" && (
        <AssignMany
          leads={dialog.leads}
          staff={staff.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); refresh(); }}
        />
      )}
      {dialog?.kind === "realtors" && (
        <Agents onClose={() => setDialog(null)} onChanged={() => realtors.reload()} />
      )}

      {confirmDialog}
    </>
  );
}

/* ------------------------------------------------------------ row actions */

/**
 * What a salesperson does to a lead without leaving the list.
 *
 * Which actions appear depends on where the lead is. Offering "Convert" on a new
 * lead would be a button whose only purpose is to produce an error message, so
 * the menu is built from the lead's current status rather than being a fixed list
 * with half of it disabled.
 *
 * Rendered through `Menu`, which portals the panel to the body. The previous
 * hand-rolled version was absolutely positioned inside the row, and `DataTable`
 * wraps its table in `overflow: auto` - so the panel was clipped by the scroller
 * and drew itself across the rows below instead of beside its own button.
 */
function RowActions({
  lead,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  lead: Lead;
  busy: boolean;
  onDialog: (d: { kind: "log" | "lost" | "followUp" | "assign"; lead: Lead }) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];
  const who = lead.full_name;

  if (lead.is_open) {
    items.push({ label: "Log a call or visit", run: () => onDialog({ kind: "log", lead }) });
    items.push({ label: "Schedule follow-up", run: () => onDialog({ kind: "followUp", lead }) });
    items.push({ label: "Assign to…", run: () => onDialog({ kind: "assign", lead }) });

    if (lead.status === "new") {
      items.push({
        label: "Mark contacted",
        run: () =>
          onAct(lead.id, `${who} marked contacted`, () =>
            api.setLeadStatus(lead.id, { status: "contacted" }),
          ),
      });
    }
    if (lead.status === "new" || lead.status === "contacted") {
      items.push({
        label: "Qualify",
        run: () =>
          onAct(lead.id, `${who} qualified`, () =>
            api.setLeadStatus(lead.id, { status: "qualified" }),
          ),
      });
    }
    if (lead.status === "contacted" || lead.status === "qualified") {
      items.push({
        label: "Book appointment",
        run: () =>
          onAct(lead.id, `Appointment booked for ${who}`, () =>
            api.setLeadStatus(lead.id, { status: "appointment" }),
          ),
      });
    }
    if (lead.status === "qualified" || lead.status === "appointment") {
      items.push({
        label: "Convert to buyer",
        run: () =>
          // Confirmed because it creates the buyer record a contract is written
          // against, and it cannot be undone from this screen.
          onConfirm({
            title: `Convert ${who} to a buyer?`,
            body: "This creates the buyer record the contract is written against, and keeps the link back to this lead so the sale can be traced to its source. The lead stops being worked.",
            confirmLabel: "Convert",
            onConfirm: () =>
              onAct(lead.id, `${who} is now a buyer`, () => api.convertLead(lead.id)),
          }),
      });
    }

    // One rating entry rather than three, so the menu does not triple in length
    // for something read at a glance from the row anyway.
    const nextRating: LeadRating =
      lead.rating === "hot" ? "warm" : lead.rating === "warm" ? "cold" : "hot";
    items.push({
      label: `Rate ${nextRating}`,
      run: () =>
        onAct(lead.id, `${who} rated ${nextRating}`, () =>
          api.setLeadRating(lead.id, nextRating),
        ),
    });

    items.push({ label: "Mark lost…", run: () => onDialog({ kind: "lost", lead }), tone: "danger" });
    items.push({
      label: "Archive as junk",
      tone: "danger",
      run: () =>
        onConfirm({
          title: `Archive ${who}?`,
          body: "For bot submissions and wrong numbers. The record is kept but disappears from this list. You can restore it later.",
          confirmLabel: "Archive",
          tone: "danger",
          onConfirm: () =>
            onAct(lead.id, `${who} archived`, () => api.archiveLead(lead.id, "Junk enquiry")),
        }),
    });
  } else if (lead.status === "lost") {
    items.push({
      label: "Reopen",
      run: () =>
        onAct(lead.id, `${who} reopened`, () => api.reopenLead(lead.id, "Came back to us")),
    });
  }

  if (lead.is_archived) {
    items.push({
      label: "Restore from archive",
      run: () => onAct(lead.id, `${who} restored`, () => api.restoreLead(lead.id)),
    });
  }

  if (!items.length) {
    return (
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        Buyer
      </span>
    );
  }
  return <Menu label={busy ? "Working…" : "Actions"} items={items} disabled={busy} />;
}

/* ---------------------------------------------------------------- capture */

function CaptureLead({
  communities,
  realtors,
  staff,
  onClose,
  onDone,
}: {
  communities: { id: string; name: string }[];
  realtors: Realtor[];
  staff: User[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    preferred_contact: "",
    best_time_to_call: "",
    city: "",
    postcode: "",
    source: "website" as LeadSource,
    campaign: "",
    realtor_id: "",
    referred_by: "",
    community_id: "",
    price_min: "",
    price_max: "",
    bedrooms_needed: "",
    desired_move_in: "",
    project_type: "",
    confidence: "",
    projected_sales_date: "",
    is_prequalified: false,
    lender_name: "",
    financing_type: "",
    has_home_to_sell: false,
    rating: "",
    assigned_to_id: "",
    next_follow_up: "",
    notes: "",
  });
  const toast = useToast();
  const [dupes, setDupes] = useState<DuplicateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [k]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value,
      }));

  // Duplicate check while they type, debounced. Deliberately a warning and never
  // a block: the same family enquiring about two plans is legitimate, and
  // refusing a walk-in at the desk is worse than a duplicate row.
  useEffect(() => {
    const { email, phone, mobile } = form;
    if (!email && !phone && !mobile) {
      setDupes([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .checkLeadDuplicates({ email: email || undefined, phone: phone || undefined, mobile: mobile || undefined })
        .then(setDupes)
        .catch(() => setDupes([]));
    }, 450);
    return () => clearTimeout(timer);
  }, [form.email, form.phone, form.mobile]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Empty strings are "not supplied", not "clear it" - the API treats them
      // differently and an empty date string is a validation error.
      const body = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== "" && v !== null),
      ) as Record<string, unknown>;
      await api.createLead(body as never);
      toast.success(`${form.first_name} ${form.last_name} captured`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture the lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Capture a lead" onClose={onClose}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <section className="space-y-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
            Who they are
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name">
              <input className="input" value={form.first_name} onChange={set("first_name")} required />
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

          {dupes.length > 0 && (
            <div
              className="rounded-[var(--radius)] px-3 py-2 text-sm"
              style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
            >
              <p className="font-semibold">
                {dupes.length === 1 ? "This looks like an existing lead" : "These look like existing leads"}
              </p>
              <ul className="mt-1 space-y-0.5">
                {dupes.map((d) => (
                  <li key={d.id}>
                    <Link href={`/leads/${d.id}`} className="underline">
                      {d.full_name}
                    </Link>{" "}
                    — {titleCase(d.status)}, {titleCase(d.source)}
                    {d.created_at ? `, ${day(d.created_at)}` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">
                Capture it anyway if this is a genuinely new enquiry — a family asking about two plans is not a
                duplicate.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefers">
              <select className="input" value={form.preferred_contact} onChange={set("preferred_contact")}>
                <option value="">No preference</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="text">Text</option>
              </select>
            </Field>
            <Field label="Best time to call">
              <input className="input" value={form.best_time_to_call} onChange={set("best_time_to_call")} placeholder="Evenings" />
            </Field>
            <Field label="Town">
              <input className="input" value={form.city} onChange={set("city")} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
            How they found us
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
              <Field label="Agent" hint="Commission is tracked against the agent record.">
                <select className="input" value={form.realtor_id} onChange={set("realtor_id")}>
                  <option value="">Unknown</option>
                  {realtors.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.brokerage ? ` — ${r.brokerage}` : ""}
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
                <input className="input" value={form.campaign} onChange={set("campaign")} placeholder="spring-parade" />
              </Field>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
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
              <input type="number" min={0} className="input" value={form.bedrooms_needed} onChange={set("bedrooms_needed")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Budget from">
              <input type="number" step="1000" className="input" value={form.price_min} onChange={set("price_min")} />
            </Field>
            <Field label="Budget to">
              <input type="number" step="1000" className="input" value={form.price_max} onChange={set("price_max")} />
            </Field>
            <Field label="Wants to move in" hint="A school-year deadline outranks price.">
              <input type="date" className="input" value={form.desired_move_in} onChange={set("desired_move_in")} />
            </Field>
            <Field label="Project type" hint="New build, remodel, addition, ADU…">
              <input className="input" value={form.project_type} onChange={set("project_type")} />
            </Field>
            <Field label="Confidence %" hint="Win probability — weights the forecast.">
              <input type="number" min={0} max={100} className="input" value={form.confidence} onChange={set("confidence")} />
            </Field>
            <Field label="Projected sales date" hint="When the sale is expected to close.">
              <input type="date" className="input" value={form.projected_sales_date} onChange={set("projected_sales_date")} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
            Can they buy
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Financing">
              <select className="input" value={form.financing_type} onChange={set("financing_type")}>
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
              <input type="checkbox" checked={form.is_prequalified} onChange={set("is_prequalified")} />{" "}
              Prequalified
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.has_home_to_sell} onChange={set("has_home_to_sell")} />{" "}
              Has a home to sell
            </label>
          </div>
          <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            A buyer with a house to sell has a timeline somebody else controls, so the pipeline flags them separately.
          </p>
        </section>

        <section className="space-y-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
            Working it
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Rating">
              <select className="input" value={form.rating} onChange={set("rating")}>
                <option value="">Not rated</option>
                {RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assign to">
              <select className="input" value={form.assigned_to_id} onChange={set("assigned_to_id")}>
                <option value="">Nobody yet</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Follow up on">
              <input type="date" className="input" value={form.next_follow_up} onChange={set("next_follow_up")} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} />
          </Field>
        </section>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Capture"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- log a touch */

const TOUCHES: { type: ActivityType; label: string }[] = [
  { type: "call", label: "Call" },
  { type: "email", label: "Email" },
  { type: "text", label: "Text" },
  { type: "visit", label: "Site visit" },
  { type: "appointment", label: "Appointment" },
  { type: "note", label: "Note" },
];

function LogTouch({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<ActivityType>("call");
  const [outcome, setOutcome] = useState("reached");
  const [summary, setSummary] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.logLeadActivity(lead.id, {
        activity_type: type,
        summary,
        outcome: outcome as never,
        next_follow_up: next || undefined,
      });
      toast.success(
        `Logged against ${lead.full_name}`,
        next ? `Next follow-up set for ${next}.` : undefined,
      );
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Log a touch — ${lead.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What happened">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
              {TOUCHES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Outcome" hint="Booking an appointment moves the lead on by itself.">
            <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="reached">Reached them</option>
              <option value="no_answer">No answer</option>
              <option value="left_message">Left a message</option>
              <option value="booked">Booked an appointment</option>
              <option value="not_interested">Not interested</option>
              <option value="none">Not applicable</option>
            </select>
          </Field>
        </div>
        <Field label="Summary">
          <textarea
            className="input"
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Talked through the Maple; sending the brochure."
            required
          />
        </Field>
        <Field label="Next follow-up" hint="Logging the call and booking the next one is one action.">
          <input type="date" className="input" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Log it"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------- mark lost */

const LOST_REASONS = [
  "Beaten on price",
  "Timing did not work",
  "Went with another builder",
  "Could not get financing",
  "Wanted a specification we do not offer",
  "Stopped responding",
];

function MarkLost({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [lostTo, setLostTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.markLeadLost(lead.id, {
        reason: detail ? `${reason} — ${detail}` : reason,
        lost_to: lostTo || undefined,
      });
      toast.info(`${lead.full_name} marked lost`, lostTo ? `Lost to ${lostTo}.` : reason);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close the lead");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Mark lost — ${lead.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          A reason is required. A pipeline of unexplained losses tells the business nothing; the same pipeline
          annotated with why shows where it is losing.
        </p>
        <Field label="Reason">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Anything more">
          <input className="input" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="15k under our price on the Maple" />
        </Field>
        <Field label="Lost to" hint="Which builder won it, if you know.">
          <input className="input" value={lostTo} onChange={(e) => setLostTo(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Mark lost"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------- schedule / assign */

function SetFollowUp({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const quick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setWhen(d.toISOString().slice(0, 10));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.setLeadFollowUp(lead.id, { next_follow_up: when, note: note || undefined });
      toast.success(`${lead.full_name} will be chased on ${when}`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set that");
    }
  }

  return (
    <Modal open title={`Follow up — ${lead.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Tomorrow", days: 1 },
            { label: "In 3 days", days: 3 },
            { label: "Next week", days: 7 },
            { label: "In a month", days: 30 },
          ].map((q) => (
            <button key={q.label} type="button" className="btn btn-ghost btn-sm" onClick={() => quick(q.days)}>
              {q.label}
            </button>
          ))}
        </div>
        <Field label="Date">
          <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </Field>
        <Field label="Note">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ring after their survey" />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Set follow-up
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignMany({
  leads,
  staff,
  onClose,
  onDone,
}: {
  leads: Lead[];
  staff: User[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [who, setWho] = useState("");
  const [result, setResult] = useState<{ assigned: number; skipped: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.bulkAssignLeads(
        leads.map((l) => l.id),
        who || null,
      );
      // Shown rather than swallowed: a bulk action that reports only success is
      // lying the moment one row was skipped.
      // Only interrupt with a dialog when something was skipped; a clean run
      // just says so and gets out of the way.
      if (r.skipped.length) setResult(r);
      else {
        toast.success(`${r.assigned} lead${r.assigned === 1 ? "" : "s"} assigned`);
        onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign those");
    }
  }

  if (result) {
    return (
      <Modal open title="Assigned" onClose={onDone}>
        <p className="text-sm">
          {result.assigned} lead{result.assigned === 1 ? "" : "s"} assigned. {result.skipped.length} skipped:
        </p>
        <ul className="mt-2 space-y-0.5 text-sm" style={{ color: "var(--fg-muted)" }}>
          {result.skipped.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
          A lead that has converted or been lost is no longer being worked, so it cannot have an owner.
        </p>
        <div className="mt-4 flex justify-end">
          <button className="btn btn-primary" onClick={onDone}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title={`Assign ${leads.length} lead${leads.length === 1 ? "" : "s"}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Assign to">
          <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Nobody — return to the pool</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Assign
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------- agents */

/**
 * The referring agents, ranked by what they have actually delivered.
 *
 * Ranked by conversions rather than enquiries: the agent who sends three buyers
 * is worth more than the one who sends thirty browsers, and a raw enquiry count
 * would put them the wrong way round.
 */
function Agents({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const table = useAsync(() => api.realtorPerformance(), []);

  /**
   * Editing an agent, with the refusal surfaced.
   *
   * Retiring one is refused while they still hold open leads - there is a
   * commission riding on each - and that message is the useful part, so it goes
   * to a toast rather than being swallowed.
   */
  const run = async (done: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(done);
      table.reload();
      onChanged();
    } catch (err) {
      toast.error("That did not go through", err instanceof Error ? err.message : undefined);
    }
  };
  const [adding, setAdding] = useState(false);
  /** The agent being corrected, or null when the form is adding a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", brokerage: "", email: "", phone: "", commission_percent: "" });
  const [error, setError] = useState<string | null>(null);

  const blank = { code: "", name: "", brokerage: "", email: "", phone: "", commission_percent: "" };

  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setForm(blank);
    setError(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      code: form.code,
      name: form.name,
      brokerage: form.brokerage || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      commission_percent: form.commission_percent || undefined,
    };
    try {
      if (editingId) await api.updateRealtor(editingId, body as never);
      else await api.createRealtor(body as never);
      toast.success(`${form.name} ${editingId ? "updated" : "added"}`);
      closeForm();
      table.reload();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not ${editingId ? "save" : "add"} the agent`,
      );
    }
  }

  return (
    <Modal open title="Referring agents" onClose={onClose}>
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {table.loading ? (
          <Loading variant="text" />
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Agent" },
              { key: "sent", label: "Sent", align: "right" },
              { key: "won", label: "Buyers", align: "right" },
              { key: "rate", label: "Rate", align: "right" },
              { key: "fee", label: "Fee", align: "right" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty="No agents yet. Add the ones who send you business."
          >
            {(table.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="font-medium">{r.name}</span>
                  {r.brokerage && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {r.brokerage}
                    </div>
                  )}
                </td>
                <td className="num tnum">{r.leads_sent}</td>
                <td className="num tnum">{r.leads_converted}</td>
                <td className="num tnum">
                  {/* Null, not zero: a new agent has no rate yet. */}
                  {r.conversion_rate === null ? "—" : `${r.conversion_rate}%`}
                </td>
                <td className="num tnum">{r.commission_percent}%</td>
                <td className="num">
                  <Menu
                    label="Edit"
                    items={[
                      {
                        label: "Edit details",
                        run: () => {
                          setForm({
                            code: r.code,
                            name: r.name,
                            brokerage: r.brokerage ?? "",
                            email: r.email ?? "",
                            phone: r.phone ?? "",
                            commission_percent: r.commission_percent,
                          });
                          setEditingId(r.id);
                          setAdding(true);
                        },
                      },
                      {
                        label: "Retire this agent",
                        tone: "danger",
                        run: () =>
                          // Refused while they hold open leads - there is a
                          // commission riding on each. The refusal explains that.
                          run(`${r.name} retired`, () =>
                            api.archiveRealtor(r.id, "No longer sending us business"),
                          ),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        )}

        {adding ? (
          <form onSubmit={save} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Code">
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              </Field>
              <Field label="Name">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brokerage">
                <input className="input" value={form.brokerage} onChange={(e) => setForm({ ...form, brokerage: e.target.value })} />
              </Field>
              <Field label="Commission %" hint="Negotiated per agent, so it lives on their record.">
                <input
                  type="number"
                  step="0.25"
                  className="input"
                  value={form.commission_percent}
                  onChange={(e) => setForm({ ...form, commission_percent: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            {error && <ErrorNote message={error} />}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingId ? "Save changes" : "Add agent"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex justify-end">
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Add an agent
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
