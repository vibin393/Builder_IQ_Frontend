"use client";

/**
 * Where leads come from when nobody types them in.
 *
 * The page is built around the two questions somebody actually opens it to ask,
 * and they are not "what is configured":
 *
 *  1. **Is anything stuck?** Payloads we received and could not read. Each one is
 *     a real person who enquired and has had no reply. That number goes first, in
 *     red, and the queue that clears it is on the same screen.
 *  2. **Has a channel gone quiet?** A feed that stops sending produces no error at
 *     all - just fewer leads than last month and no reason why. "Last heard" per
 *     channel is the only thing that makes it visible, so it is a column rather
 *     than something you work out.
 *
 * Configuration comes third, because it is read once and then left alone.
 */

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
  day,
  titleCase,
} from "@/components/ui";
import { useConfirm } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { IntakeEvent, IntakeKind, IntakeSource, IntakeSourceCreated } from "@/types/api";

/** What each channel is, in the words a builder would use. */
const KINDS: { kind: IntakeKind; label: string; hint: string }[] = [
  {
    kind: "web_form",
    label: "Website form",
    hint: "Your own enquiry form posts straight to us. The one channel fully under your control.",
  },
  {
    kind: "rightmove",
    label: "Rightmove",
    hint: "Register the URL below with Rightmove as your enquiry destination.",
  },
  { kind: "zoopla", label: "Zoopla", hint: "Same as Rightmove: register the URL with them." },
  { kind: "onthemarket", label: "OnTheMarket", hint: "Register the URL with them." },
  {
    kind: "meta_lead_ads",
    label: "Facebook lead ads",
    hint: "Needs a Meta app on your side before Facebook will send to this URL.",
  },
  {
    kind: "google_lead_form",
    label: "Google lead forms",
    hint: "Needs a Google service account on your side.",
  },
  {
    kind: "email",
    label: "Enquiries inbox",
    hint: "For portals that only ever send an email. The most fragile option - use it last.",
  },
  {
    kind: "generic",
    label: "Something else",
    hint: "Anything with no adapter yet. Give it a field map saying which of their fields means which of ours.",
  },
];

const LEAD_SOURCES = [
  "website",
  "portal",
  "social",
  "campaign",
  "referral",
  "realtor",
  "signage",
  "event",
  "walk_in",
  "other",
];

function kindLabel(kind: string) {
  return KINDS.find((k) => k.kind === kind)?.label ?? titleCase(kind);
}

/** Green while it is delivering, amber when it has never been heard from. */
function healthTone(s: { received_count: number; failed_count: number; is_active: boolean }) {
  if (!s.is_active) return "neutral" as const;
  if (s.failed_count > 0) return "danger" as const;
  if (s.received_count === 0) return "warn" as const;
  return "ok" as const;
}

