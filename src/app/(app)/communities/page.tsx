"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/Button";
import { COMMUNITY_STATUSES, CommunityForm, PlotBar } from "@/components/CommunityForm";
import { AnimatedNumber } from "@/components/feedback";
import { useToast } from "@/components/Toast";
import { Card, DataTable, ErrorNote, Loading, PageHeader, StatTile, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { CommunityStatus } from "@/types/api";

export default function CommunitiesPage() {
  const [status, setStatus] = useState<CommunityStatus | "">("");
  const communities = useAsync(() => api.listCommunities(status || undefined), [status]);
  const portfolio = useAsync(() => api.communityPortfolio(), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const p = portfolio.data;

  return (
    <>
      <PageHeader
        title="Communities"
        subtitle="Developments, released a phase at a time. A plot's status is its sales position — a home being built on it is shown separately, so a speculative home stays on sale."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New community
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Selling now"
          value={p?.by_status.selling ?? 0}
          hint={p ? `${p.communities} developments · ${p.by_status.planning ?? 0} in planning` : undefined}
        />
        <StatTile
          label="Plots for sale"
          value={<AnimatedNumber value={p?.plots.available ?? 0} />}
          tone={p && !p.plots.available && p.by_status.selling ? "danger" : "default"}
          hint={p ? `${p.plots.held} on hold · ${p.unreleased_plots} not released` : undefined}
        />
        <StatTile
          label="Sales, last 90 days"
          value={p?.sales_90_days ?? "—"}
          hint={p ? `${(p.sales_90_days / 3).toFixed(1)} a month across the portfolio` : undefined}
        />
        <StatTile
          label="Spec homes"
          value={p?.spec_homes ?? "—"}
          tone={p?.spec_homes ? "warn" : "ok"}
          hint="Being built with no buyer — stock to sell"
        />
        <StatTile
          label="Holds ending this week"
          value={p?.holds_expiring_soon ?? "—"}
          tone={p?.holds_expiring_soon ? "warn" : "ok"}
          hint="Chase the buyer or let the plot go back on sale"
        />
        <StatTile
          label="Sold, not handed over"
          value={p?.plots.sold ?? "—"}
          hint={p ? `${p.plots.closed} handed over to date` : undefined}
        />
        <StatTile label="Live homes" value={p?.live_homes ?? "—"} hint="Started and not yet handed over" />
        <StatTile label="Total plots" value={p?.plots.total ?? "—"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "" as const, label: "All" }, ...COMMUNITY_STATUSES].map((s) => (
          <button
            key={s.value || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setStatus(s.value)}
            style={status === s.value ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {s.label.split(" — ")[0]}
            {s.value && p?.by_status[s.value] ? ` (${p.by_status[s.value]})` : ""}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {communities.loading ? (
          <Loading />
        ) : communities.error ? (
          <div className="p-4">
            <ErrorNote message={communities.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "name", label: "Community" },
              { key: "status", label: "Status" },
              { key: "loc", label: "Location" },
              { key: "plots", label: "Plots" },
              { key: "pace", label: "Sales pace", align: "right" },
              { key: "supply", label: "Supply", align: "right" },
              { key: "homes", label: "Homes", align: "right" },
            ]}
            empty="No communities yet."
          >
            {(communities.data ?? []).map((c) => {
              const st = c.stats;
              const pace = Number(st?.absorption ?? 0);
              const target = c.target_sales_per_month ? Number(c.target_sales_per_month) : null;
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/communities/${c.id}`} className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
                      {c.name}
                    </Link>
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {c.code}
                      {c.planned_plots ? ` · ${c.planned_plots} consented` : ""}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={c.status.replace("_", " ")} />
                  </td>
                  <td style={{ color: "var(--fg-muted)" }}>
                    {[c.city, c.county].filter(Boolean).join(", ") || "—"}
                    {c.postcode && (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {c.postcode}
                      </div>
                    )}
                  </td>
                  <td>{st && <PlotBar counts={st.plots} />}</td>
                  <td className="num">
                    <span style={{ color: target !== null && pace < target ? "var(--warn)" : undefined }}>
                      {pace.toFixed(1)}/mo
                    </span>
                    {target !== null && (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        target {target}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {st?.months_of_supply ? `${st.months_of_supply} mo` : "—"}
                    {st?.holds_expiring_soon ? (
                      <div className="text-xs" style={{ color: "var(--warn)" }}>
                        {st.holds_expiring_soon} hold{st.holds_expiring_soon === 1 ? "" : "s"} ending
                      </div>
                    ) : null}
                  </td>
                  <td className="num">
                    {st?.live_homes ?? 0}
                    {st?.spec_homes ? (
                      <div className="text-xs" style={{ color: "var(--warn)" }}>
                        {st.spec_homes} spec
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {open && (
        <CommunityForm
          open
          onClose={() => setOpen(false)}
          onSaved={(c) => {
            setOpen(false);
            toast.success(`${c.name} created`);
            communities.reload();
            portfolio.reload();
          }}
        />
      )}
    </>
  );
}
