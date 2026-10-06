"use client";

/**
 * Inline SVG charts. No charting library — these are simple enough that a dependency
 * would cost more than it saves, and hand-drawn SVG keeps full control of theming.
 *
 * Palette: the three leading categorical slots (blue, orange, aqua), validated for
 * colour-blind separation against both the light and dark surfaces. Do not add a
 * fourth series colour without re-running the validator — yellow next to orange
 * fails the all-pairs floor.
 */

import { useId, useState, type ReactNode } from "react";

import { money } from "@/components/ui";

/* ------------------------------------------------------------------ colour */

export const SERIES = {
  /** Slot 1 — budget / primary magnitude */
  one: "var(--series-1)",
  /** Slot 2 — committed */
  two: "var(--series-2)",
  /** Slot 3 — actual */
  three: "var(--series-3)",
};

/* ------------------------------------------------------------------ legend */

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: it.color,
              display: "inline-block",
            }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ children, x, y }: { children: ReactNode; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -110%)",
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        color: "var(--fg)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------- grouped horizontal bars */

export interface GroupedRow {
  label: string;
  sublabel?: string;
  values: { name: string; value: number; color: string }[];
  href?: string;
}

/**
 * Horizontal grouped bars — the right form for "budget vs committed vs actual" per
 * cost code: many categories, long labels, one shared money axis.
 */
