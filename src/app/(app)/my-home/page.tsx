"use client";

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
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

export default function MyHomePage() {
  const home = useAsync(() => api.homeownerHome(), []);
  const claims = useAsync(() => api.homeownerWarranty(), []);
  const [open, setOpen] = useState(false);

  if (home.loading) return <Loading label="Loading your home" />;
  if (home.error) return <ErrorNote message={home.error} />;
  if (!home.data) return null;

  const first = home.data.homes[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${home.data.buyer_name}`}
        subtitle="Your home, its progress and your warranty claims."
        action={
          first && (
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              Submit a warranty claim
            </button>
          )
        }
      />

      {home.data.homes.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
            No homes are linked to your account yet.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {home.data.homes.map((h) => (
              <StatTile
                key={h.job_id}
                label={`Home ${h.job_number}`}
                value={titleCase(h.status)}
                hint={
                  h.closing_date
                    ? `Closed ${day(h.closing_date)}`
                    : h.projected_completion
                      ? `Expected ${day(h.projected_completion)}`
                      : undefined
                }
              />
            ))}
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {home.data.homes.map((h) => (
              <Card key={h.job_id} title={`Home ${h.job_number}`}>
                <div className="space-y-3 text-sm">
                  <Row label="Status" value={<StatusBadge status={h.status} />} />
                  <Row label="Purchase price" value={money(h.contract_total)} />
                  <Row label="Expected completion" value={day(h.projected_completion)} />
                  <Row label="Closing" value={day(h.closing_date)} />
                  <Row
                    label="Open claims"
                    value={
                      h.open_warranty_claims ? (
                        <Badge tone="warn">{h.open_warranty_claims}</Badge>
                      ) : (
                        <Badge tone="ok">None</Badge>
                      )
                    }
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card title="Your warranty claims" padded={false}>
        {claims.loading ? (
          <Loading />
        ) : (
          <DataTable
            columns={[
              { key: "no", label: "Reference" },
              { key: "issue", label: "Issue" },
              { key: "status", label: "Status" },
              { key: "orders", label: "Work scheduled", align: "right" },
              { key: "date", label: "Submitted", align: "right" },
            ]}
            empty="You have not submitted any warranty claims."
          >
            {(claims.data ?? []).map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.request_number}</td>
                <td>
                  <div>{c.title}</div>
                  {c.location && (
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {c.location}
                    </div>
                  )}
                </td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td className="num text-sm">
                  {c.service_orders.length
                    ? c.service_orders
                        .map((o) => (o.scheduled_date ? day(o.scheduled_date) : "To be scheduled"))
                        .join(", ")
                    : "Being reviewed"}
                </td>
                <td className="num text-sm">{day(c.submitted_date)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      {first && (
        <NewClaim
          open={open}
          jobId={first.job_id}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            claims.reload();
            home.reload();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="tnum text-right">{value}</span>
    </div>
  );
}

function NewClaim({
  open,
  jobId,
  onClose,
  onDone,
}: {
  open: boolean;
  jobId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.homeownerSubmitClaim({
        job_id: jobId,
        title,
        location: location || undefined,
        description: description || undefined,
        priority,
      });
      setTitle("");
      setLocation("");
      setDescription("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the claim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Submit a warranty claim" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="What is the problem?">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Cracked tile in the master bathroom"
          />
        </Field>
        <Field label="Where in the home?">
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Any more detail?">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Urgency" hint="Choose emergency only for no heat, no water or an active leak.">
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
