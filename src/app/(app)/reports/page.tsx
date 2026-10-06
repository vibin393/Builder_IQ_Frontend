"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { AnimatedNumber, SkeletonChart, SkeletonTiles } from "@/components/feedback";
import { Icons, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  BudgetTrack,
  Delta,
  Donut,
  Funnel,
  GroupedBars,
  LineChart,
  RadialGauge,
  SERIES,
} from "@/components/charts";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  LOCALE,
  money,
  PageHeader,
  StatTile,
  StatusBadge,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { downloadCsv, downloadExcel, downloadJson, printReport, type Cell } from "@/lib/download";
import { useAsync } from "@/lib/hooks";
import type { JobStatus } from "@/types/api";

/* --------------------------------------------------------------- sections */

type SectionId = "margin" | "sales" | "cycle" | "warranty" | "communities" | "satisfaction";

const SECTIONS: { id: SectionId; label: string; icon: IconName }[] = [
  { id: "margin", label: "Job margin", icon: "accounting" },
  { id: "sales", label: "Sales pipeline", icon: "leads" },
  { id: "cycle", label: "Cycle time", icon: "schedule" },
  { id: "warranty", label: "Warranty", icon: "warranty" },
  { id: "communities", label: "Communities", icon: "communities" },
  { id: "satisfaction", label: "Satisfaction", icon: "surveys" },
];

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All homes" },
  { value: "sold", label: "Sold" },
  { value: "under_construction", label: "Building" },
  { value: "complete", label: "Complete" },
  { value: "closed", label: "Closed" },
];

