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
  Tabs,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { CoverageStatus, Priority, WarrantyCategory } from "@/types/api";

const CATEGORIES: WarrantyCategory[] = [
  "structural", "roofing", "plumbing", "electrical", "heating", "exterior",
  "interior", "joinery", "appliance", "damp", "drainage", "landscaping", "other",
];

function priorityTone(p: Priority) {
  return p === "emergency" ? "danger" : p === "high" ? "warn" : "neutral";
}

function coverageTone(c: CoverageStatus) {
  return c === "in_warranty"
    ? "ok"
    : c === "out_of_warranty"
      ? "danger"
      : c === "goodwill"
        ? "brand"
        : "neutral";
}

type TabName = "Claims" | "Callbacks by trade";

export default function WarrantyPage() {
  const summary = useAsync(() => api.warrantySummary(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const [tab, setTab] = useState<TabName>("Claims");
  const [filters, setFilters] = useState<{
    status?: string;
    priority?: string;
    category?: string;
    coverage?: string;
    overdue?: boolean;
  }>({});
  const [open, setOpen] = useState(false);

  const requests = useAsync(
    () => api.listWarrantyRequests(filters),
    [filters.status, filters.priority, filters.category, filters.coverage, filters.overdue],
  );

  const job = byId(jobs.data);
  const s = summary.data;

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  return (
    <>
      <PageHeader
        title="Warranty"
        subtitle="Homeowner claims after closing — acknowledged against an SLA, assessed for cover, and dispatched to the trades who did the work."
        action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Log a claim
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open claims" value={s?.open ?? "—"} tone={s?.open ? "warn" : "ok"} />
        <StatTile
          label="Overdue (SLA)"
          value={s?.overdue ?? "—"}
          tone={s?.overdue ? "danger" : "ok"}
          hint="Past the response target"
        />
        <StatTile
          label="Emergencies open"
          value={s?.emergency_open ?? "—"}
          tone={s?.emergency_open ? "danger" : "ok"}
          hint="Habitability — no heat, water or active leak"
        />
        <StatTile
          label="Awaiting assessment"
          value={s?.unassessed ?? "—"}
          tone={s?.unassessed ? "warn" : "ok"}
          hint="Coverage not yet decided"
        />
        <StatTile
          label="Avg resolution"
          value={s?.avg_resolution_days != null ? `${s.avg_resolution_days} days` : "—"}
        />
        <StatTile label="Open service orders" value={s?.service_orders_open ?? "—"} />
        <StatTile
          label="Back-charges"
          value={money(s?.back_charge_total)}
          hint="Recoverable from trades"
        />
        <StatTile
          label="Upcoming visits"
          value={s?.appointments_upcoming ?? "—"}
          hint="Scheduled appointments"
        />
      </div>

      <Tabs
        tabs={["Claims", "Callbacks by trade"] as const}
        active={tab}
        onChange={setTab}
        counts={{ Claims: s?.open }}
      />

      {tab === "Claims" ? (
        <Card title="Claims" padded={false}>
          <div className="flex flex-wrap gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <select className="input max-w-[9rem]" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">All statuses</option>
              {["submitted", "acknowledged", "triaged", "in_progress", "resolved", "closed", "declined"].map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
            <select className="input max-w-[9rem]" value={filters.priority ?? ""} onChange={(e) => setFilter("priority", e.target.value)}>
              <option value="">All priorities</option>
              {["emergency", "high", "normal", "low"].map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
            <select className="input max-w-[9rem]" value={filters.category ?? ""} onChange={(e) => setFilter("category", e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
            <select className="input max-w-[9rem]" value={filters.coverage ?? ""} onChange={(e) => setFilter("coverage", e.target.value)}>
              <option value="">All coverage</option>
              {["pending", "in_warranty", "out_of_warranty", "goodwill"].map((x) => (
                <option key={x} value={x}>{titleCase(x)}</option>
              ))}
            </select>
            <label className="btn btn-ghost btn-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!filters.overdue}
                onChange={(e) => setFilters((f) => ({ ...f, overdue: e.target.checked || undefined }))}
              />
              Overdue only
            </label>
          </div>

          {requests.loading ? (
            <Loading />
          ) : (
            <DataTable
              columns={[
                { key: "no", label: "Request" },
                { key: "home", label: "Home" },
                { key: "issue", label: "Issue" },
                { key: "cat", label: "Category" },
                { key: "pri", label: "Priority" },
                { key: "cov", label: "Coverage" },
                { key: "due", label: "Due" },
                { key: "status", label: "Status" },
              ]}
              empty="No warranty claims match these filters."
            >
              {(requests.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/warranty/${r.id}`} className="font-medium" style={{ color: "var(--brand)" }}>
                      {r.request_number}
                    </Link>
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{day(r.submitted_date)}</div>
                  </td>
                  <td>{job.get(r.job_id)?.job_number ?? "—"}</td>
                  <td>
                    <div>{r.title}</div>
                    {r.location && (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{r.location}</div>
                    )}
                  </td>
                  <td><Badge tone="neutral">{titleCase(r.category)}</Badge></td>
                  <td><Badge tone={priorityTone(r.priority)}>{titleCase(r.priority)}</Badge></td>
                  <td><Badge tone={coverageTone(r.coverage)}>{titleCase(r.coverage)}</Badge></td>
                  <td className="text-sm">
                    {r.is_overdue ? (
                      <span style={{ color: "var(--danger)", fontWeight: 600 }}>{day(r.due_date)}</span>
                    ) : (
                      <span style={{ color: "var(--fg-muted)" }}>{day(r.due_date)}</span>
                    )}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Card>
      ) : (
        <Card title="Callbacks by trade" padded={false}>
          <DataTable
            columns={[
              { key: "trade", label: "Trade" },
              { key: "orders", label: "Service orders", align: "right" },
              { key: "bc", label: "Back-charges", align: "right" },
              { key: "share", label: "Share", align: "right" },
            ]}
            empty="No service orders in the window yet."
          >
            {(s?.callbacks_by_trade ?? []).map((t) => (
              <tr key={t.vendor_id ?? t.vendor_name}>
                <td>
                  <div className="font-medium">{t.vendor_name}</div>
                  {t.vendor_code && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{t.vendor_code}</div>
                  )}
                </td>
                <td className="num">{t.service_orders}</td>
                <td className="num">
                  {t.back_charges ? <Badge tone="warn">{t.back_charges}</Badge> : "—"}
                </td>
                <td className="num">{(t.share * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </DataTable>
          <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
            The trade that keeps coming back is a purchasing decision, not just a support metric. Back-charges are what you can recover from them.
          </p>
        </Card>
      )}

      <NewClaim
        open={open}
        jobs={jobs.data ?? []}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          requests.reload();
          summary.reload();
        }}
      />
    </>
  );
}

function NewClaim({
  open,
  jobs,
  onClose,
  onDone,
}: {
  open: boolean;
  jobs: { id: string; job_number: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("other");
  const [reportedVia, setReportedVia] = useState("portal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createWarrantyRequest({
        job_id: jobId,
        title,
        location: location || undefined,
        description: description || undefined,
        priority,
        category,
        reported_via: reportedVia,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log the claim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Log a warranty claim" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Home">
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)} required>
            <option value="">Select…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.job_number}</option>
            ))}
          </select>
        </Field>
        <Field label="Issue">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Cracked tile in master bathroom" />
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Master bathroom" />
          </Field>
          <Field label="Reported via">
            <select className="input" value={reportedVia} onChange={(e) => setReportedVia(e.target.value)}>
              <option value="portal">Homeowner portal</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="site">On site</option>
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Log claim"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
