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
import type { BallInCourt, Submittal, SubmittalType } from "@/types/api";

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

function typeLabel(t: string) {
  if (t === "o_and_m") return "O&M manual";
  if (t === "mep") return "MEP";
  return titleCase(t);
}

function courtTone(court: BallInCourt) {
  if (court === "closed") return "neutral" as const;
  if (court === "trade") return "warn" as const;
  return "brand" as const;
}

export default function SubmittalsPage() {
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [atRiskOnly, setAtRiskOnly] = useState(false);

  const submittals = useAsync(
    () =>
      api.listSubmittals({
        job_id: jobFilter || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        at_risk_only: atRiskOnly || undefined,
      }),
    [jobFilter, statusFilter, typeFilter, atRiskOnly],
  );
  const summary = useAsync(() => api.submittalSummary(jobFilter || undefined), [jobFilter]);
  const jobs = useAsync(() => api.jobOptions(), []);
  const vendors = useAsync(() => api.listVendors(), []);
  const options = useAsync(() => api.listOptions(), []);
  const plans = useAsync(() => api.listPlans(), []);

  const [newOpen, setNewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vendor = byId(vendors.data);
  const option = byId(options.data);

  const rows = submittals.data ?? [];
  const s = summary.data;

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  async function create(form: FormData) {
    setError(null);
    try {
      await api.createSubmittal({
        title: String(form.get("title")),
        job_id: String(form.get("job_id") || "") || undefined,
        plan_id: String(form.get("plan_id") || "") || undefined,
        submittal_type: String(form.get("submittal_type") || "product_data"),
        priority: String(form.get("priority") || "normal"),
        description: String(form.get("description") || "") || undefined,
        spec_section: String(form.get("spec_section") || "") || undefined,
        manufacturer: String(form.get("manufacturer") || "") || undefined,
        model_number: String(form.get("model_number") || "") || undefined,
        vendor_id: String(form.get("vendor_id") || "") || undefined,
        option_id: String(form.get("option_id") || "") || undefined,
        required_on_site: String(form.get("required_on_site") || "") || undefined,
        lead_time_days: Number(form.get("lead_time_days") || 0),
        due_on: String(form.get("due_on") || "") || undefined,
        submit_now: form.get("submit_now") !== null,
      });
      setNewOpen(false);
      submittals.reload();
      summary.reload();
    } catch (err) {
      fail(err, "Could not create the submittal");
    }
  }

  return (
    <>
      <PageHeader
        title="Submittals"
        subtitle="What a trade proposes to actually install, approved before it is ordered. Linking a submittal to the buyer's selection proves the fitting matches what they chose."
        action={
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            New submittal
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Submittals" value={s?.total ?? "—"} />
        <StatTile
          label="Awaiting review"
          value={s?.awaiting_review ?? "—"}
          tone={s?.awaiting_review ? "warn" : "ok"}
          hint="We owe a decision"
        />
        <StatTile label="Overdue" value={s?.overdue ?? "—"} tone={s?.overdue ? "danger" : "ok"} />
        <StatTile label="Being revised" value={s?.being_revised ?? "—"} hint="Back with the trade" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Procurement at risk"
          value={s?.at_risk ?? "—"}
          tone={s?.at_risk ? "danger" : "ok"}
          hint="Not enough runway to order in time"
        />
        <StatTile label="Approved" value={s?.approved ?? "—"} tone="ok" />
        <StatTile
          label="Avg review"
          value={s?.avg_review_days != null ? `${s.avg_review_days}d` : "—"}
          hint="Submitted to returned"
        />
        <StatTile label="With the trade" value={s?.ball_with_trade ?? "—"} hint="Waiting on them" />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      <Card
        title="Submittal register"
        padded={false}
        action={
          <div className="flex flex-wrap gap-2">
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Any type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
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
              {[
                "draft",
                "submitted",
                "under_review",
                "approved",
                "approved_as_noted",
                "revise_and_resubmit",
                "rejected",
              ].map((st) => (
                <option key={st} value={st}>
                  {titleCase(st)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={atRiskOnly}
                onChange={(e) => setAtRiskOnly(e.target.checked)}
              />
              At risk only
            </label>
          </div>
        }
      >
        {submittals.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "no", label: "No." },
              { key: "title", label: "Item" },
              { key: "trade", label: "Trade" },
              { key: "sel", label: "Buyer selection" },
              { key: "court", label: "Ball in court" },
              { key: "rev", label: "Rev", align: "right" },
              { key: "status", label: "Status" },
              { key: "req", label: "On site" },
              { key: "act", label: "" },
            ]}
            empty="No submittals match."
          >
            {rows.map((sub) => (
              <tr
                key={sub.id}
                style={
                  sub.is_at_risk
                    ? { background: "var(--danger-soft)" }
                    : sub.is_overdue
                      ? { background: "var(--warn-soft)" }
                      : undefined
                }
              >
                <td className="tnum font-medium">
                  <Link href={`/submittals/${sub.id}`} className="hover:underline">
                    {sub.submittal_number}
                  </Link>
                </td>
                <td>
                  <Link href={`/submittals/${sub.id}`} className="font-medium hover:underline">
                    {sub.title}
                  </Link>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {[
                      typeLabel(sub.submittal_type),
                      sub.manufacturer,
                      sub.model_number,
                      sub.spec_section && `Spec ${sub.spec_section}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {sub.is_at_risk && <Badge tone="danger">Procurement at risk</Badge>}
                    {sub.priority === "urgent" && <Badge tone="danger">Urgent</Badge>}
                  </div>
                </td>
                <td>{sub.vendor_id ? (vendor.get(sub.vendor_id)?.name ?? "—") : "—"}</td>
                <td>
                  {sub.option_id ? (
                    <Badge tone="brand">{option.get(sub.option_id)?.name ?? "Linked"}</Badge>
                  ) : (
                    <span style={{ color: "var(--fg-subtle)" }}>—</span>
                  )}
                </td>
                <td>
                  <Badge tone={courtTone(sub.ball_in_court)}>{titleCase(sub.ball_in_court)}</Badge>
                </td>
                <td className="num tnum">{sub.revision}</td>
                <td>
                  <StatusBadge status={sub.status} />
                </td>
                <td>
                  <span style={{ color: sub.is_at_risk ? "var(--danger)" : undefined }}>
                    {day(sub.required_on_site)}
                  </span>
                </td>
                <td>
                  <div className="flex justify-end">
                    <Link href={`/submittals/${sub.id}`} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={newOpen} title="New submittal" onClose={() => setNewOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(new FormData(e.currentTarget));
          }}
        >
          <Field label="Item">
            <input name="title" className="input" required placeholder="Kitchen tap — brushed nickel" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select name="submittal_type" className="input" defaultValue="product_data">
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
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
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manufacturer">
              <input name="manufacturer" className="input" />
            </Field>
            <Field label="Model number">
              <input name="model_number" className="input" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trade">
              <select name="vendor_id" className="input" defaultValue="">
                <option value="">None</option>
                {(vendors.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Buyer selection" hint="Ties the fitting to what was chosen.">
              <select name="option_id" className="input" defaultValue="">
                <option value="">None</option>
                {(options.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Spec section">
              <input name="spec_section" className="input" placeholder="22 40 00" />
            </Field>
            <Field label="Needed on site">
              <input name="required_on_site" type="date" className="input" />
            </Field>
            <Field label="Lead time (days)" hint="Manufacture + delivery.">
              <input name="lead_time_days" type="number" min={0} className="input" defaultValue={0} />
            </Field>
          </div>
          <Field label="Review due">
            <input name="due_on" type="date" className="input" />
          </Field>
          <Field label="Description">
            <textarea name="description" className="input" rows={2} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="submit_now" defaultChecked />
            Submit for review now (otherwise saved as a draft)
          </label>
          <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
            Leave the review due date blank and it is set from the priority — urgent 3 days,
            high 7, normal 10, low 14. Needed-on-site and lead time drive the procurement warning.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