export default function ReportsPage() {
  const toast = useToast();

  const margin = useAsync(() => api.jobMargin(), []);
  const pipeline = useAsync(() => api.salesPipeline(), []);
  const cycle = useAsync(() => api.cycleTime(), []);
  const trades = useAsync(() => api.warrantyByTrade(), []);
  const communities = useAsync(() => api.communitySummary(), []);
  const satisfaction = useAsync(() => api.satisfaction(), []);
  const campaigns = useAsync(() => api.campaignPerformance(), []);

  const [section, setSection] = useState<SectionId>("margin");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({
    key: "margin",
    dir: "desc",
  });

  function reloadAll() {
    margin.reload();
    pipeline.reload();
    cycle.reload();
    trades.reload();
    communities.reload();
    satisfaction.reload();
    campaigns.reload();
  }

  /* ------------------------------------------------------------- filtering */

  const marginRows = useMemo(() => {
    let rows = margin.data?.jobs ?? [];
    if (statusFilter) rows = rows.filter((j) => j.status === (statusFilter as JobStatus));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((j) => j.job_number.toLowerCase().includes(q));
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const pick = (r: typeof a) =>
        sort.key === "job" ? r.job_number : Number(r[sort.key as keyof typeof r] ?? 0);
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * dir;
      }
      return (av - bv) * dir;
    });
  }, [margin.data, statusFilter, search, sort]);

  const totals = useMemo(() => {
    const revenue = marginRows.reduce((s, j) => s + Number(j.revenue), 0);
    const budget = marginRows.reduce((s, j) => s + Number(j.budget), 0);
    const committed = marginRows.reduce((s, j) => s + Number(j.committed), 0);
    const actual = marginRows.reduce((s, j) => s + Number(j.actual), 0);
    const exposure = marginRows.reduce((s, j) => s + Number(j.exposure), 0);
    return {
      revenue,
      budget,
      committed,
      actual,
      exposure,
      profit: revenue - exposure,
      pct: revenue > 0 ? ((revenue - exposure) / revenue) * 100 : 0,
    };
  }, [marginRows]);

  const filtered = Boolean(statusFilter || search.trim());

  /* -------------------------------------------------------------- exports */

  const exportSets: Record<SectionId, { name: string; title: string; headers: string[]; rows: Cell[][] }> =
    useMemo(
      () => ({
        margin: {
          name: "job-margin",
          title: "Job margin",
          headers: ["Home", "Status", "Revenue", "Budget", "Committed", "Actual", "Exposure", "Margin", "Margin %"],
          rows: marginRows.map((j) => [
            j.job_number,
            titleCase(j.status),
            j.revenue,
            j.budget,
            j.committed,
            j.actual,
            j.exposure,
            j.margin,
            (j.margin_pct * 100).toFixed(2),
          ]),
        },
        sales: {
          name: "sales-pipeline",
          title: "Sales pipeline by source",
          headers: ["Source", "Leads", "Converted", "Conversion %"],
          rows: (pipeline.data?.by_source ?? []).map((s) => [
            titleCase(s.source),
            s.leads,
            s.converted,
            (s.conversion_rate * 100).toFixed(1),
          ]),
        },
        cycle: {
          name: "cycle-time",
          title: "Cycle time",
          headers: ["Home", "Start", "Completed", "Days"],
          rows: (cycle.data?.jobs ?? []).map((j) => [
            j.job_number,
            j.start_date,
            j.actual_completion,
            j.cycle_days,
          ]),
        },
        warranty: {
          name: "warranty-by-trade",
          title: "Warranty callbacks by trade",
          headers: ["Trade code", "Trade", "Service orders", "Share %"],
          rows: (trades.data?.trades ?? []).map((t) => [
            t.vendor_code,
            t.vendor_name,
            t.service_orders,
            (t.share * 100).toFixed(1),
          ]),
        },
        communities: {
          name: "communities",
          title: "Communities",
          headers: ["Code", "Community", "Homes", "Sold or building"],
          rows: (communities.data?.communities ?? []).map((c) => [
            c.code,
            c.name,
            c.jobs,
            c.sold_or_building,
          ]),
        },
        satisfaction: {
          name: "satisfaction",
          title: "Customer satisfaction",
          headers: ["Metric", "Value"],
          rows: satisfaction.data
            ? [
                ["Responses", satisfaction.data.responses],
                ["NPS", satisfaction.data.nps ?? ""],
                ["Promoters", satisfaction.data.promoters],
                ["Passives", satisfaction.data.passives],
                ["Detractors", satisfaction.data.detractors],
                ["Sales rating", satisfaction.data.ratings.sales ?? ""],
                ["Construction rating", satisfaction.data.ratings.construction ?? ""],
                ["Quality rating", satisfaction.data.ratings.quality ?? ""],
                ["Warranty rating", satisfaction.data.ratings.warranty ?? ""],
              ]
            : [],
        },
      }),
      [marginRows, pipeline.data, cycle.data, trades.data, communities.data, satisfaction.data],
    );

  const active = exportSets[section];

  function exportAs(format: "csv" | "excel" | "json" | "print") {
    if (format === "print") {
      printReport();
      return;
    }
    if (active.rows.length === 0) {
      toast.error("Nothing to export", "This report has no rows yet.");
      return;
    }
    if (format === "csv") downloadCsv(active.name, active.headers, active.rows);
    if (format === "excel") downloadExcel(active.name, active.title, active.headers, active.rows);
    if (format === "json")
      downloadJson(active.name, {
        report: active.title,
        generated: new Date().toISOString(),
        filters: { status: statusFilter || "all", search: search || null },
        rows: active.rows.map((r) => Object.fromEntries(active.headers.map((h, i) => [h, r[i]]))),
      });
    toast.success(`${active.title} exported`, `${active.rows.length} rows as ${format.toUpperCase()}`);
  }

  function exportEverything() {
    const all = Object.values(exportSets).map((set) => ({
      report: set.title,
      headers: set.headers,
      rows: set.rows,
    }));
    downloadJson("corman-all-reports", {
      generated: new Date().toISOString(),
      reports: all,
    });
    toast.success("All reports exported", `${all.length} reports as JSON`);
  }

  /* --------------------------------------------------------------- render */

  if (margin.error) return <ErrorNote message={margin.error} />;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Every figure is computed from the operational records, so a report can never disagree with what it summarises."
        action={
          <>
            <Button variant="ghost" icon="schedule" loadingText="Refreshing…" onClick={async () => {
              reloadAll();
              await new Promise((r) => setTimeout(r, 400));
            }}>
              Refresh
            </Button>
            <ExportMenu onPick={exportAs} onAll={exportEverything} label={active.title} />
          </>
        }
      />

      {/* --------------------------------------------------------- sections */}
      <div className="report-tabs">
        {SECTIONS.map((s) => {
          const Icon = Icons[s.icon];
          return (
            <button
              key={s.id}
              className={`report-tab ${section === s.id ? "is-active" : ""}`}
              onClick={() => setSection(s.id)}
            >
              <Icon size={15} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================ margin */}
      {section === "margin" && (
        <>
          <div className="report-filters">
            <div className="filter-search">
              <Icons.search size={14} />
              <input
                className="filter-search-input"
                placeholder="Find a home…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="icon-btn" onClick={() => setSearch("")} aria-label="Clear">
                  <Icons.close size={13} />
                </button>
              )}
            </div>

            <div className="filter-chips">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || "all"}
                  className={`chip ${statusFilter === f.value ? "is-active" : ""}`}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filtered && (
              <button
                className="chip chip-clear"
                onClick={() => {
                  setStatusFilter("");
                  setSearch("");
                }}
              >
                <Icons.close size={12} />
                Clear filters
              </button>
            )}

            <span className="filter-count">
              {marginRows.length} of {margin.data?.jobs.length ?? 0} homes
            </span>
          </div>

          {margin.loading ? (
            <SkeletonTiles count={4} />
          ) : (
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Revenue"
                value={<AnimatedNumber value={totals.revenue} format={(v) => money(v)} />}
                hint={filtered ? "Filtered selection" : "All homes"}
              />
              <StatTile
                label="Cost exposure"
                value={<AnimatedNumber value={totals.exposure} format={(v) => money(v)} />}
                hint="Greater of committed and actual"
              />
              <StatTile
                label="Gross margin"
                value={<AnimatedNumber value={totals.profit} format={(v) => money(v)} />}
                tone={totals.profit < 0 ? "danger" : "ok"}
                hint={`${totals.pct.toFixed(1)}% of revenue`}
              />
              <StatTile
                label="Budget remaining"
                value={<AnimatedNumber value={totals.budget - totals.committed} format={(v) => money(v)} />}
                hint={`${money(totals.committed)} committed`}
              />
            </div>
          )}

          <div className="mb-6 grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Budget, committed and actual">
                {margin.loading ? (
                  <SkeletonChart height={120} />
                ) : (
                  <BudgetTrack
                    budget={totals.budget}
                    committed={totals.committed}
                    actual={totals.actual}
                    format={(v) => money(v)}
                  />
                )}
              </Card>
            </div>
            <Card title="Budget consumed">
              <RadialGauge
                value={totals.committed}
                total={totals.budget}
                label="Committed"
                sublabel={`${money(Math.max(totals.budget - totals.committed, 0))} left`}
              />
            </Card>
          </div>

          <Card title="By home" padded={false}>
            {margin.loading ? (
              <SkeletonChart height={180} />
            ) : (
              <DataTable
                columns={[
                  { key: "job", label: "Home" },
                  { key: "status", label: "Status" },
                  { key: "revenue", label: "Revenue", align: "right" },
                  { key: "budget", label: "Budget", align: "right" },
                  { key: "committed", label: "Committed", align: "right" },
                  { key: "actual", label: "Actual", align: "right" },
                  { key: "margin", label: "Margin", align: "right" },
                ]}
                empty={filtered ? "No homes match these filters." : "No homes yet."}
              >
                {marginRows.map((j) => (
                  <tr key={j.job_id}>
                    <td>
                      <Link href={`/jobs/${j.job_id}`} className="font-medium" style={{ color: "var(--brand)" }}>
                        {j.job_number}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="num">{money(j.revenue)}</td>
                    <td className="num" style={{ color: "var(--fg-muted)" }}>
                      {money(j.budget)}
                    </td>
                    <td className="num">{money(j.committed)}</td>
                    <td className="num">{money(j.actual)}</td>
                    <td className="num">
                      <div className="flex items-center justify-end gap-2">
                        <Delta value={j.margin_pct * 100} />
                        <span style={{ color: Number(j.margin) < 0 ? "var(--danger)" : "var(--fg)" }}>
                          {money(j.margin)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <SortNote sort={sort} setSort={setSort} />
        </>
      )}

      {/* ============================================================= sales */}
      {section === "sales" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Pipeline">
            <Funnel
              stages={["new", "contacted", "qualified", "appointment", "converted"].map((st) => ({
                label: titleCase(st),
                count: (pipeline.data?.by_status ?? []).find((x) => x.status === st)?.count ?? 0,
              }))}
            />
          </Card>

          <Card title="Conversion by source" padded={false}>
            <DataTable
              columns={[
                { key: "src", label: "Source" },
                { key: "leads", label: "Leads", align: "right" },
                { key: "conv", label: "Converted", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
              ]}
              empty="No leads yet."
            >
              {(pipeline.data?.by_source ?? []).map((s) => (
                <tr key={s.source}>
                  <td className="font-medium">{titleCase(s.source)}</td>
                  <td className="num">{s.leads}</td>
                  <td className="num">{s.converted}</td>
                  <td className="num">{(s.conversion_rate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </DataTable>
          </Card>

          <div className="lg:col-span-2">
            <Card title="Campaign attribution" padded={false}>
              <DataTable
                columns={[
                  { key: "c", label: "Campaign" },
                  { key: "sent", label: "Sent", align: "right" },
                  { key: "open", label: "Open rate", align: "right" },
                  { key: "leads", label: "Leads", align: "right" },
                  { key: "conv", label: "Converted", align: "right" },
                ]}
                empty="No campaigns tracked yet."
              >
                {(campaigns.data?.campaigns ?? []).map((c) => (
                  <tr key={c.campaign_id}>
                    <td className="font-medium">{c.name}</td>
                    {/* Null, not zero, for channels that have no delivery
                        numbers - a road sign does not have a 0% open rate, it has
                        no open rate, and 0% reads as failure. */}
                    <td className="num">{c.sent === null ? "—" : c.sent.toLocaleString(LOCALE)}</td>
                    <td className="num">
                      {c.open_rate === null ? "—" : `${(c.open_rate * 100).toFixed(1)}%`}
                    </td>
                    <td className="num">{c.leads}</td>
                    <td className="num">{c.converted}</td>
                  </tr>
                ))}
              </DataTable>
            </Card>
          </div>
        </div>
      )}

      {/* ============================================================= cycle */}
      {section === "cycle" && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <StatTile label="Completed homes" value={cycle.data?.completed_jobs ?? 0} />
            <StatTile
              label="Average cycle"
              value={cycle.data?.average_cycle_days ? `${cycle.data.average_cycle_days} days` : "—"}
            />
            <StatTile label="Fastest" value={cycle.data?.fastest_days != null ? `${cycle.data.fastest_days} days` : "—"} tone="ok" />
            <StatTile label="Slowest" value={cycle.data?.slowest_days != null ? `${cycle.data.slowest_days} days` : "—"} tone="warn" />
          </div>

          <Card title="Cycle time by home">
            <LineChart
              points={(cycle.data?.jobs ?? []).map((j) => ({ label: j.job_number, value: j.cycle_days }))}
              suffix="d"
              format={(v) => `${Math.round(v)} days`}
              height={220}
            />
            <p className="mt-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
              Days from start to actual completion. Every one of them is interest on the
              construction loan.
            </p>
          </Card>
        </>
      )}

      {/* ========================================================== warranty */}
      {section === "warranty" && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card title="Callbacks by trade" padded={false}>
              <DataTable
                columns={[
                  { key: "t", label: "Trade" },
                  { key: "o", label: "Service orders", align: "right" },
                  { key: "s", label: "Share", align: "right" },
                ]}
                empty="No service orders in the last 12 months."
              >
                {(trades.data?.trades ?? []).map((t) => (
                  <tr key={t.vendor_code}>
                    <td>
                      <div className="font-medium">{t.vendor_name}</div>
                      <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                        {t.vendor_code}
                      </div>
                    </td>
                    <td className="num">{t.service_orders}</td>
                    <td className="num">{(t.share * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </DataTable>
              <p className="px-5 py-3 text-xs" style={{ color: "var(--fg-subtle)" }}>
                This is a purchasing decision, not just a support metric.
              </p>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card title="Share of callbacks">
              <GroupedBars
                rows={(trades.data?.trades ?? []).slice(0, 5).map((t) => ({
                  label: t.vendor_name,
                  sublabel: `${(t.share * 100).toFixed(0)}%`,
                  values: [{ name: "Service orders", value: t.service_orders, color: SERIES.two }],
                }))}
                format={(v) => String(v)}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ======================================================= communities */}
      {section === "communities" && (
        <Card title="Communities" padded={false}>
          <DataTable
            columns={[
              { key: "c", label: "Community" },
              { key: "j", label: "Homes", align: "right" },
              { key: "s", label: "Sold or building", align: "right" },
              { key: "a", label: "Absorption", align: "right" },
            ]}
            empty="No communities yet."
          >
            {(communities.data?.communities ?? []).map((c) => (
              <tr key={c.community_id}>
                <td>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {c.code}
                  </div>
                </td>
                <td className="num">{c.jobs}</td>
                <td className="num">{c.sold_or_building}</td>
                <td className="num">
                  {c.jobs ? `${Math.round((c.sold_or_building / c.jobs) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
      )}

      {/* ====================================================== satisfaction */}
      {section === "satisfaction" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Net Promoter Score">
            {satisfaction.data && satisfaction.data.responses > 0 ? (
              <Donut
                centerValue={String(satisfaction.data.nps ?? 0)}
                centerLabel="NPS"
                slices={[
                  { label: "Promoters", value: satisfaction.data.promoters, color: SERIES.three },
                  { label: "Passives", value: satisfaction.data.passives, color: SERIES.one },
                  { label: "Detractors", value: satisfaction.data.detractors, color: SERIES.two },
                ]}
              />
            ) : (
              <p className="py-10 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                No survey responses yet.
              </p>
            )}
          </Card>

          <Card title="Average rating by department" padded={false}>
            <DataTable
              columns={[
                { key: "d", label: "Department" },
                { key: "r", label: "Rating", align: "right" },
              ]}
              empty="No ratings yet."
            >
              {satisfaction.data
                ? (["sales", "construction", "quality", "warranty"] as const).map((k) => (
                    <tr key={k}>
                      <td className="font-medium">{titleCase(k)}</td>
                      <td className="num">
                        {satisfaction.data!.ratings[k] != null
                          ? `${satisfaction.data!.ratings[k]!.toFixed(1)} / 5`
                          : "—"}
                      </td>
                    </tr>
                  ))
                : []}
            </DataTable>
          </Card>
        </div>
      )}

      <p className="mt-8 text-xs" style={{ color: "var(--fg-subtle)" }}>
        Showing <Badge tone="brand">{active.title}</Badge> · {active.rows.length} rows ·
        exports reflect the filters applied above.
      </p>
    </>
  );
}

/* ---------------------------------------------------------- export menu */

function ExportMenu({
  onPick,
  onAll,
  label,
}: {
  onPick: (f: "csv" | "excel" | "json" | "print") => void;
  onAll: () => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: { key: "csv" | "excel" | "json" | "print"; label: string; hint: string; icon: IconName }[] = [
    { key: "csv", label: "CSV", hint: "Spreadsheets, imports", icon: "invoices" },
    { key: "excel", label: "Excel", hint: "Formatted .xls", icon: "accounting" },
    { key: "json", label: "JSON", hint: "For another system", icon: "costCodes" },
    { key: "print", label: "Print / PDF", hint: "Save as PDF from the dialogue", icon: "plans" },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" icon="reports" iconRight="chevron" onClick={() => setOpen((o) => !o)}>
        Export
      </Button>

      {open && (
        <div className="menu-pop menu-pop-wide" role="menu">
          <p className="menu-label">Download “{label}”</p>
          {options.map((o, i) => {
            const Icon = Icons[o.icon];
            return (
              <button
                key={o.key}
                className="menu-item menu-item-rich"
                role="menuitem"
                style={{ animationDelay: `${i * 22}ms` }}
                onClick={() => {
                  onPick(o.key);
                  setOpen(false);
                }}
              >
                <Icon size={15} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-medium">{o.label}</span>
                  <span className="block text-[0.7rem]" style={{ color: "var(--fg-subtle)" }}>
                    {o.hint}
                  </span>
                </span>
              </button>
            );
          })}

          <div className="profile-menu-sep" />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              onAll();
              setOpen(false);
            }}
          >
            <Icons.options size={15} />
            All reports as JSON
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- sorting */

function SortNote({
  sort,
  setSort,
}: {
  sort: { key: string; dir: "asc" | "desc" };
  setSort: (s: { key: string; dir: "asc" | "desc" }) => void;
}) {
  const keys = [
    { key: "margin", label: "Margin" },
    { key: "revenue", label: "Revenue" },
    { key: "exposure", label: "Cost" },
    { key: "job", label: "Home" },
  ];

  return (
    <div className="sort-bar">
      <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        Sort by
      </span>
      {keys.map((k) => (
        <button
          key={k.key}
          className={`chip ${sort.key === k.key ? "is-active" : ""}`}
          onClick={() =>
            setSort({
              key: k.key,
              dir: sort.key === k.key && sort.dir === "desc" ? "asc" : "desc",
            })
          }
        >
          {k.label}
          {sort.key === k.key && <span className="sort-caret">{sort.dir === "desc" ? "↓" : "↑"}</span>}
        </button>
      ))}
    </div>
  );
}
