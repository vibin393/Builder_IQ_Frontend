"use client";

import { Button } from "@/components/Button";
import { EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { byId, useAsync } from "@/lib/hooks";
import type { Lot } from "@/types/api";

export default function LabelsPage() {
  const jobs = useAsync(() => api.listJobs({ size: 200 } as never).then((p) => p.items), []);
  const lots = useAsync(async () => {
    const comms = await api.listCommunities();
    const all = await Promise.all(comms.map((c) => api.listLots(c.id).catch(() => [] as Lot[])));
    return all.flat();
  }, []);

  const loading = jobs.loading || lots.loading;
  const lotById = byId(lots.data);
  const rows = (jobs.data ?? []).map((j) => {
    const lot = lotById.get(j.lot_id);
    return { id: j.id, name: j.elevation || `Home ${j.job_number}`, address: lot?.address || "", number: j.job_number };
  });

  return (
    <>
      <PageHeader
        title="Labels"
        subtitle="Printable address labels for every home — for site packs, mailers and signage."
        action={<Button variant="primary" onClick={() => window.print()}>Print labels</Button>}
      />
      {(jobs.error || lots.error) && <ErrorNote message={jobs.error || lots.error || ""} />}
      {loading ? (
        <Loading label="Loading labels" />
      ) : rows.length === 0 ? (
        <EmptyState title="No homes to label" />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", background: "var(--surface)", minHeight: 96 }}
            >
              <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>{r.number}</div>
              <div className="text-base font-semibold">{r.name}</div>
              <div className="mt-1 text-sm" style={{ color: "var(--fg-muted)", whiteSpace: "pre-line" }}>
                {r.address || "No address on file"}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
