"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { Badge, Card, ErrorNote, Field, Loading, Modal, PageHeader, StatTile, day, titleCase } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { ScorecardDimension, TradeScore } from "@/types/api";

const DIMENSIONS = ["schedule", "quality", "warranty", "safety", "responsiveness", "compliance", "billing"] as const;
type Dim = (typeof DIMENSIONS)[number];

const TIER_TEXT: Record<string, string> = {
  A: "Re-hire first",
  B: "Re-hire",
  C: "Watch closely",
  D: "Review before the next award",
};

function bandColour(score: number | null) {
  if (score === null) return "var(--fg-subtle)";
  if (score >= 80) return "var(--ok)";
  if (score >= 55) return "var(--warn)";
  return "var(--danger)";
}

function tierTone(t: TradeScore["tier"]) {
  return t === "A" ? "ok" : t === "B" ? "brand" : t === "C" ? "warn" : t === "D" ? "danger" : "neutral";
}

/** One dimension as a labelled bar. A null score draws no bar at all. */
function DimensionBar({ name, dim, weight }: { name: string; dim: ScorecardDimension; weight: number | undefined }) {
  const colour = bandColour(dim.score);
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">
          {titleCase(name)}
          {weight !== undefined && (
            <span className="ml-1.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
              weight {weight}
            </span>
          )}
          {dim.provisional && (
            <span className="ml-1.5">
              <Badge tone="neutral">thin evidence</Badge>
            </span>
          )}
        </span>
        <span className="tnum text-sm font-semibold" style={{ color: colour }}>
          {dim.score === null ? "—" : dim.score}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        {dim.score !== null && <div className="bar-grow h-full rounded-full" style={{ width: `${dim.score}%`, background: colour }} />}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>
        {dim.detail}
        {dim.sample > 0 && <span style={{ color: "var(--fg-subtle)" }}> · {dim.sample} on record</span>}
      </p>
    </div>
  );
}

