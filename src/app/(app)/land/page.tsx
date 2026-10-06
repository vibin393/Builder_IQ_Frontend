"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/feedback";
import { LAND_STATUS, LandForm, landStatusLabel, planningLabel } from "@/components/LandForm";
import { useToast } from "@/components/Toast";
import { Badge, Card, DataTable, ErrorNote, Loading, PageHeader, StatTile, money } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { LandPhaseStatus } from "@/types/api";

export default function LandPage() {
  const [status, setStatus] = useState<LandPhaseStatus | "">("");
  const projects = useAsync(() => api.listLandProjects(status || undefined), [status]);
  const summary = useAsync(() => api.landSummary(), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Land development"
        subtitle="From appraisal to serviced plots: the land cost and development budget, the planning permission and when it lapses, the conditions and S106/CIL obligations that come with it, and the plots handed to sales."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New land project
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Land and development"
          value={<AnimatedNumber value={Number(s?.acquisition ?? 0) + Number(s?.forecast ?? 0)} format={(v) => money(v)} />}
          hint={s ? `${money(s.actual)} spent of ${money(s.budget)} development budget` : undefined}
        />
        <StatTile
          label="Plots delivered"
          value={s ? `${s.delivered_plots} / ${s.planned_plots}` : "—"}
          hint="Serviced and handed to sales"
        />
        <StatTile
          label="Obligations open"
          value={s?.obligations_open ?? "—"}
          tone={s?.obligations_overdue ? "danger" : s?.pre_commencement_open ? "warn" : "default"}
          hint={s ? `${s.obligations_overdue} overdue · ${s.pre_commencement_open} pre-commencement · ${money(s.contributions_due)} to pay` : undefined}
        />
        <StatTile
          label="Consents lapsing"
          value={s?.consents_expiring ?? "—"}
          tone={s?.consents_expiring ? "danger" : "ok"}
          hint="Within six months, not yet implemented"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ value: "" as const, label: "All" }, ...LAND_STATUS].map((st) => (
          <button
            key={st.value || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setStatus(st.value)}
            style={status === st.value ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {st.label}
            {st.value && s?.by_status[st.value] ? ` (${s.by_status[st.value]})` : ""}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {projects.loading ? (
          <Loading />
        ) : projects.error ? (
          <div className="p-4">
            <ErrorNote message={projects.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "p", label: "Project" },
              { key: "stage", label: "Stage" },
              { key: "planning", label: "Planning" },
              { key: "plots", label: "Plots", align: "right" },
              { key: "cpl", label: "Cost / plot", align: "right" },
              { key: "margin", label: "Margin on GDV", align: "right" },
              { key: "obl", label: "Obligations", align: "right" },
            ]}
            empty="No land projects yet."
          >
            {(projects.data ?? []).map((p) => {
              const open = p.obligations.filter((o) => o.status === "outstanding" || o.status === "submitted");
              const overdue = open.filter((o) => o.is_overdue).length;
              const lapsing = p.status !== "complete" && p.days_to_consent_expiry !== null && p.days_to_consent_expiry <= 180;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/land/${p.id}`} className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
                      {p.name}
                    </Link>
                    <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {p.code}
                      {p.site_area_ha ? ` · ${Number(p.site_area_ha)} ha` : ""}
                      {p.local_authority ? ` · ${p.local_authority}` : ""}
                    </div>
                  </td>
                  <td>
                    <Badge tone={p.status === "complete" ? "ok" : p.status === "on_hold" ? "warn" : "neutral"}>{landStatusLabel(p.status)}</Badge>
                  </td>
                  <td>
                    <Badge tone={p.is_buildable ? "ok" : p.planning_status === "refused" ? "danger" : "neutral"}>{planningLabel(p.planning_status)}</Badge>
                    {p.planning_expires_on && (
                      <div className="text-xs" style={{ color: lapsing ? "var(--danger)" : "var(--fg-subtle)" }}>
                        lapses {p.planning_expires_on}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {p.delivered_lots} / {p.planned_lots ?? "—"}
                  </td>
                  <td className="num">{p.cost_per_lot ? money(p.cost_per_lot) : "—"}</td>
                  <td className="num" style={{ color: p.margin_on_gdv && Number(p.margin_on_gdv) < 15 ? "var(--danger)" : undefined }}>
                    {p.margin_on_gdv ? `${p.margin_on_gdv}%` : "—"}
                  </td>
                  <td className="num">
                    {open.length || "—"}
                    {overdue > 0 && (
                      <div className="text-xs" style={{ color: "var(--danger)" }}>
                        {overdue} overdue
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {open && (
        <LandForm
          onClose={() => setOpen(false)}
          onSaved={(p) => {
            setOpen(false);
            toast.success(`${p.code} created`);
            projects.reload();
            summary.reload();
          }}
        />
      )}
    </>
  );
}
