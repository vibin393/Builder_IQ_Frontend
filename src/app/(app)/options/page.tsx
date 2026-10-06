"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/feedback";
import { OPTION_CATEGORIES, OptionForm, categoryLabel } from "@/components/OptionForm";
import { useToast } from "@/components/Toast";
import { Badge, Card, DataTable, ErrorNote, Loading, PageHeader, StatTile, money } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { OptionCategory } from "@/types/api";

export default function OptionsPage() {
  const [category, setCategory] = useState<OptionCategory | "">("");
  const [active, setActive] = useState<"true" | "false" | "">("true");
  const [search, setSearch] = useState("");
  const [planId, setPlanId] = useState("");
  const options = useAsync(
    () =>
      api.listOptions({
        category: category || undefined,
        active: active === "" ? undefined : active === "true",
        search: search.trim() || undefined,
        plan_id: planId || undefined,
      }),
    [category, active, search, planId],
  );
  const summary = useAsync(() => api.optionPortfolio(), []);
  const plans = useAsync(() => api.listPlans(true), []);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const s = summary.data;
  const floor = Number(s?.margin_floor_pct ?? 20);

  return (
    <>
      <PageHeader
        title="Option catalog"
        subtitle="Each option is at once a price, a cost per cost code, a schedule effect and a structural rule. A selection snapshots all of them when it is made, so editing the catalog never rewrites a home already sold."
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New option
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Options on offer"
          value={s?.active ?? "—"}
          hint={s ? `${Object.keys(s.by_category).length} categories · ${s.archived} archived` : undefined}
        />
        <StatTile
          label="Options revenue"
          value={<AnimatedNumber value={Number(s?.confirmed_revenue ?? 0)} format={(v) => money(v)} />}
          hint={s ? `Confirmed · ${s.pending_selections} awaiting confirmation` : undefined}
        />
        <StatTile
          label="Average margin"
          value={s?.avg_margin_pct ? `${s.avg_margin_pct}%` : "—"}
          tone={s?.low_margin ? "warn" : "ok"}
          hint={s ? `${s.low_margin} below ${floor}%` : undefined}
        />
        <StatTile
          label="Priced, no cost"
          value={s?.no_costs ?? "—"}
          tone={s?.no_costs ? "danger" : "ok"}
          hint="Selling one moves the contract, not the budget"
        />
      </div>

      {s && s.top.length > 0 && (
        <Card title="Most chosen">
          <div className="flex flex-wrap gap-3">
            {s.top.map((t, i) => (
              <Link
                key={t.option_id}
                href={`/options/${t.option_id}`}
                className="rounded-lg px-3 py-2 text-sm hover:opacity-80"
                style={{ background: "var(--brand-soft)", color: "var(--brand-fg)" }}
              >
                <span className="font-semibold">#{i + 1} {t.name}</span>
                <span className="ml-2 text-xs">
                  {t.confirmed}× · {money(t.revenue)}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="my-4 flex flex-wrap items-center gap-2">
        <input
          className="input"
          style={{ width: "14rem" }}
          placeholder="Search code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" style={{ width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value as OptionCategory | "")}>
          <option value="">All categories</option>
          {OPTION_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
              {s?.by_category[c.value] ? ` (${s.by_category[c.value]})` : ""}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: "auto" }} value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">Any house type</option>
          {(plans.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              Available on {p.code} {p.name}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: "auto" }} value={active} onChange={(e) => setActive(e.target.value as "true" | "false" | "")}>
          <option value="true">On offer</option>
          <option value="false">Archived</option>
          <option value="">All</option>
        </select>
      </div>

      <Card padded={false}>
        {options.loading ? (
          <Loading />
        ) : options.error ? (
          <div className="p-4">
            <ErrorNote message={options.error} />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "opt", label: "Option" },
              { key: "cat", label: "Category" },
              { key: "price", label: "Price", align: "right" },
              { key: "cost", label: "Cost", align: "right" },
              { key: "margin", label: "Margin", align: "right" },
              { key: "days", label: "Days", align: "right" },
              { key: "sold", label: "Chosen", align: "right" },
            ]}
            empty="No options match."
          >
            {(options.data ?? []).map((o) => {
              const st = o.stats;
              const pct = st?.margin_pct ? Number(st.margin_pct) : null;
              return (
                <tr key={o.id} style={o.is_active ? undefined : { opacity: 0.6 }}>
                  <td>
                    <Link href={`/options/${o.id}`} className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
                      {o.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {o.code}
                      {o.is_structural && <Badge tone="warn">structural</Badge>}
                      {st?.plans ? <Badge tone="neutral">{st.plans} plan{st.plans === 1 ? "" : "s"}</Badge> : null}
                      {o.max_quantity > 1 && <Badge tone="neutral">up to {o.max_quantity}{o.unit ? ` ${o.unit}` : ""}</Badge>}
                      {!o.is_active && <Badge tone="neutral">archived</Badge>}
                    </div>
                  </td>
                  <td>
                    <Badge tone="neutral">{categoryLabel(o.category)}</Badge>
                  </td>
                  <td className="num">{money(o.price)}</td>
                  <td className="num">{st?.cost_lines ? money(st.cost) : <Badge tone={Number(o.price) ? "danger" : "neutral"}>none</Badge>}</td>
                  <td className="num">
                    {st?.cost_lines && pct !== null ? (
                      <span style={{ color: pct < floor ? "var(--danger)" : "var(--ok)" }}>{pct.toFixed(1)}%</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">{o.schedule_days ? `${o.schedule_days > 0 ? "+" : ""}${o.schedule_days}` : "—"}</td>
                  <td className="num">
                    {st?.confirmed ?? 0}
                    {st?.attach_rate_pct ? (
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {st.attach_rate_pct}% of homes
                      </div>
                    ) : null}
                    {st?.pending ? (
                      <div className="text-xs" style={{ color: "var(--warn)" }}>
                        {st.pending} pending
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
        <OptionForm
          onClose={() => setOpen(false)}
          onSaved={(o) => {
            setOpen(false);
            toast.success(`${o.code} created`, "Add its cost lines so a sale moves the budget too.");
            options.reload();
            summary.reload();
          }}
        />
      )}
    </>
  );
}
