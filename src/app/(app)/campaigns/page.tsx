"use client";

/**
 * Campaigns.
 *
 * The old screen led with emails sent and open rate. Those are the wrong headline:
 * three campaigns with identical open rates can differ by an order of magnitude on
 * cost per sale, and only one of them is worth running again. A road sign has no
 * open rate at all, and showing 0% against one reads as failure rather than as a
 * question that does not apply.
 *
 * So this leads with money — spend, cost per lead, cost per sale, and what came
 * back — and the delivery numbers sit where they belong, as a detail on the email
 * campaigns that have them.
 *
 * The table is ordered by cost per sale rather than by volume, because the campaign
 * that produced the most enquiries is very often not the one to repeat, and a list
 * sorted by volume quietly argues that it is.
 */

import { useCallback, useState } from "react";

import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import {
  Badge,
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
import type { Campaign, CampaignChannel, CampaignResult } from "@/types/api";

const CHANNELS: { value: CampaignChannel; label: string; hint: string }[] = [
  { value: "email", label: "Email", hint: "The only channel that reports opens and clicks." },
  { value: "print", label: "Print", hint: "Local paper, brochure drop." },
  { value: "signage", label: "Signage", hint: "Boards on the road, site hoarding." },
  { value: "social", label: "Social", hint: "Paid or organic." },
  { value: "portal", label: "Portal", hint: "Featured listing on Rightmove and similar." },
  { value: "event", label: "Event", hint: "Parade of homes, open weekend." },
  { value: "radio", label: "Radio", hint: "" },
  { value: "other", label: "Other", hint: "" },
];

/** A percentage that might not apply. Null is not zero. */
function pct(value: number | null, of: "rate" | "plain" = "plain") {
  if (value === null) return "—";
  return of === "rate" ? `${(value * 100).toFixed(1)}%` : `${value}%`;
}

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | { kind: "create" }
    | { kind: "edit"; campaign: Campaign }
    | { kind: "schedule"; campaign: Campaign }
    | { kind: "delivery"; campaign: Campaign }
    | { kind: "cost"; campaign: Campaign }
    | { kind: "cancel"; campaign: Campaign }
    | { kind: "duplicate"; campaign: Campaign }
    | null
  >(null);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const summary = useAsync(() => api.marketingSummary(), []);
  const performance = useAsync(() => api.campaignPerformance(), []);
  const campaigns = useAsync(
    () =>
      api.listCampaigns({
        status: statusFilter || undefined,
        channel: channelFilter || undefined,
        size: 100,
      }),
    [statusFilter, channelFilter],
  );
  const communities = useAsync(() => api.listCommunities(), []);

  const rows = campaigns.data?.items ?? [];
  const byCampaign = byId(
    (performance.data?.campaigns ?? []).map((r) => ({ ...r, id: r.campaign_id })),
  );

  const refresh = useCallback(() => {
    summary.reload();
    performance.reload();
    campaigns.reload();
  }, [summary, performance, campaigns]);

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

  const s = summary.data;
  const p = performance.data;

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="What marketing spent, and what came back. Nothing is sent from here — a delivery provider does that and reports back."
        action={
          <button className="btn btn-primary" onClick={() => setDialog({ kind: "create" })}>
            New campaign
          </button>
        }
      />

      {/* Money first. Emails sent is not the headline — cost per sale is. */}
      {s && (
        <div className="metric-strip mb-5">
          <div className="metric">
            <span className="metric-label">Spend</span>
            <span className="metric-value">{money(s.total_spend)}</span>
            <span className="metric-hint">{s.active} running</span>
          </div>
          <div className="metric">
            <span className="metric-label">Cost per lead</span>
            <span className="metric-value">
              {s.cost_per_lead === null ? "—" : money(s.cost_per_lead)}
            </span>
            <span className="metric-hint">{s.leads_attributed} attributed</span>
          </div>
          <div className="metric">
            <span className="metric-label">Cost per sale</span>
            <span className="metric-value">
              {s.cost_per_sale === null ? "—" : money(s.cost_per_sale)}
            </span>
            <span className="metric-hint">{s.leads_converted} became buyers</span>
          </div>
          <div className="metric">
            <span className="metric-label">Returned</span>
            <span
              className="metric-value"
              style={p?.return_on_spend ? { color: "var(--ok)" } : undefined}
            >
              {p?.total_revenue ? money(p.total_revenue) : "—"}
            </span>
            <span className="metric-hint">
              {p?.return_on_spend ? `${p.return_on_spend}× spend` : "No sales traced yet"}
            </span>
          </div>
        </div>
      )}

      {/* Leads tagged with a campaign nobody created. Spend somebody cannot name,
          which is worth saying out loud rather than dropping silently. */}
      {s && s.unmatched_tags > 0 && (
        <div
          className="mb-4 rounded-[var(--radius)] px-4 py-3 text-sm"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <strong>{s.unmatched_tags} leads carry a campaign tag that matches nothing.</strong> They
          arrived tagged with a campaign that was never created here, so their cost is unknown.
          Create the campaign with that exact code and use Attach leads.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="input w-auto max-w-[11rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Any status</option>
          {["draft", "scheduled", "running", "sent", "cancelled"].map((st) => (
            <option key={st} value={st}>
              {titleCase(st)}
            </option>
          ))}
        </select>
        <select
          className="input w-auto max-w-[11rem]"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
        >
          <option value="">Any channel</option>
          {CHANNELS.map((ch) => (
            <option key={ch.value} value={ch.value}>
              {ch.label}
            </option>
          ))}
        </select>
        {(statusFilter || channelFilter) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatusFilter("");
              setChannelFilter("");
            }}
          >
            Clear
          </button>
        )}
        <span className="tnum ml-auto text-sm" style={{ color: "var(--fg-muted)" }}>
          {rows.length === 0 ? "No campaigns" : `${rows.length} campaign${rows.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {campaigns.error && <ErrorNote message={campaigns.error} />}

      <Card padded={false}>
        {campaigns.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Campaign" },
              { key: "spend", label: "Spend", align: "right" },
              { key: "leads", label: "Leads", align: "right" },
              { key: "cpl", label: "Per lead", align: "right" },
              { key: "cps", label: "Per sale", align: "right" },
              { key: "back", label: "Returned", align: "right" },
              { key: "status", label: "Status" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty="No campaigns yet."
          >
            {rows.map((c) => {
              const r = byCampaign.get(c.id) as (CampaignResult & { id: string }) | undefined;
              return (
                <tr key={c.id} style={c.status === "cancelled" ? { opacity: 0.55 } : undefined}>
                  <td>
                    <span className="font-medium">{c.name}</span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <Badge tone="neutral">{titleCase(c.channel)}</Badge>
                      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {c.code}
                      </span>
                      {/* Delivery lives here, as a detail on the channels that
                          have it, rather than as a headline for all of them. */}
                      {c.has_delivery_numbers && c.sent_count > 0 && (
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          · {c.sent_count.toLocaleString(LOCALE)} sent, {pct(c.open_rate, "rate")} opened
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="num tnum text-sm">
                    {money(c.cost)}
                    {c.is_over_budget && (
                      <div className="text-xs" style={{ color: "var(--danger)" }}>
                        over {money(c.budget)}
                      </div>
                    )}
                  </td>
                  <td className="num tnum text-sm">
                    {r?.leads ?? 0}
                    {r && r.converted > 0 && (
                      <div className="text-xs" style={{ color: "var(--ok)" }}>
                        {r.converted} sold
                      </div>
                    )}
                  </td>
                  <td className="num tnum text-sm">
                    {r?.cost_per_lead ? money(r.cost_per_lead) : "—"}
                  </td>
                  <td className="num tnum text-sm font-semibold">
                    {r?.cost_per_sale ? money(r.cost_per_sale) : "—"}
                  </td>
                  <td className="num tnum text-sm">
                    {r && Number(r.revenue) > 0 ? (
                      <>
                        {money(r.revenue)}
                        {r.return_on_spend && (
                          <div className="text-xs" style={{ color: "var(--ok)" }}>
                            {r.return_on_spend}×
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                    {c.status === "cancelled" && c.cancellation_reason && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {c.cancellation_reason}
                      </div>
                    )}
                    {c.scheduled_for && c.status === "scheduled" && (
                      <div className="mt-0.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {day(c.scheduled_for)}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <CampaignActions
                      campaign={c}
                      busy={busy === c.id}
                      onDialog={setDialog}
                      onAct={act}
                      onConfirm={confirm}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
        Ordered by cost per sale. The campaign that produced the most enquiries is often not the one
        worth repeating.
      </p>

      {dialog?.kind === "create" && (
        <CampaignForm
          communities={communities.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog?.kind === "edit" && (
        <CampaignForm
          campaign={dialog.campaign}
          communities={communities.data ?? []}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            refresh();
          }}
        />
      )}
      {dialog && ["schedule", "delivery", "cost", "cancel", "duplicate"].includes(dialog.kind) && (
        <SmallDialog
          kind={dialog.kind as "schedule" | "delivery" | "cost" | "cancel" | "duplicate"}
          campaign={(dialog as { campaign: Campaign }).campaign}
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

/* --------------------------------------------------------------- actions */

type DialogKind = "edit" | "schedule" | "delivery" | "cost" | "cancel" | "duplicate";

function CampaignActions({
  campaign,
  busy,
  onDialog,
  onAct,
  onConfirm,
}: {
  campaign: Campaign;
  busy: boolean;
  onDialog: (d: { kind: DialogKind; campaign: Campaign }) => void;
  onAct: (id: string, done: string, fn: () => Promise<unknown>) => Promise<void>;
  onConfirm: (opts: {
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }) => void;
}) {
  const c = campaign;
  const items: { label: string; run: () => void; tone?: "danger" }[] = [];

  if (c.status === "draft" || c.status === "scheduled") {
    items.push({ label: "Edit…", run: () => onDialog({ kind: "edit", campaign: c }) });
  }
  if (c.status === "draft") {
    items.push({ label: "Schedule…", run: () => onDialog({ kind: "schedule", campaign: c }) });
  }
  if (c.status === "draft" || c.status === "scheduled") {
    items.push({
      label: c.channel === "email" ? "Hand to the provider" : "It is out there",
      run: () =>
        onConfirm({
          title: `Launch ${c.name}?`,
          body:
            c.channel === "email"
              ? "Marks it as gone to the delivery provider. Nothing is sent from here — record the numbers they report back afterwards."
              : "Marks it as running. Judge it on the leads that arrive and what they cost.",
          confirmLabel: "Launch",
          onConfirm: () => onAct(c.id, `${c.name} is running`, () => api.launchCampaign(c.id)),
        }),
    });
  }
  if (c.status === "running") {
    if (c.has_delivery_numbers) {
      items.push({
        label: "Record delivery…",
        run: () => onDialog({ kind: "delivery", campaign: c }),
      });
    }
    items.push({
      label: "It has finished",
      run: () => onAct(c.id, `${c.name} finished`, () => api.completeCampaign(c.id)),
    });
  }
  if (c.status !== "cancelled") {
    items.push({ label: "Record what it cost…", run: () => onDialog({ kind: "cost", campaign: c }) });
    items.push({
      label: "Attach leads with this code",
      run: () =>
        onAct(c.id, "Leads attached", async () => {
          const r = await api.attachLeads(c.id);
          if (r.attached === 0) throw new Error("No unattached leads carry this campaign code.");
        }),
    });
  }
  items.push({ label: "Duplicate…", run: () => onDialog({ kind: "duplicate", campaign: c }) });
  if (c.is_active || c.status === "draft") {
    items.push({
      label: "Cancel it…",
      tone: "danger",
      run: () => onDialog({ kind: "cancel", campaign: c }),
    });
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

function CampaignForm({
  campaign,
  communities,
  onClose,
  onDone,
}: {
  campaign?: Campaign;
  communities: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const editing = !!campaign;
  const [form, setForm] = useState({
    code: campaign?.code ?? "",
    name: campaign?.name ?? "",
    channel: (campaign?.channel ?? "email") as CampaignChannel,
    subject: campaign?.subject ?? "",
    body: campaign?.body ?? "",
    budget: campaign?.budget ?? "",
    cost: campaign?.cost ?? "",
    community_id: campaign?.community_id ?? "",
    starts_on: campaign?.starts_on ?? "",
    ends_on: campaign?.ends_on ?? "",
    notes: campaign?.notes ?? "",
  });

  const chosen = CHANNELS.find((c) => c.value === form.channel)!;
  const isEmail = form.channel === "email";

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open title={editing ? `Edit ${campaign!.name}` : "New campaign"} onClose={onClose}>
      <form
        className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          const body = {
            code: form.code,
            name: form.name,
            channel: form.channel,
            subject: form.subject || undefined,
            body: form.body || undefined,
            budget: form.budget || undefined,
            community_id: form.community_id || undefined,
            starts_on: form.starts_on || undefined,
            ends_on: form.ends_on || undefined,
            notes: form.notes || undefined,
          };
          run(editing ? `${form.name} updated` : `${form.name} created`, () =>
            editing
              ? api.updateCampaign(campaign!.id, body as never)
              : api.createCampaign({ ...body, cost: form.cost || undefined }),
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className="input" value={form.name} onChange={set("name")} required />
          </Field>
          <Field label="Code" hint="What inbound leads are tagged with.">
            <input className="input font-mono" value={form.code} onChange={set("code")} required />
          </Field>
        </div>

        <Field label="Channel" hint={chosen.hint}>
          <select className="input" value={form.channel} onChange={set("channel")}>
            {CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>
                {ch.label}
              </option>
            ))}
          </select>
        </Field>

        {isEmail ? (
          <>
            <Field label="Subject" hint="Required before it can be handed to the provider.">
              <input className="input" value={form.subject} onChange={set("subject")} />
            </Field>
            <Field label="Body">
              <textarea className="input" rows={4} value={form.body} onChange={set("body")} />
            </Field>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Runs from">
              <input type="date" className="input" value={form.starts_on} onChange={set("starts_on")} />
            </Field>
            <Field label="Until">
              <input type="date" className="input" value={form.ends_on} onChange={set("ends_on")} />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget">
            <input type="number" min={0} step="100" className="input" value={form.budget} onChange={set("budget")} />
          </Field>
          {!editing && (
            <Field label="Cost so far" hint="Can be recorded later.">
              <input type="number" min={0} step="100" className="input" value={form.cost} onChange={set("cost")} />
            </Field>
          )}
        </div>

        <Field label="Community" hint="Leave blank if it is not about one development.">
          <select className="input" value={form.community_id} onChange={set("community_id")}>
            <option value="">All</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SmallDialog({
  kind,
  campaign,
  onClose,
  onDone,
}: {
  kind: "schedule" | "delivery" | "cost" | "cancel" | "duplicate";
  campaign: Campaign;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, error, busy } = useAction(onDone);
  const [when, setWhen] = useState("");
  const [cost, setCost] = useState(campaign.cost);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState(`${campaign.code}-copy`);
  const [counts, setCounts] = useState({
    sent_count: String(campaign.sent_count || ""),
    opened_count: String(campaign.opened_count || ""),
    clicked_count: String(campaign.clicked_count || ""),
    bounced_count: String(campaign.bounced_count || ""),
  });

  const titles = {
    schedule: "Schedule it",
    delivery: "What the provider reported",
    cost: "What it cost",
    cancel: `Cancel ${campaign.name}`,
    duplicate: "Duplicate the campaign",
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "schedule") {
      run(`${campaign.name} scheduled`, () => api.scheduleCampaign(campaign.id, when));
    } else if (kind === "cost") {
      run("Cost recorded", () => api.recordCampaignCost(campaign.id, cost));
    } else if (kind === "cancel") {
      run(`${campaign.name} cancelled`, () => api.cancelCampaign(campaign.id, reason));
    } else if (kind === "duplicate") {
      run("Copy created as a draft", () => api.duplicateCampaign(campaign.id, code));
    } else {
      run("Delivery recorded", () =>
        api.recordDelivery(campaign.id, {
          sent_count: Number(counts.sent_count) || 0,
          opened_count: Number(counts.opened_count) || 0,
          clicked_count: Number(counts.clicked_count) || 0,
          bounced_count: Number(counts.bounced_count) || 0,
        }),
      );
    }
  }

  return (
    <Modal open title={titles[kind]} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {kind === "schedule" && (
          <Field label="Date" hint="Puts a date on it without committing the spend.">
            <input type="date" className="input" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </Field>
        )}

        {kind === "cost" && (
          <>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              What it actually cost, as opposed to the {money(campaign.budget)} budgeted. This is
              what cost per lead and cost per sale are worked out from.
            </p>
            <Field label="Cost">
              <input
                type="number"
                min={0}
                step="100"
                className="input"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
            </Field>
          </>
        )}

        {kind === "cancel" && (
          <>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Money was committed against it and somebody will ask what happened, so a reason is
              required.
            </p>
            <Field label="Why">
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={3}
                placeholder="Budget pulled"
              />
            </Field>
          </>
        )}

        {kind === "duplicate" && (
          <>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              The copy keeps the content and the budget and starts as a draft. Its results stay with
              the original — carrying them across would be the most misleading possible default.
            </p>
            <Field label="New code">
              <input
                className="input font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </Field>
          </>
        )}

        {kind === "delivery" && (
          <>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              These are checked against each other — more opens than sends, or more clicks than
              opens, means the figures came from somewhere they should not have.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["sent_count", "Sent"],
                  ["opened_count", "Opened"],
                  ["clicked_count", "Clicked"],
                  ["bounced_count", "Bounced"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={counts[key]}
                    onChange={(e) => setCounts((c) => ({ ...c, [key]: e.target.value }))}
                  />
                </Field>
              ))}
            </div>
          </>
        )}

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {kind === "cancel" ? "Keep it" : "Cancel"}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
