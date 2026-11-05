"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import { useUser } from "@/components/AppShell";
import { Button } from "@/components/Button";
import {
  BudgetTrack,
  Delta,
  Donut,
  Funnel,
  GroupedBars,
  Legend,
  LineChart,
  RadialGauge,
  SERIES,
  Sparkline,
} from "@/components/charts";
import { HeroStrip } from "@/components/ConstructionScene";
import { HouseBuilder } from "@/components/Preloader";
import { AnimatedNumber, SkeletonChart, SkeletonTiles } from "@/components/feedback";
import { Icons, type IconName } from "@/components/icons";
import { useToast } from "@/components/Toast";
import {
  Badge,
  Card,
  DataTable,
  ErrorNote,
  StatusBadge,
  day,
  money,
  titleCase,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";

const FUNNEL_ORDER = ["new", "contacted", "qualified", "appointment", "converted"];
const REFRESH_MS = 60_000;

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (user?.role === "trade") router.replace("/portal");
    if (user?.role === "homeowner") router.replace("/my-home");
  }, [user, router]);

  // Scope, presentation mode and hidden sections are per-viewer conveniences,
  // so they live in the browser rather than on the server.
  const [scope, setScope] = usePersistedLocal("corman_dash_scope", "");
  const [hidden, setHidden] = usePersistedLocal<string[]>("corman_dash_hidden", []);
  const [presenting, setPresenting] = useState(false);

  const communities = useAsync(() => api.listCommunities(), []);
  const dash = useAsync(() => api.dashboard(scope || undefined), [scope]);
  const margin = useAsync(() => api.jobMargin(), []);
  const jobs = useAsync(() => api.jobOptions(), []);
  const pipeline = useAsync(() => api.salesPipeline(), []);
  const cycle = useAsync(() => api.cycleTime(), []);
  const satisfaction = useAsync(() => api.satisfaction(), []);

  const [live, setLive] = useState(true);
  const [lastSync, setLastSync] = useState(() => Date.now());
  const [ago, setAgo] = useState(0);

  const reloadAll = useRef(() => {});
  reloadAll.current = () => {
    dash.reload();
    communities.reload();
    margin.reload();
    jobs.reload();
    pipeline.reload();
    cycle.reload();
    satisfaction.reload();
    setLastSync(Date.now());
  };

  // Auto-refresh while "Live" is on. A builder leaves this on a wall screen.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => reloadAll.current(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [live]);

  /* Presentation mode: full screen, chrome hidden, type stepped up. Builders
     put this dashboard on a wall screen in the site office, and a browser with
     tabs and a sidebar around it is not that. */
  const togglePresenting = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Refused by the browser (no user gesture, or a policy). The class still
      // applies, so the layout change works even without true full screen.
    }
    setPresenting((p) => !p);
  }, []);

  // Leaving full screen by pressing Escape bypasses our button, so follow it.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("presenting", presenting);
    return () => document.body.classList.remove("presenting");
  }, [presenting]);

  const show = useCallback((key: string) => !hidden.includes(key), [hidden]);
  const toggleSection = useCallback(
    (key: string) =>
      setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])),
    [setHidden],
  );

  // Drives the "updated Ns ago" label and the countdown ring.
  useEffect(() => {
    const id = window.setInterval(() => setAgo(Math.floor((Date.now() - lastSync) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [lastSync]);

  const d = dash.data;

  /* ------------------------------------------------------------ derived */

  const marginJobs = margin.data?.jobs ?? [];

  const funnel = useMemo(() => {
    const counts = new Map((pipeline.data?.by_status ?? []).map((s) => [s.status, s.count]));
    return FUNNEL_ORDER.map((s) => ({
      label: titleCase(s),
      count: counts.get(s as never) ?? 0,
    }));
  }, [pipeline.data]);

  const costRows = useMemo(
    () =>
      marginJobs
        .filter((j) => Number(j.budget) > 0)
        .slice(0, 6)
        .map((j) => ({
          label: j.job_number,
          sublabel: `${(j.margin_pct * 100).toFixed(1)}% margin`,
          values: [
            { name: "Budget", value: Number(j.budget), color: SERIES.one },
            { name: "Committed", value: Number(j.committed), color: SERIES.two },
            { name: "Actual", value: Number(j.actual), color: SERIES.three },
          ],
        })),
    [marginJobs],
  );

  const cyclePoints = (cycle.data?.jobs ?? []).map((j) => ({
    label: j.job_number,
    value: j.cycle_days,
  }));

  // Cumulative revenue as homes were sold — a shape for the sold-value tile.
  const revenueTrend = useMemo(() => {
    let running = 0;
    return marginJobs.map((j) => (running += Number(j.revenue)));
  }, [marginJobs]);

  const costTrend = useMemo(() => {
    let running = 0;
    return marginJobs.map((j) => (running += Number(j.exposure)));
  }, [marginJobs]);

  const attention = useMemo(() => {
    if (!d) return [];
    const rows: { label: string; count: number; href: string; icon: IconName; tone: "warn" | "danger" | "ok" }[] = [];
    if (d.construction.overdue_tasks > 0)
      rows.push({
        label: "Tasks past their scheduled finish",
        count: d.construction.overdue_tasks,
        href: "/field",
        icon: "field",
        tone: "danger",
      });
    if (d.warranty.open_requests > 0)
      rows.push({
        label: "Warranty claims still open",
        count: d.warranty.open_requests,
        href: "/warranty",
        icon: "warranty",
        tone: "warn",
      });
    if (d.sales.open_leads > 0)
      rows.push({
        label: "Leads awaiting follow-up",
        count: d.sales.open_leads,
        href: "/leads",
        icon: "leads",
        tone: "warn",
      });
    const overBudget = marginJobs.filter((j) => Number(j.exposure) > Number(j.budget) && Number(j.budget) > 0);
    if (overBudget.length > 0)
      rows.push({
        label: "Homes committed over budget",
        count: overBudget.length,
        href: "/reports",
        icon: "accounting",
        tone: "danger",
      });

    // The project-controls half. Ordered by what stops work soonest: a blocked
    // trade stops a purchase order today, a blocking RFI stops the site today,
    // and paperwork about to lapse stops one next month.
    const c = d.controls;
    if (c.rfis_blocking > 0)
      rows.push({
        label: "RFIs blocking work on site",
        count: c.rfis_blocking,
        href: "/rfis",
        icon: "rfis",
        tone: "danger",
      });
    if (c.trades_blocked > 0)
      rows.push({
        label: "Trades that cannot be issued a PO",
        count: c.trades_blocked,
        href: "/compliance",
        icon: "compliance",
        tone: "danger",
      });
    if (c.observations_overdue > 0)
      rows.push({
        label: "Safety observations past due",
        count: c.observations_overdue,
        href: "/safety",
        icon: "safety",
        tone: "danger",
      });
    if (c.rfis_in_our_court > 0)
      rows.push({
        label: "RFIs waiting on an answer from us",
        count: c.rfis_in_our_court,
        href: "/rfis",
        icon: "rfis",
        tone: "warn",
      });
    if (c.trades_expiring > 0)
      rows.push({
        label: "Trade certificates lapsing soon",
        count: c.trades_expiring,
        href: "/compliance",
        icon: "compliance",
        tone: "warn",
      });
    if (c.submittals_awaiting > 0)
      rows.push({
        label: "Submittals awaiting review",
        count: c.submittals_awaiting,
        href: "/submittals",
        icon: "submittals",
        tone: "warn",
      });
    return rows;
  }, [d, marginJobs]);

  /* -------------------------------------------------------------- render */

  if (dash.error) return <ErrorNote message={dash.error} />;

  const budget = Number(d?.money.budget_revised ?? 0);
  const committed = Number(d?.money.committed ?? 0);
  const actual = Number(d?.money.actual ?? 0);
  const pending = Number(d?.money.pending_change ?? 0);
  const forecast = Number(d?.money.forecast ?? 0);
  const retained = Number(d?.money.retainage_held ?? 0);
  const ctrl = d?.controls;
  const totalRevenue = Number(margin.data?.total_revenue ?? 0);
  const totalMargin = Number(margin.data?.total_margin ?? 0);
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  const building = d?.construction.under_construction ?? 0;
  const closed = d?.construction.closed ?? 0;
  const other = Math.max((d?.construction.jobs_total ?? 0) - building - closed, 0);

  const soldValue = Number(d?.sales.sold_value ?? 0);
  const homesTotal = d?.construction.jobs_total ?? 0;
  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const attentionTotal = attention.reduce((sum, a) => sum + a.count, 0);

  // The "Insights" popover — a plain-language read of the numbers on screen.
  const insights: { icon: IconName; tone: "ok" | "warn" | "danger" | "brand"; text: string }[] = [];
  if (d) {
    insights.push({
      icon: "reports",
      tone: totalMargin < 0 ? "danger" : "ok",
      text: `Portfolio gross margin is ${marginPct.toFixed(1)}% — ${money(totalMargin)} on ${money(totalRevenue)} of revenue.`,
    });
    insights.push({
      icon: "purchaseOrders",
      tone: committed > budget && budget > 0 ? "danger" : "brand",
      text: `${money(committed)} committed of ${money(budget)} budget; ${money(Math.max(budget - committed, 0))} left to commit.`,
    });
    if (d.construction.overdue_tasks > 0)
      insights.push({ icon: "field", tone: "danger", text: `${d.construction.overdue_tasks} task${d.construction.overdue_tasks === 1 ? "" : "s"} past the scheduled finish.` });
    insights.push(
      attentionTotal > 0
        ? { icon: "safety", tone: "warn", text: `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} across ${attention.length} area${attention.length === 1 ? "" : "s"} need attention.` }
        : { icon: "safety", tone: "ok", text: "Nothing is flagged for attention right now." },
    );
    insights.push({ icon: "homes", tone: "brand", text: `${building} home${building === 1 ? "" : "s"} under construction, ${closed} closed, ${homesTotal} in total.` });
  }

  return (
    <>
      {/* ------------------------------------------------------- compact hero */}
      <section className="hero-mini">
        <div className="hero-mini-left">
          <span className="hero-mini-badge" aria-hidden>
            <HouseBuilder size={40} />
          </span>
          <div className="hero-mini-copy">
            <span className="hero-mini-eyebrow">
              <span className="dot" aria-hidden />
              Live · {d?.scope.jobs_in_scope ?? homesTotal} home
              {(d?.scope.jobs_in_scope ?? homesTotal) === 1 ? "" : "s"}
            </span>
            <div className="hero-mini-row">
              <span className="hero-mini-hi">{greeting}, {firstName} ·</span>
              <span className="hero-mini-num">
                <AnimatedNumber value={soldValue} format={(v) => money(v)} duration={900} />
              </span>
              <span className="hero-mini-cap">contracted · {homesTotal} homes</span>
            </div>
          </div>
        </div>

        <div className="hero-mini-anim" aria-hidden>
          <HeroStrip />
        </div>

        <div className="hero-mini-stats">
          <HeroMiniStat k="Building" v={building} s={`${closed} closed`} accent="var(--series-1)" />
          <HeroMiniStat
            k="Margin"
            v={money(totalMargin)}
            s={`${marginPct.toFixed(1)}%`}
            accent={totalMargin < 0 ? "var(--danger)" : "var(--series-3)"}
          />
          <HeroMiniStat k="Leads" v={d?.sales.open_leads ?? 0} s="to follow up" accent="var(--accent)" />
          <HeroMiniStat
            k="Attention"
            v={attentionTotal}
            s={`${attention.length} area${attention.length === 1 ? "" : "s"}`}
            accent={attentionTotal > 0 ? "var(--warn)" : "var(--ok)"}
          />
        </div>
      </section>

      {/* ---------------------------------------------------- action toolbar */}
      {/* relative + z-40 so the Insights / Panels / Create popovers open above
          the KPI cards, which come later in the DOM and would otherwise cover them. */}
      <div className="relative z-40 mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
          Sales, construction, money and warranty across every home.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LiveIndicator
            live={live}
            ago={ago}
            period={REFRESH_MS / 1000}
            onToggle={() => setLive((l) => !l)}
          />
          <Button
            variant="ghost"
            icon="schedule"
            loadingText="Refreshing…"
            onClick={async () => {
              reloadAll.current();
              await new Promise((r) => setTimeout(r, 450));
            }}
          >
            Refresh
          </Button>
          <ScopePicker
            value={scope}
            onChange={setScope}
            communities={communities.data ?? []}
            jobsInScope={d?.scope.jobs_in_scope}
          />
          <InsightsMenu insights={insights} />
          <SectionPicker hidden={hidden} onToggle={toggleSection} />
          <Button
            variant="ghost"
            icon={presenting ? "close" : "dashboard"}
            onClick={togglePresenting}
            title="Full screen, for the site-office wall display"
          >
            {presenting ? "Exit" : "Present"}
          </Button>
          <Button
            variant="ghost"
            icon="campaigns"
            title="Copy a link to this dashboard"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied", "Paste it to share this view.");
              } catch {
                toast.error("Could not copy the link");
              }
            }}
          >
            Share
          </Button>
          <Button
            variant="ghost"
            icon="documents"
            title="Print or save the dashboard as PDF"
            onClick={() => window.print()}
          >
            Print
          </Button>
          <Button
            variant="ghost"
            icon="accounting"
            onClick={() => {
              exportSummary(d, margin.data);
              toast.success("Summary exported", "dashboard-summary.csv");
            }}
          >
            Export
          </Button>
          <QuickCreate />
        </div>
      </div>

      {/* ------------------------------------------------------------ KPIs */}
      {dash.loading && !d ? (
        <SkeletonTiles count={4} />
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatPod
            label="Sold value"
            value={soldValue}
            format={(v) => money(v)}
            hint={`${d?.sales.signed_contracts ?? 0} signed contract${d?.sales.signed_contracts === 1 ? "" : "s"}`}
            spark={revenueTrend}
            accent="var(--series-1)"
            href="/jobs"
            icon="homes"
            delay={0}
          />
          <StatPod
            label="Gross margin"
            value={totalMargin}
            format={(v) => money(v)}
            hint={`${marginPct.toFixed(1)}% of revenue`}
            spark={revenueTrend.map((r, i) => r - (costTrend[i] ?? 0))}
            accent={totalMargin < 0 ? "var(--danger)" : "var(--series-3)"}
            tone={totalMargin < 0 ? "danger" : "ok"}
            delta={marginPct}
            href="/reports"
            icon="reports"
            delay={80}
          />
          <StatPod
            label="Committed cost"
            value={committed}
            format={(v) => money(v)}
            hint={`Actual ${money(actual)}`}
            spark={costTrend}
            accent="var(--series-2)"
            sparkColor="var(--series-2)"
            href="/purchase-orders"
            icon="purchaseOrders"
            delay={160}
          />
          <StatPod
            label="Homes"
            value={homesTotal}
            format={(v) => String(Math.round(v))}
            hint={`${building} building · ${closed} closed`}
            spark={[other, building, closed].filter((n) => n >= 0)}
            accent="var(--series-3)"
            sparkColor="var(--series-3)"
            href="/jobs"
            icon="communities"
            delay={240}
          />
        </div>
      )}

      {/* ------------------------------------------------ revenue vs cost run-up */}
      <div className="mb-6">
        <Card title="Revenue vs cost run-up">
          {margin.loading && !margin.data ? (
            <SkeletonChart height={220} />
          ) : (
            <>
              <Legend
                items={[
                  { label: "Cumulative revenue", color: "var(--series-3)" },
                  { label: "Cumulative cost exposure", color: "var(--series-2)" },
                ]}
              />
              <TrendArea revenue={revenueTrend} cost={costTrend} format={(v) => money(v)} />
              <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
                Each step is another home sold. The gap between the two lines is gross margin
                banked as the portfolio fills up.
              </p>
            </>
          )}
        </Card>
      </div>

      {/* -------------------------------------------------------- attention */}
      {attention.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {attention.map((a, i) => {
            const Icon = Icons[a.icon];
            return (
              <Link
                key={a.label}
                href={a.href}
                className="attention-card reveal"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span
                  className="attention-icon"
                  style={{
                    background: a.tone === "danger" ? "var(--danger-soft)" : "var(--warn-soft)",
                    color: a.tone === "danger" ? "var(--danger)" : "var(--warn)",
                  }}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="tnum block text-lg font-semibold leading-none">
                    <AnimatedNumber value={a.count} />
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--fg-muted)" }}>
                    {a.label}
                  </span>
                </span>
                <span className="attention-arrow">
                  <Icons.chevron size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------------- money */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Where the money is, across every home">
            {dash.loading && !d ? (
              <SkeletonChart height={120} />
            ) : (
              <>
                <BudgetTrack
                  budget={budget}
                  committed={committed}
                  actual={actual}
                  pending={pending}
                  format={(v) => money(v)}
                />
                <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
                  Committed is what the builder has promised on issued purchase orders. Actual is
                  what has been invoiced and approved. The gap between them is work bought but not
                  yet billed.
                  {pending > 0 && (
                    <>
                      {" "}
                      The hatched band is {money(pending)} of change orders raised but not yet
                      approved &mdash; not owed today, but the book lands at {money(forecast)} if
                      they all go through.
                    </>
                  )}
                </p>
                {retained > 0 && (
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
                    A further {money(retained)} is certified but held back as retainage. It is
                    counted in actual cost &mdash; the work was done &mdash; but has not been paid
                    out.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        <Card title="Budget consumed">
          <div className="flex flex-col items-center gap-4 py-1">
            <RadialGauge
              value={committed}
              total={budget}
              label="Committed"
              sublabel={`${money(budget - committed)} left to commit`}
            />
            <div className="w-full" style={{ borderTop: "1px solid var(--border)" }} />
            <RadialGauge
              value={actual}
              total={budget}
              label="Invoiced"
              sublabel={`${money(committed - actual)} committed but unbilled`}
              color="var(--series-3)"
            />
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------ project controls */}
      {show("controls") && ctrl && (
        <Card
          title="Project controls"
          action={
            <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
              What is owed, by whom
            </span>
          }
        >
          <div className="control-grid">
            <ControlChip
              label="RFIs open"
              value={ctrl.rfis_open}
              of={`${ctrl.rfis_in_our_court} in our court`}
              href="/rfis"
              icon="rfis"
              tone={ctrl.rfis_overdue > 0 ? "danger" : ctrl.rfis_in_our_court > 0 ? "warn" : "ok"}
              delay={0}
            />
            <ControlChip
              label="Blocking work"
              value={ctrl.rfis_blocking}
              of="site stopped"
              href="/rfis"
              icon="field"
              tone={ctrl.rfis_blocking > 0 ? "danger" : "ok"}
              delay={50}
            />
            <ControlChip
              label="Submittals"
              value={ctrl.submittals_awaiting}
              of="awaiting review"
              href="/submittals"
              icon="submittals"
              tone={ctrl.submittals_awaiting > 0 ? "warn" : "ok"}
              delay={100}
            />
            <ControlChip
              label="Observations"
              value={ctrl.observations_open}
              of={`${ctrl.observations_overdue} overdue`}
              href="/safety"
              icon="safety"
              tone={ctrl.observations_overdue > 0 ? "danger" : "ok"}
              delay={150}
            />
            <ControlChip
              label="Trades blocked"
              value={ctrl.trades_blocked}
              of={`${ctrl.trades_expiring} lapsing soon`}
              href="/compliance"
              icon="compliance"
              tone={ctrl.trades_blocked > 0 ? "danger" : ctrl.trades_expiring > 0 ? "warn" : "ok"}
              delay={200}
            />
            {/* Reportable incidents the HSE has not been told about, not every
                reportable incident ever recorded. The second number never goes
                down, so nobody looks at it twice. */}
            <ControlChip
              label="Awaiting HSE report"
              value={ctrl.incidents_reportable}
              of="incidents"
              href="/safety"
              icon="safety"
              tone={ctrl.incidents_reportable > 0 ? "danger" : "ok"}
              delay={250}
            />
          </div>
        </Card>
      )}

      <div className="mb-6" />

      {/* --------------------------------------------------- distributions */}
      {show("distributions") && (
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card title="Homes by stage">
          {jobs.loading ? (
            <SkeletonChart height={140} />
          ) : (
            <Donut
              centerValue={String(d?.construction.jobs_total ?? 0)}
              centerLabel="homes"
              slices={[
                { label: "Under construction", value: building, color: SERIES.one },
                { label: "Closed", value: closed, color: SERIES.three },
                { label: "Other stages", value: other, color: SERIES.two },
              ]}
            />
          )}
        </Card>

        <Card title="Lead pipeline">
          {pipeline.loading ? <SkeletonChart height={140} /> : <Funnel stages={funnel} />}
        </Card>

        <Card title="Customer satisfaction">
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
      </div>
      )}

      {/* ------------------------------------------------------ comparisons */}
      {show("comparisons") && (
      <div className="mb-6 grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Budget, committed and actual by home">
            {margin.loading ? <SkeletonChart /> : <GroupedBars rows={costRows} />}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="Cycle time by home">
            {cycle.loading ? (
              <SkeletonChart />
            ) : (
              <>
                <LineChart points={cyclePoints} suffix="d" format={(v) => `${Math.round(v)} days`} />
                <p className="mt-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {cycle.data?.average_cycle_days
                    ? `Averaging ${cycle.data.average_cycle_days} days from start to completion. Every one of them is loan interest.`
                    : "Needs a start date and an actual completion to plot."}
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
      )}

      {/* ------------------------------------------------------------ table */}
      <Card
        title="Margin by home"
        padded={false}
        action={
          <Link href="/reports" className="text-xs font-medium" style={{ color: "var(--brand)" }}>
            All reports →
          </Link>
        }
      >
        {margin.loading ? (
          <SkeletonChart height={160} />
        ) : (
          <DataTable
            columns={[
              { key: "job", label: "Home" },
              { key: "status", label: "Status" },
              { key: "rev", label: "Revenue", align: "right" },
              { key: "bud", label: "Budget", align: "right" },
              { key: "exp", label: "Exposure", align: "right" },
              { key: "margin", label: "Margin", align: "right" },
            ]}
            empty="No homes yet."
          >
            {marginJobs.map((j) => (
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
                <td className="num">{money(j.exposure)}</td>
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

      <p className="mt-6 text-xs" style={{ color: "var(--fg-subtle)" }}>
        Signed in as {user?.full_name} · <Badge tone="brand">{user?.role}</Badge> · updated{" "}
        {day(new Date(lastSync).toISOString())}
      </p>
    </>
  );
}

/* --------------------------------------------------------------- KPI tile */

/**
 * One control counter: a number that somebody owes, and where to go and clear it.
 *
 * Every chip is a link, because a count nobody can act on is decoration. The tone
 * carries an icon and a worded sublabel as well as colour, so the state is never
 * colour alone.
 */
function ControlChip({
  label,
  value,
  of,
  href,
  icon,
  tone,
  delay,
}: {
  label: string;
  value: number;
  of: string;
  href: string;
  icon: IconName;
  tone: "ok" | "warn" | "danger";
  delay: number;
}) {
  const Icon = Icons[icon];
  const colour =
    tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--ok)";
  const soft =
    tone === "danger"
      ? "var(--danger-soft)"
      : tone === "warn"
        ? "var(--warn-soft)"
        : "var(--ok-soft)";

  return (
    <Link
      href={href}
      className="control-chip reveal"
      style={{ animationDelay: `${delay}ms` }}
      data-tone={tone}
    >
      <span className="control-chip-icon" style={{ background: soft, color: colour }}>
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="tnum block text-[1.35rem] font-semibold leading-none"
          style={{ color: value > 0 ? colour : "var(--fg)" }}
        >
          <AnimatedNumber value={value} />
        </span>
        <span className="mt-1 block text-[0.7rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--fg-subtle)" }}>
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--fg-muted)" }}>
          {of}
        </span>
      </span>
      {value > 0 && tone === "danger" && <span className="control-pulse" style={{ background: colour }} aria-hidden />}
    </Link>
  );
}

/**
 * A per-viewer preference kept in the browser.
 *
 * Read after mount, not in the initial state: localStorage does not exist during
 * the server render, and reading it in useState would desync the first paint
 * from the markup.
 */
function usePersistedLocal<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* blocked storage: the default is fine */
    }
  }, [key]);

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* nothing to persist to; the session still works */
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}

/**
 * Scope every figure to one community.
 *
 * A builder running four subdivisions does not want one blended number: Maple
 * Ridge being twelve per cent over does not show up in an average that Oakfield
 * is carrying.
 */
function ScopePicker({
  value,
  onChange,
  communities,
  jobsInScope,
}: {
  value: string;
  onChange: (v: string) => void;
  communities: { id: string; name: string }[];
  jobsInScope?: number;
}) {
  const active = Boolean(value);
  const name = communities.find((c) => c.id === value)?.name;

  return (
    <label className="scope-picker" data-on={active} title="Scope every figure to one community">
      <Icons.communities size={15} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Scope the dashboard to a community"
      >
        <option value="">All communities</option>
        {communities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {active && jobsInScope !== undefined && (
        <span className="scope-count">
          {jobsInScope} home{jobsInScope === 1 ? "" : "s"}
        </span>
      )}
      <span className="sr-only">{name ? `Scoped to ${name}` : "All communities"}</span>
    </label>
  );
}

/** Show or hide the heavier panels. A wall display wants fewer of them. */
function SectionPicker({
  hidden,
  onToggle,
}: {
  hidden: string[];
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const SECTIONS = [
    { key: "controls", label: "Project controls", hint: "RFIs, safety, compliance" },
    { key: "distributions", label: "Distributions", hint: "Stage, pipeline, satisfaction" },
    { key: "comparisons", label: "Comparisons", hint: "Cost by home, cycle time" },
  ];

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        icon="options"
        iconRight="chevron"
        onClick={() => setOpen((o) => !o)}
        title="Choose which panels to show"
      >
        Panels
        {hidden.length > 0 && <span className="panels-count">{hidden.length} hidden</span>}
      </Button>

      {open && (
        <div className="menu-pop menu-pop-wide" role="menu">
          <p className="menu-label">Show on this dashboard</p>
          {SECTIONS.map((sec) => {
            const on = !hidden.includes(sec.key);
            return (
              <button
                key={sec.key}
                role="menuitemcheckbox"
                aria-checked={on}
                className="menu-item menu-item-rich"
                onClick={() => onToggle(sec.key)}
              >
                <span className="panel-check" data-on={on} aria-hidden>
                  {on && <Icons.chevron size={11} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{sec.label}</span>
                  <span className="block text-xs" style={{ color: "var(--fg-subtle)" }}>
                    {sec.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A headline metric as an animated pod: the number counts up on mount, a light
 * sweep runs across the card, a coloured accent bar sits on top, and a sparkline
 * carries the trend. Every pod is a link — a figure you cannot act on is decoration.
 */
function StatPod({
  label,
  value,
  format = (v) => String(Math.round(v)),
  hint,
  spark,
  sparkColor,
  accent,
  tone = "default",
  delta,
  href,
  icon,
  delay = 0,
}: {
  label: string;
  value: number;
  format?: (v: number) => string;
  hint: string;
  spark: number[];
  sparkColor?: string;
  accent?: string;
  tone?: "default" | "ok" | "danger";
  delta?: number;
  href: string;
  icon: IconName;
  delay?: number;
}) {
  const Icon = Icons[icon];
  const color =
    tone === "ok" ? "var(--ok)" : tone === "danger" ? "var(--danger)" : "var(--fg)";
  const style = {
    animationDelay: `${delay}ms`,
    "--pod-accent": accent ?? "var(--series-1)",
  } as CSSProperties;

  return (
    <Link href={href} className="stat-pod" style={style}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
          {label}
        </p>
        <span className="stat-pod-icon">
          <Icon size={16} />
        </span>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="stat-pod-value" style={{ color }}>
            <AnimatedNumber value={value} format={format} duration={850} />
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>
            {delta !== undefined && <Delta value={delta} />}
            {hint}
          </p>
        </div>
        <Sparkline points={spark} color={sparkColor ?? accent ?? "var(--series-1)"} />
      </div>
    </Link>
  );
}

/** A compact stat chip inside the slim hero. Counts up when given a number. */
function HeroMiniStat({
  k,
  v,
  s,
  accent,
}: {
  k: string;
  v: number | string;
  s: string;
  accent?: string;
}) {
  return (
    <div className="hm-stat" style={{ ["--hm-accent" as string]: accent } as CSSProperties}>
      <p className="k">{k}</p>
      <p className="v">{typeof v === "number" ? <AnimatedNumber value={v} duration={900} /> : v}</p>
      <p className="s">{s}</p>
    </div>
  );
}

/**
 * Two cumulative series overlaid — revenue and cost exposure as homes are sold.
 * Both areas fill under a gradient and both lines draw themselves in on mount;
 * the space between them is the margin the portfolio is banking.
 */
function TrendArea({
  revenue,
  cost,
  format,
}: {
  revenue: number[];
  cost: number[];
  format: (v: number) => string;
}) {
  const gidR = useId();
  const gidC = useId();
  const [hover, setHover] = useState<number | null>(null);

  const n = Math.max(revenue.length, cost.length);
  if (n < 2) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
        Not enough sold homes to plot a run-up yet.
      </p>
    );
  }

  const W = 640;
  const H = 220;
  const pad = { top: 16, right: 14, bottom: 26, left: 58 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const max = Math.max(1, ...revenue, ...cost);
  const x = (i: number) => pad.left + (i / (n - 1)) * innerW;
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const buildPath = (series: number[]) =>
    series.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const buildArea = (series: number[]) =>
    `${buildPath(series)} L${x(series.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;

  const ticks = [0, max / 2, max];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden="true">
        <defs>
          <linearGradient id={gidR} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-3)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--series-3)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={gidC} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-2)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--series-2)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--fg-subtle)">
              {format(t)}
            </text>
          </g>
        ))}

        <path d={buildArea(cost)} fill={`url(#${gidC})`} />
        <path d={buildArea(revenue)} fill={`url(#${gidR})`} />
        <path className="line-draw" d={buildPath(cost)} fill="none" stroke="var(--series-2)" strokeWidth="2.25" strokeLinejoin="round" />
        <path className="line-draw" d={buildPath(revenue)} fill="none" stroke="var(--series-3)" strokeWidth="2.25" strokeLinejoin="round" />

        {Array.from({ length: n }).map((_, i) => (
          <rect
            key={i}
            x={x(i) - innerW / n / 2}
            y={pad.top}
            width={innerW / n}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" />
            {revenue[hover] !== undefined && (
              <circle cx={x(hover)} cy={y(revenue[hover])} r="4" fill="var(--series-3)" stroke="var(--surface)" strokeWidth="2" />
            )}
            {cost[hover] !== undefined && (
              <circle cx={x(hover)} cy={y(cost[hover])} r="4" fill="var(--series-2)" stroke="var(--surface)" strokeWidth="2" />
            )}
          </>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 4,
            transform: "translateX(-50%)",
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ color: "var(--series-3)" }}>Revenue {format(revenue[hover] ?? 0)}</div>
          <div style={{ color: "var(--series-2)" }}>Cost {format(cost[hover] ?? 0)}</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- live control */

function LiveIndicator({
  live,
  ago,
  period,
  onToggle,
}: {
  live: boolean;
  ago: number;
  period: number;
  onToggle: () => void;
}) {
  const progress = Math.min(ago / period, 1);
  const r = 8;
  const c = 2 * Math.PI * r;

  return (
    <button
      className={`live-pill ${live ? "is-live" : ""}`}
      onClick={onToggle}
      title={live ? `Auto-refreshing every ${period}s. Click to pause.` : "Auto-refresh paused. Click to resume."}
      aria-pressed={live}
    >
      <span className="live-ring">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="10" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
          {live && (
            <circle
              cx="10"
              cy="10"
              r={r}
              fill="none"
              stroke="var(--ok)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - progress)}
              transform="rotate(-90 10 10)"
            />
          )}
          <circle cx="10" cy="10" r="3" fill={live ? "var(--ok)" : "var(--fg-subtle)"} />
        </svg>
      </span>
      <span className="live-text">
        {live ? (ago < 5 ? "Just now" : `${ago}s ago`) : "Paused"}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- insights */

/**
 * A plain-language read of the figures on screen, in a popover. Every line is
 * derived from the same data the cards already show — it opens no new request.
 */
function InsightsMenu({
  insights,
}: {
  insights: { icon: IconName; tone: "ok" | "warn" | "danger" | "brand"; text: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const colour = (t: string) =>
    t === "danger" ? "var(--danger)" : t === "warn" ? "var(--warn)" : t === "ok" ? "var(--ok)" : "var(--brand)";
  const soft = (t: string) =>
    t === "danger" ? "var(--danger-soft)" : t === "warn" ? "var(--warn-soft)" : t === "ok" ? "var(--ok-soft)" : "var(--brand-soft)";

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        icon="reports"
        iconRight="chevron"
        onClick={() => setOpen((o) => !o)}
        title="A quick read of the numbers on screen"
      >
        Insights
      </Button>

      {open && (
        <div className="menu-pop menu-pop-wide" role="menu">
          <p className="menu-label">What the numbers say</p>
          {insights.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: "var(--fg-subtle)" }}>
              Still loading…
            </p>
          ) : (
            insights.map((it, i) => {
              const Icon = Icons[it.icon];
              return (
                <div
                  key={i}
                  className="menu-item menu-item-rich"
                  style={{ animationDelay: `${i * 30}ms`, cursor: "default" }}
                >
                  <span className="control-chip-icon" style={{ background: soft(it.tone), color: colour(it.tone) }}>
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 text-xs leading-snug" style={{ color: "var(--fg-muted)" }}>
                    {it.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- quick create */

const CREATE_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/jobs", label: "Home", icon: "homes" },
  { href: "/leads", label: "Lead", icon: "leads" },
  { href: "/bidding", label: "Bid package", icon: "bidding" },
  { href: "/invoices", label: "Invoice", icon: "invoices" },
  { href: "/warranty", label: "Warranty claim", icon: "warranty" },
  { href: "/field", label: "Punch item", icon: "field" },
];

function QuickCreate() {
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

  return (
    <div className="relative" ref={ref}>
      <Button variant="primary" icon="options" onClick={() => setOpen((o) => !o)}>
        Create
      </Button>

      {open && (
        <div className="menu-pop" role="menu">
          {CREATE_LINKS.map((l, i) => {
            const Icon = Icons[l.icon];
            return (
              <Link
                key={l.href}
                href={l.href}
                className="menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${i * 22}ms` }}
              >
                <Icon size={15} />
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- export */

/** Downloads the figures on screen as CSV, so they can go into a board pack. */
function exportSummary(
  d: ReturnType<typeof api.dashboard> extends Promise<infer T> ? T | null : null,
  margin: { jobs: { job_number: string; revenue: string; budget: string; committed: string; actual: string; margin: string }[] } | null,
) {
  const rows: string[][] = [["metric", "value"]];
  if (d) {
    rows.push(
      ["sold_value", d.sales.sold_value],
      ["signed_contracts", String(d.sales.signed_contracts)],
      ["open_leads", String(d.sales.open_leads)],
      ["homes_total", String(d.construction.jobs_total)],
      ["under_construction", String(d.construction.under_construction)],
      ["closed", String(d.construction.closed)],
      ["overdue_tasks", String(d.construction.overdue_tasks)],
      ["budget_revised", d.money.budget_revised],
      ["committed", d.money.committed],
      ["actual", d.money.actual],
      ["open_warranty", String(d.warranty.open_requests)],
    );
  }

  if (margin?.jobs.length) {
    rows.push([], ["job", "revenue", "budget", "committed", "actual", "margin"]);
    for (const j of margin.jobs) {
      rows.push([j.job_number, j.revenue, j.budget, j.committed, j.actual, j.margin]);
    }
  }

  const csv = rows.map((r) => r.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