export function GroupedBars({ rows, format = money }: { rows: GroupedRow[]; format?: (v: number) => string }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  const max = Math.max(1, ...rows.flatMap((r) => r.values.map((v) => Math.abs(v.value))));
  const names = rows[0]?.values.map((v) => ({ label: v.name, color: v.color })) ?? [];

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
        Nothing to plot yet.
      </p>
    );
  }

  return (
    <div className="relative">
      <Legend items={names} />
      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">{row.label}</span>
              {row.sublabel && (
                <span className="text-xs" style={{ color: "var(--fg-subtle)" }}>
                  {row.sublabel}
                </span>
              )}
            </div>
            <div className="space-y-[2px]">
              {row.values.map((v, valueIndex) => {
                const pct = (Math.abs(v.value) / max) * 100;
                return (
                  <div
                    key={v.name}
                    className="relative h-[10px] w-full cursor-default rounded-[3px]"
                    style={{ background: "var(--surface-2)" }}
                    onMouseMove={(e) => {
                      const rect = (e.currentTarget.parentElement!
                        .parentElement!.parentElement as HTMLElement).getBoundingClientRect();
                      setHover({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                        text: `${row.label} · ${v.name}: ${format(v.value)}`,
                      });
                    }}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div
                      className="bar-grow h-full rounded-[3px] transition-[width] duration-300"
                      style={{
                        width: `${Math.max(pct, v.value ? 1.5 : 0)}%`,
                        background: v.color,
                        animationDelay: `${rowIndex * 70 + valueIndex * 45}ms`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {hover && (
        <Tooltip x={hover.x} y={hover.y}>
          {hover.text}
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- funnel */

/**
 * Ordinal funnel. One hue, light to dark, with gaps big enough to read as steps —
 * the validated 5-step blue ramp.
 */
const FUNNEL_LIGHT = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];

export function Funnel({ stages }: { stages: { label: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  if (!stages.some((s) => s.count > 0)) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
        No leads in the pipeline yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const pct = (s.count / max) * 100;
        const color = FUNNEL_LIGHT[Math.min(i, FUNNEL_LIGHT.length - 1)];
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs" style={{ color: "var(--fg-muted)" }}>
              {s.label}
            </span>
            <div className="relative h-6 flex-1 rounded-md" style={{ background: "var(--surface-2)" }}>
              <div
                className="bar-grow flex h-full items-center rounded-md px-2 transition-[width] duration-300"
                style={{
                  width: `${Math.max(pct, s.count ? 6 : 0)}%`,
                  background: color,
                  animationDelay: `${i * 80}ms`,
                }}
              >
                {s.count > 0 && (
                  <span className="tnum text-xs font-semibold" style={{ color: "#fff" }}>
                    {s.count}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- line chart */

export interface LinePoint {
  label: string;
  value: number;
}

/** Single-series line with a crosshair. No legend — the title names the series. */
export function LineChart({
  points,
  height = 180,
  format = (v: number) => String(v),
  suffix = "",
}: {
  points: LinePoint[];
  height?: number;
  format?: (v: number) => string;
  suffix?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
        Not enough history to plot.
      </p>
    );
  }

  const W = 600;
  const H = height;
  const pad = { top: 16, right: 12, bottom: 28, left: 46 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const span = max - min || 1;

  const x = (i: number) =>
    pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / span) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`;

  const ticks = [min, min + span / 2, max];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={pad.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--fg-subtle)"
            >
              {Math.round(t)}
              {suffix}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          className="line-draw"
          d={path}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 5 : 3.5}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <rect
              x={x(i) - innerW / Math.max(points.length, 1) / 2}
              y={pad.top}
              width={innerW / Math.max(points.length, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {(i === 0 || i === points.length - 1 || points.length <= 8) && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--fg-subtle)">
                {p.label}
              </text>
            )}
          </g>
        ))}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hover !== null && (
        <Tooltip x={(x(hover) / W) * 100 + "%" as unknown as number} y={y(points[hover].value)}>
          <strong>{points[hover].label}</strong> · {format(points[hover].value)}
        </Tooltip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ progress meter */

/** A single proportion, e.g. committed against budget. */
export function Meter({
  value,
  total,
  label,
  format = money,
}: {
  value: number;
  total: number;
  label?: string;
  format?: (v: number) => string;
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const over = total > 0 && value > total;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span style={{ color: "var(--fg-muted)" }}>{label}</span>
        <span className="tnum font-medium" style={{ color: over ? "var(--danger)" : "var(--fg)" }}>
          {format(value)} <span style={{ color: "var(--fg-subtle)" }}>of {format(total)}</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
        <div
          className="bar-grow h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: over ? "var(--danger)" : "var(--series-1)" }}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- donut chart */

/** Small proportional breakdown — at most three slices, then "Other". */
export function Donut({
  slices,
  size = 132,
  centerLabel,
  centerValue,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="14"
        />
        {total > 0 &&
          slices.map((s) => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${Math.max(dash - 2, 0)} ${c - Math.max(dash - 2, 0)}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
                style={{
                  transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            );
            offset += dash;
            return el;
          })}
        {centerValue && (
          <>
            <text
              x={size / 2}
              y={size / 2 - 2}
              textAnchor="middle"
              fontSize="20"
              fontWeight="600"
              fill="var(--fg)"
            >
              {centerValue}
            </text>
            <text x={size / 2} y={size / 2 + 15} textAnchor="middle" fontSize="10" fill="var(--fg-subtle)">
              {centerLabel}
            </text>
          </>
        )}
      </svg>
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }}
            />
            <span style={{ color: "var(--fg-muted)" }}>{s.label}</span>
            <span className="tnum font-medium">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- sparkline */

/**
 * A trend line small enough to sit inside a stat tile. No axes, no labels —
 * its only job is the shape of the movement, with the headline number beside it.
 */
export function Sparkline({
  points,
  width = 110,
  height = 30,
  color = "var(--series-1)",
  fill = true,
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}) {
  const gradientId = useId();

  if (points.length < 2) {
    return <div style={{ width, height }} aria-hidden />;
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const pad = 3;

  const x = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${height} L${x(0)},${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradientId})`} />}
      <path
        className="line-draw"
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(points.length - 1)} cy={y(last)} r="2.5" fill={color} />
    </svg>
  );
}

/* ----------------------------------------------------------- radial gauge */

/** A single proportion as an arc. Reads faster than a bar for "how far through". */
export function RadialGauge({
  value,
  total,
  size = 132,
  label,
  sublabel,
  color = "var(--series-1)",
}: {
  value: number;
  total: number;
  size?: number;
  label: string;
  sublabel?: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  const r = size / 2 - 11;
  const circumference = Math.PI * r; // half circle
  const over = total > 0 && value > total;
  const stroke = over ? "var(--danger)" : color;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} aria-hidden>
        <path
          d={`M 11 ${size / 2} A ${r} ${r} 0 0 1 ${size - 11} ${size / 2}`}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d={`M 11 ${size / 2} A ${r} ${r} 0 0 1 ${size - 11} ${size / 2}`}
          fill="none"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          fontSize="21"
          fontWeight="600"
          fill="var(--fg)"
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <p className="mt-1 text-xs font-medium">{label}</p>
      {sublabel && (
        <p className="text-[0.7rem]" style={{ color: "var(--fg-subtle)" }}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------- stacked compare */

/**
 * Budget with committed and actual laid over it on one track. Three separate bars
 * would make the reader do the comparison themselves; overlaying does it for them.
 */
export function BudgetTrack({
  budget,
  committed,
  actual,
  pending = 0,
  format,
}: {
  budget: number;
  committed: number;
  actual: number;
  /** Change orders raised but not yet approved. Drawn hatched: not real money yet. */
  pending?: number;
  format: (v: number) => string;
}) {
  const forecast = committed + pending;
  const scale = Math.max(budget, committed, actual, forecast, 1);
  const pct = (v: number) => (v / scale) * 100;
  const overCommitted = committed > budget;
  const forecastOver = forecast > budget;

  return (
    <div className="space-y-3">
      <div
        className="relative h-11 w-full overflow-hidden rounded-lg"
        style={{ background: "var(--surface-2)" }}
      >
        {/* Budget is the container everything else is judged against. */}
        <div
          className="bar-grow absolute inset-y-0 left-0 rounded-lg"
          style={{ width: `${pct(budget)}%`, background: "var(--surface-3)" }}
        />

        {/* Pending sits on top of committed, hatched, so it reads as "coming, not
            yet owed". Drawn before committed so committed paints over its left edge. */}
        {pending > 0 && (
          <div
            className="bar-grow absolute inset-y-0 left-0 rounded-lg"
            style={{
              width: `${pct(forecast)}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--warn) 0 5px, transparent 5px 10px)",
              backgroundColor: "var(--warn-soft)",
              opacity: 0.9,
              animationDelay: "60ms",
            }}
          />
        )}

        <div
          className="bar-grow absolute inset-y-0 left-0 rounded-lg"
          style={{
            width: `${pct(committed)}%`,
            background: overCommitted ? "var(--danger)" : "var(--series-2)",
            opacity: 0.85,
            animationDelay: "120ms",
            // A 2px surface gap where committed meets pending, so the two fills
            // never touch and the boundary stays readable.
            boxShadow: pending > 0 ? "2px 0 0 0 var(--surface)" : undefined,
          }}
        />
        <div
          className="bar-grow absolute bottom-0 left-0 top-0 rounded-lg"
          style={{
            width: `${pct(actual)}%`,
            background: "var(--series-3)",
            animationDelay: "240ms",
            clipPath: "inset(45% 0 0 0 round 0 0 8px 8px)",
          }}
        />

        {/* Where the budget line actually falls, when the forecast runs past it. */}
        {forecastOver && budget > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${pct(budget)}%`,
              width: 2,
              background: "var(--danger)",
              boxShadow: "0 0 0 1px var(--surface)",
            }}
            aria-hidden
          />
        )}
      </div>

      <dl className={`grid gap-2 text-center ${pending > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
        {[
          { label: "Budget", value: budget, color: "var(--fg-muted)", show: true },
          {
            label: "Committed",
            value: committed,
            color: overCommitted ? "var(--danger)" : "var(--series-2)",
            show: true,
          },
          { label: "Actual", value: actual, color: "var(--series-3)", show: true },
          { label: "Forecast", value: forecast, color: forecastOver ? "var(--danger)" : "var(--warn)", show: pending > 0 },
        ]
          .filter((row) => row.show)
          .map((row) => (
            <div key={row.label}>
              <dt
                className="text-[0.68rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--fg-subtle)" }}
              >
                {row.label}
              </dt>
              <dd className="tnum mt-0.5 text-sm font-semibold" style={{ color: row.color }}>
                {format(row.value)}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------- delta pill */

/** A small up/down pill for a change against a previous period. */
export function Delta({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (!Number.isFinite(value) || value === 0) return null;
  const up = value > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.68rem] font-semibold"
      style={{
        background: up ? "var(--ok-soft)" : "var(--danger-soft)",
        color: up ? "var(--ok)" : "var(--danger)",
      }}
    >
      {up ? "▲" : "▼"}
      {Math.abs(value).toFixed(0)}
      {suffix}
    </span>
  );
}