export default function IntakeSourcesPage() {
  const health = useAsync(() => api.intakeHealth(), []);
  const sources = useAsync(() => api.listIntakeSources(), []);
  const failed = useAsync(() => api.failedIntakeEvents(), []);
  const communities = useAsync(() => api.listCommunities(), []);

  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<IntakeSourceCreated | null>(null);
  const [inspecting, setInspecting] = useState<IntakeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    health.reload();
    sources.reload();
    failed.reload();
  };

  const act = async (done: string, fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      toast.success(done);
      refresh();
    } catch (err) {
      toast.error(
        "That did not go through",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    }
  };

  const stuck = health.data?.needs_attention ?? 0;
  const quiet = (health.data?.sources ?? []).filter(
    (s) => s.is_active && s.received_count === 0,
  ).length;
  const captured = health.data?.events_by_status?.accepted ?? 0;
  const linked = health.data?.events_by_status?.duplicate ?? 0;

  return (
    <>
      <PageHeader
        title="Lead sources"
        subtitle="The channels leads arrive through without anybody typing them in. Every payload is stored the moment it lands, before we try to read it — so a feed that changes its field names costs a delay, never a customer."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/leads" className="btn btn-ghost">
              Back to leads
            </Link>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Add a channel
            </button>
          </div>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Needs attention"
          value={stuck}
          hint="Received and unreadable"
          tone={stuck > 0 ? "danger" : "ok"}
        />
        <StatTile
          label="Never heard from"
          value={quiet}
          hint="Active channels with no traffic"
          tone={quiet > 0 ? "warn" : "default"}
        />
        <StatTile label="Leads captured" value={captured} hint="New records created" />
        <StatTile
          label="Repeat enquiries"
          value={linked}
          hint="Linked to a lead we already had"
        />
      </div>

      {/* The queue goes above the configuration: it is the only thing on this page
          that is costing money right now. */}
      {(failed.data?.total ?? 0) > 0 && (
        <Card title="Enquiries we could not read" padded={false}>
          <p className="px-5 py-3 text-sm" style={{ color: "var(--fg-muted)" }}>
            Held, not lost. Fix the field map and replay, or capture the lead by hand from the
            payload — either way the enquiry is still here.
          </p>
          <DataTable
            columns={[
              { key: "when", label: "Arrived" },
              { key: "reason", label: "Why it failed" },
              { key: "actions", label: "", align: "right" },
            ]}
            empty="Nothing stuck."
          >
            {(failed.data?.items ?? []).map((e) => (
              <tr key={e.id}>
                <td className="text-sm">{day(e.created_at)}</td>
                <td className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {e.error}
                </td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => setInspecting(e)}>
                    View payload
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      act("Payload replayed", async () => {
                        const r = await api.replayIntakeEvent(e.id);
                        if (r.status === "duplicate") {
                          toast.info("Matched an existing lead", "No new record was created.");
                        }
                      })
                    }
                  >
                    Replay
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      <div className="mt-6">
        <Card padded={false} title="Channels">
          {sources.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "name", label: "Channel" },
                { key: "kind", label: "Type" },
                { key: "attr", label: "Records as" },
                { key: "heard", label: "Last heard" },
                { key: "counts", label: "Received / kept / stuck", align: "right" },
                { key: "actions", label: "", align: "right" },
              ]}
              empty="No channels yet. Start with your own website form — it needs nothing from a third party."
            >
              {(sources.data ?? []).map((s) => {
                const stats = health.data?.sources.find((x) => x.id === s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="font-medium">{s.name}</span>
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        /intake/hooks/{s.code} · key ends {s.key_hint}
                      </div>
                    </td>
                    <td className="text-sm">{kindLabel(s.kind)}</td>
                    <td className="text-sm">
                      <Badge tone="neutral">{titleCase(s.lead_source)}</Badge>
                      {s.default_campaign && (
                        <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {s.default_campaign}
                        </div>
                      )}
                      {!s.auto_assign && (
                        <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          not auto-assigned
                        </div>
                      )}
                    </td>
                    <td className="text-sm">
                      {stats?.last_received_at ? (
                        day(stats.last_received_at)
                      ) : (
                        <Badge tone="warn">Never</Badge>
                      )}
                      {!s.is_active && (
                        <div className="mt-0.5">
                          <Badge tone="neutral">Paused</Badge>
                        </div>
                      )}
                    </td>
                    <td className="num tnum text-sm">
                      <span style={{ color: healthTone(s) === "danger" ? "var(--danger)" : undefined }}>
                        {s.received_count} / {s.accepted_count} / {s.failed_count}
                      </span>
                    </td>
                    <td className="num">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          act(
                            s.is_active ? `${s.name} paused` : `${s.name} resumed`,
                            () =>
                              s.is_active
                                ? api.pauseIntakeSource(s.id)
                                : api.resumeIntakeSource(s.id),
                          )
                        }
                      >
                        {s.is_active ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          // Confirmed, because the old key stops working the moment
                          // this returns and whatever is using it goes silent.
                          confirm({
                            title: `Issue a new key for ${s.name}?`,
                            body: "The current key stops working immediately — there is no grace period, because a key is rotated when it has leaked. Whatever is using it will stop sending until you update it.",
                            confirmLabel: "Issue new key",
                            tone: "danger",
                            onConfirm: async () => {
                              try {
                                setIssued(await api.rotateIntakeKey(s.id));
                                refresh();
                              } catch (err) {
                                toast.error(
                                  "Could not rotate the key",
                                  err instanceof Error ? err.message : undefined,
                                );
                              }
                            },
                          })
                        }
                      >
                        New key
                      </button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      </div>

      {adding && (
        <AddChannel
          communities={communities.data ?? []}
          onClose={() => setAdding(false)}
          onCreated={(created) => {
            setAdding(false);
            setIssued(created);
            refresh();
          }}
        />
      )}

      {issued && <KeyIssued created={issued} onClose={() => setIssued(null)} />}

      {confirmDialog}

      {inspecting && (
        <Modal open title="What actually arrived" onClose={() => setInspecting(null)}>
          <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
            {inspecting.error}
          </p>
          <pre
            className="max-h-80 overflow-auto rounded-[var(--radius)] p-3 text-xs"
            style={{ background: "var(--neutral-soft)" }}
          >
            {JSON.stringify(inspecting.payload, null, 2)}
          </pre>
          <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
            Compare these field names with what the channel is configured to expect. Correct the
            field map, then Replay — or capture the lead by hand from what you see here.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setInspecting(null)}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const e = inspecting;
                setInspecting(null);
                void act("Payload replayed", () => api.replayIntakeEvent(e.id));
              }}
            >
              Replay
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------- the key once */

function KeyIssued({ created, onClose }: { created: IntakeSourceCreated; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      // Clipboard is blocked in some browsers and over plain HTTP. The value is
      // on screen and selectable, so this is a convenience, not the mechanism.
      setCopied(null);
    }
  };

  return (
    <Modal open title={`${created.source.name} — key issued`} onClose={onClose}>
      <div
        className="mb-4 rounded-[var(--radius)] px-3 py-2 text-sm"
        style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
      >
        {created.warning}
      </div>

      <Field label="Post enquiries to" hint="Give this URL to whoever is sending you leads.">
        <div className="flex gap-2">
          <input className="input font-mono text-xs" readOnly value={created.post_url} />
          <button className="btn btn-ghost btn-sm" onClick={() => copy("url", created.post_url)}>
            {copied === "url" ? "Copied" : "Copy"}
          </button>
        </div>
      </Field>

      <div className="mt-4">
        <Field label="Key" hint="Sent as the X-Intake-Key header, or as a 'key' field in the body.">
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={created.key} />
            <button className="btn btn-ghost btn-sm" onClick={() => copy("key", created.key)}>
              {copied === "key" ? "Copied" : "Copy"}
            </button>
          </div>
        </Field>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">Example for your web developer</summary>
        <pre
          className="mt-2 overflow-auto rounded-[var(--radius)] p-3 text-xs"
          style={{ background: "var(--neutral-soft)" }}
        >
{`curl -X POST ${created.post_url} \\
  -H "X-Intake-Key: ${created.key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Ama Boateng",
    "email": "ama@example.com",
    "telephone": "07700 900123",
    "postcode": "BH15 1AA",
    "bedrooms": 4,
    "budget": "465000",
    "message": "Interested in the Maple."
  }'`}
        </pre>
        <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
          Field names are matched loosely — <code>name</code> or <code>first_name</code>/<code>last_name</code>,{" "}
          <code>phone</code> or <code>telephone</code>, and so on. Send what
          your form already collects and check the channel afterwards; anything unrecognised lands in
          the queue above with the payload intact.
        </p>
      </details>

      <div className="mt-5 flex justify-end">
        <button className="btn btn-primary" onClick={onClose}>
          I have copied the key
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- add a channel */

function AddChannel({
  communities,
  onClose,
  onCreated,
}: {
  communities: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (created: IntakeSourceCreated) => void;
}) {
  const [form, setForm] = useState({
    kind: "web_form" as IntakeKind,
    code: "website",
    name: "Website enquiry form",
    lead_source: "website",
    default_community_id: "",
    default_campaign: "",
    honeypot_field: "website_url",
    rate_limit_per_minute: "30",
    auto_assign: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = KINDS.find((k) => k.kind === form.kind)!;

  // Choosing a type fills in a sensible code, name and attribution, because
  // somebody adding Rightmove should not have to decide what to call it.
  const pickKind = (kind: IntakeKind) => {
    const preset = KINDS.find((k) => k.kind === kind)!;
    const portal = ["rightmove", "zoopla", "onthemarket", "email"].includes(kind);
    setForm((f) => ({
      ...f,
      kind,
      code: kind === "web_form" ? "website" : kind.replaceAll("_", "-"),
      name: preset.label,
      lead_source: kind === "web_form" ? "website" : portal ? "portal" : "social",
      // Only a form a human fills in can have a honeypot. A webhook has no form.
      honeypot_field: kind === "web_form" ? "website_url" : "",
    }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await api.createIntakeSource({
          kind: form.kind,
          code: form.code,
          name: form.name,
          lead_source: form.lead_source,
          default_community_id: form.default_community_id || undefined,
          default_campaign: form.default_campaign || undefined,
          honeypot_field: form.honeypot_field || undefined,
          rate_limit_per_minute: Number(form.rate_limit_per_minute) || 30,
          auto_assign: form.auto_assign,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the channel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Add a lead source" onClose={onClose}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <Field label="What is sending the leads">
          <select
            className="input"
            value={form.kind}
            onChange={(e) => pickKind(e.target.value as IntakeKind)}
          >
            {KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          {chosen.hint}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="What you will call it on this screen.">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Code" hint="Appears in the URL leads are posted to.">
            <input
              className="input font-mono"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*"
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Record leads as"
            hint="Two web forms can be attributed differently — the website and a parade microsite."
          >
            <select
              className="input"
              value={form.lead_source}
              onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Campaign" hint="The channel cannot know this; you can.">
            <input
              className="input"
              value={form.default_campaign}
              onChange={(e) => setForm({ ...form, default_campaign: e.target.value })}
              placeholder="autumn-2026"
            />
          </Field>
        </div>

        <Field
          label="Community of interest"
          hint="Used when the channel does not tell us which one. Without it every automated lead arrives unattributed."
        >
          <select
            className="input"
            value={form.default_community_id}
            onChange={(e) => setForm({ ...form, default_community_id: e.target.value })}
          >
            <option value="">None</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        {form.kind === "web_form" && (
          <Field
            label="Spam trap field"
            hint="A hidden field on your form that a person never sees. Anything arriving with it filled in is a bot and is refused rather than captured."
          >
            <input
              className="input font-mono"
              value={form.honeypot_field}
              onChange={(e) => setForm({ ...form, honeypot_field: e.target.value })}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Most per minute" hint="From one address. 0 turns the limit off.">
            <input
              type="number"
              min={0}
              className="input"
              value={form.rate_limit_per_minute}
              onChange={(e) => setForm({ ...form, rate_limit_per_minute: e.target.value })}
            />
          </Field>
          <Field label="Assignment">
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.auto_assign}
                onChange={(e) => setForm({ ...form, auto_assign: e.target.checked })}
              />{" "}
              Share out between sales staff in turn
            </label>
          </Field>
        </div>
        <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
          Turn that off and automated leads land in the Unassigned queue for a manager to hand out.
        </p>

        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create and show key"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