function History({ vendorId }: { vendorId: string }) {
  const hist = useAsync(() => api.scorecardHistory(vendorId), [vendorId]);
  const rows = [...(hist.data ?? [])].reverse();
  if (rows.length < 2)
    return (
      <p className="text-xs" style={{ color: "var(--fg-subtle)" }}>
        The trend appears from next month: each month&apos;s score is kept as it stood.
      </p>
    );
  return (
    <div className="flex items-end gap-2" aria-label="Monthly overall score">
      {rows.map((h) => (
        <div key={h.period} className="flex flex-col items-center gap-1">
          <span className="tnum text-xs font-semibold" style={{ color: bandColour(h.overall) }}>
            {h.overall ?? "—"}
          </span>
          <span className="w-6 rounded-sm" style={{ height: h.overall ? 6 + h.overall * 0.5 : 4, background: bandColour(h.overall) }} />
          <span className="text-[0.6rem]" style={{ color: "var(--fg-subtle)" }}>
            {day(h.period).split(" ").slice(1).join(" ")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ScorecardPage() {
  const [costCodeId, setCostCodeId] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const scores = useAsync(() => api.tradeScorecard(undefined, costCodeId || undefined), [costCodeId]);
  const weights = useAsync(() => api.scorecardWeights(), []);
  const codes = useAsync(() => api.listCostCodes(), []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tuning, setTuning] = useState(false);

  const all = scores.data ?? [];
  const rows = all.filter((r) => !tierFilter || (tierFilter === "none" ? r.tier === null : r.tier === tierFilter));
  const scored = all.filter((r) => r.overall !== null);
  const count = (t: string) => all.filter((r) => r.tier === t).length;
  const improving = all.filter((r) => (r.change ?? 0) > 0).length;
  const slipping = all.filter((r) => (r.change ?? 0) < 0).length;
  const w = weights.data?.weights;

  return (
    <>
      <PageHeader
        title="Trade scorecard"
        subtitle="Whether a trade is worth the next house: schedule, quality, warranty call-backs, safety, responsiveness, compliance and billing. Every figure comes from records already in the system — nothing is typed in by hand."
        action={
          <Button variant="ghost" onClick={() => setTuning(true)}>
            Weights
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Trades scored" value={scored.length} hint={`${all.length - scored.length} with no history yet`} />
        <StatTile label="Tier A" value={count("A")} tone={count("A") ? "ok" : "default"} hint="80+ — re-hire first" />
        <StatTile label="Tier D" value={count("D")} tone={count("D") ? "danger" : "ok"} hint="Below 50 — review before the next award" />
        <StatTile
          label="This month"
          value={`${improving}↑ ${slipping}↓`}
          tone={slipping > improving ? "warn" : "default"}
          hint="Trades improving / slipping since last month"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["", "A", "B", "C", "D", "none"].map((t) => (
          <button
            key={t || "all"}
            className="btn btn-ghost btn-sm"
            onClick={() => setTierFilter(t)}
            style={tierFilter === t ? { background: "var(--brand-soft)", color: "var(--brand-fg)" } : {}}
          >
            {t === "" ? "All" : t === "none" ? "No history" : `Tier ${t} (${count(t)})`}
          </button>
        ))}
        <select className="input" style={{ width: "auto" }} value={costCodeId} onChange={(e) => setCostCodeId(e.target.value)}>
          <option value="">Every trade</option>
          {(codes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              Best at {c.code} {c.name}
            </option>
          ))}
        </select>
      </div>

      {scores.error && (
        <div className="mb-4">
          <ErrorNote message={scores.error} />
        </div>
      )}

      <Card padded={false}>
        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            A dimension with no history is left out of the composite rather than scored zero. Trades with very little
            evidence are marked <em>provisional</em>. Each month&apos;s score is kept, so the arrow shows the change since last
            month.
          </p>
        </div>

        {scores.loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
            {costCodeId ? "No trades recorded as doing that cost code." : "No trades match."}
          </p>
        ) : (
          <div>
            {rows.map((r, i) => {
              const open = expanded === r.vendor_id;
              const colour = bandColour(r.overall);
              return (
                <div key={r.vendor_id} className="reveal" style={{ animationDelay: `${i * 45}ms`, borderBottom: "1px solid var(--border)" }}>
                  <button
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-2)]"
                    onClick={() => setExpanded(open ? null : r.vendor_id)}
                    aria-expanded={open}
                  >
                    <span
                      className="tnum grid shrink-0 place-items-center rounded-xl text-lg font-semibold"
                      style={{ width: 56, height: 56, background: r.overall === null ? "var(--surface-2)" : `${colour}1f`, color: colour }}
                    >
                      {r.overall ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        #{i + 1} {r.vendor_name}
                        {r.change !== null && r.change !== 0 && (
                          <span className="ml-2 text-xs" style={{ color: r.change > 0 ? "var(--ok)" : "var(--danger)" }}>
                            {r.change > 0 ? "▲" : "▼"} {Math.abs(r.change)}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {r.tier ? <Badge tone={tierTone(r.tier)}>Tier {r.tier} · {TIER_TEXT[r.tier]}</Badge> : <Badge tone="neutral">No history</Badge>}
                        {r.provisional && r.overall !== null && <Badge tone="neutral">Provisional</Badge>}
                        <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                          {r.evidence} record{r.evidence === 1 ? "" : "s"} behind this
                        </span>
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-end gap-1 sm:flex" aria-hidden>
                      {DIMENSIONS.map((dname) => {
                        const dim = r.dimensions[dname];
                        return (
                          <span
                            key={dname}
                            title={`${titleCase(dname)}: ${dim.score ?? "no history"}`}
                            className="rounded-sm"
                            style={{
                              width: 6,
                              height: dim.score === null ? 4 : 6 + (dim.score / 100) * 26,
                              background: dim.score === null ? "var(--surface-3)" : bandColour(dim.score),
                            }}
                          />
                        );
                      })}
                    </span>
                    <span className="shrink-0 text-xs" style={{ color: "var(--fg-subtle)" }}>
                      {open ? "Hide" : "Detail"}
                    </span>
                  </button>

                  {open && (
                    <div className="px-5 pb-5" style={{ background: "var(--surface-2)" }}>
                      <div className="grid gap-x-8 pt-2 sm:grid-cols-2">
                        {DIMENSIONS.map((dname) => (
                          <DimensionBar key={dname} name={dname} dim={r.dimensions[dname]} weight={w?.[dname]} />
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                        <History vendorId={r.vendor_id} />
                        <Link href={`/vendors/${r.vendor_id}`} className="text-sm" style={{ color: "var(--brand)" }}>
                          Open trade →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {tuning && weights.data && (
        <WeightsDialog
          weights={weights.data.weights}
          defaults={weights.data.defaults}
          onClose={() => setTuning(false)}
          onDone={() => {
            setTuning(false);
            weights.reload();
            scores.reload();
          }}
        />
      )}
    </>
  );
}

function WeightsDialog({
  weights,
  defaults,
  onClose,
  onDone,
}: {
  weights: Record<string, number>;
  defaults: Record<string, number>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [w, setW] = useState<Record<string, number>>(weights);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const total = DIMENSIONS.reduce((s, d) => s + (w[d] ?? 0), 0);
  useEffect(() => setW(weights), [weights]);

  async function save() {
    setError(null);
    try {
      await api.setScorecardWeights(w);
      toast.success("Weights saved", "Every trade has been re-scored.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <Modal open title="What matters most to you" onClose={onClose}>
      <p className="mb-4 text-sm" style={{ color: "var(--fg-muted)" }}>
        How much each dimension counts in a trade&apos;s overall score. Shares are worked out from the total, so the numbers
        need not add to 100.
      </p>
      <div className="space-y-3">
        {DIMENSIONS.map((d: Dim) => (
          <Field key={d} label={`${titleCase(d)} — ${total ? Math.round(((w[d] ?? 0) / total) * 100) : 0}%`}>
            <input
              type="range"
              min={0}
              max={50}
              value={w[d] ?? 0}
              onChange={(e) => setW({ ...w, [d]: Number(e.target.value) })}
              className="w-full"
              aria-label={`${d} weight`}
            />
          </Field>
        ))}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
      <div className="mt-4 flex justify-between gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setW(defaults)}>
          Reset to defaults
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <Button variant="primary" onClick={save} disabled={!total}>
            Save and re-score
          </Button>
        </div>
      </div>
    </Modal>
  );
}
