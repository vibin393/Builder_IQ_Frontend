"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/Button";
import { PlanForm, areaText, houseTypeLabel, roomsText } from "@/components/PlanForm";
import { useToast } from "@/components/Toast";
import { Badge, Card, DataTable, ErrorNote, Loading, PageHeader, StatTile, money } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

type View = "active" | "archived" | "all";

export default function PlansPage() {
  const [view, setView] = useState<View>("active");
  const plans = useAsync(() => api.listPlans(view === "all" ? undefined : view === "active"), [view]);
  const summary = useAsync(() => api.planPortfolio(), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const s = summary.data;
  const floor = Number(s?.margin_floor_pct ?? 15);

  return (
    <>
      <PageHeader
        title="House plans"
        subtitle="Each house type's specification, price and standard costs. The costs are what every home's budget is generated from; changing them changes the next home, never one already budgeted."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New plan
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="House types on sale" value={s?.active ?? "—"} hint={s ? `${s.archived} archived` : undefined} />
        <StatTile
          label="Average margin"
          value={s?.avg_margin_pct ? `${s.avg_margin_pct}%` : "—"}
          hint="Price less standard cost, before options"
        />
        <StatTile
          label={`Below ${floor}% margin`}
          value={s?.low_margin ?? "—"}
          tone={s?.low_margin ? "danger" : "ok"}
          hint="One overrun away from a loss"
        />
        <StatTile
          label="No standard costs"
          value={s?.no_costs ?? "—"}
          tone={s?.no_costs ? "warn" : "ok"}
          hint={s ? `Can't budget a home on these · ${s.price_changes_90_days} price changes in 90 days` : undefined}
        />
      </div>

      <div className="mb-4 flex gap-2">
        {(["active", "archived", "all"] as View[]).map((v) => (
          <button
            key={v}
            className="btn btn-ghost btn-sm"
            onClick={() => setView(v)}
            style={view === v ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {v === "active" ? "On sale" : v === "archived" ? "Archived" : "All"}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {plans.loading ? (
          <Loading />
        ) : plans.error ? (
          <div className="p-4">
            <ErrorNote message={plans.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "plan", label: "House type" },
              { key: "spec", label: "Specification" },
              { key: "area", label: "Floor area" },
              { key: "price", label: "Base price", align: "right" },
              { key: "cost", label: "Standard cost", align: "right" },
              { key: "margin", label: "Margin", align: "right" },
              { key: "homes", label: "Homes", align: "right" },
            ]}
            empty={view === "archived" ? "Nothing archived." : "No house types yet."}
          >
            {(plans.data ?? []).map((p) => {
              const st = p.stats;
              const pct = st?.margin_pct ? Number(st.margin_pct) : null;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/plans/${p.id}`} className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {p.code}
                      {houseTypeLabel(p.house_type) && ` · ${houseTypeLabel(p.house_type)}`}
                      {!p.is_active && <Badge tone="neutral">archived</Badge>}
                    </div>
                  </td>
                  <td style={{ color: "var(--fg-muted)" }}>
                    {roomsText(p)}
                    {p.epc_target && (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        EPC {p.epc_target}
                        {p.storeys ? ` · ${p.storeys} storey${p.storeys === 1 ? "" : "s"}` : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ color: "var(--fg-muted)" }}>{areaText(p)}</td>
                  <td className="num">{money(p.base_price)}</td>
                  <td className="num">
                    {st?.cost_lines ? money(st.standard_cost) : <Badge tone="warn">No costs</Badge>}
                  </td>
                  <td className="num">
                    {st?.cost_lines && pct !== null ? (
                      <span style={{ color: pct < floor ? "var(--danger)" : "var(--ok)" }}>{pct.toFixed(1)}%</span>
                    ) : (
                      "—"
                    )}
                    {st?.cost_variance_pct && (
                      <div
                        className="text-xs"
                        style={{ color: Number(st.cost_variance_pct) > 0 ? "var(--danger)" : "var(--fg-subtle)" }}
                        title="Actual cost of finished homes against the standard"
                      >
                        actual {Number(st.cost_variance_pct) > 0 ? "+" : ""}
                        {st.cost_variance_pct}%
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {st?.live_homes ?? 0}
                    {st && (st.finished_homes || st.communities) ? (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {st.finished_homes} built · {st.communities} site{st.communities === 1 ? "" : "s"}
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
        <PlanForm
          onClose={() => setOpen(false)}
          onSaved={(p) => {
            setOpen(false);
            toast.success(`${p.code} ${p.name} created`, "Add its standard costs next.");
            plans.reload();
            summary.reload();
          }}
        />
      )}
    </>
  );
}
