"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Spinner } from "@/components/Button";
import { SkeletonTable } from "@/components/feedback";

/* ------------------------------------------------------------ formatting */

/**
 * The currency every figure in the application is shown in.
 *
 * US dollars — every contract price, budget and invoice on every screen carries
 * a dollar sign.
 */
export const CURRENCY = "USD";

/**
 * The locale used for numbers and dates.
 *
 * Fixed rather than taken from the browser. Everyone opening the app should be
 * reading the same page: not a date or a thousands separator that moves
 * depending on whose machine the screen is open on.
 */
export const LOCALE = "en-US";

export function money(value: string | number | null | undefined, dp = 0): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function day(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header mb-6 flex flex-wrap items-start justify-between gap-4 pb-4"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="min-w-0">
        <h1 className="text-[1.6rem] font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">{action}</div>
    </header>
  );
}

export function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className="card">
      {(title || action) && (
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "danger"
          ? "var(--danger)"
          : "var(--fg)";
  return (
    <div className="card p-4 transition-shadow hover:shadow-[var(--shadow-md)]">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>
        {label}
      </p>
      <p className="tnum mt-2 text-[1.6rem] font-semibold leading-tight tracking-tight" style={{ color }}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- badges */

const TONES: Record<string, { bg: string; fg: string }> = {
  ok: { bg: "var(--ok-soft)", fg: "var(--ok)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  brand: { bg: "var(--brand-soft)", fg: "var(--brand-fg)" },
  neutral: { bg: "var(--neutral-soft)", fg: "var(--fg-muted)" },
};

export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

/** Maps every status string in the system to a colour, so state reads at a glance. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "complete":
    case "closed":
    case "approved":
    case "signed":
    case "paid":
    case "confirmed":
    case "resolved":
    case "converted":
    case "sold":
    case "acknowledged":
      return "ok";
    case "under_construction":
    case "in_progress":
    case "issued":
    case "ready":
    case "triaged":
    case "qualified":
    case "appointment":
    case "held":
      return "brand";
    case "pending":
    case "pending_approval":
    case "received":
    case "submitted":
    case "draft":
    case "permitting":
    case "out_for_signature":
    case "contacted":
    case "scheduled":
    case "assigned":
      return "warn";
    case "cancelled":
    case "rejected":
    case "void":
    case "blocked":
    case "declined":
    case "lost":
    case "disputed":
      return "danger";
    default:
      return "neutral";
  }
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{titleCase(status)}</Badge>;
}

/* ----------------------------------------------------------------- table */

export function DataTable({
  columns,
  children,
  empty,
  maxHeight,
}: {
  /** `label` is a node, not a string, so a header can hold a select-all box. */
  columns: { key: string; label: ReactNode; align?: "right" }[];
  children: ReactNode;
  empty?: string;
  /** Turns the wrapper into its own scroller, so the header row sticks. */
  maxHeight?: number;
}) {
  const rows = Array.isArray(children) ? children.flat() : [children];
  const isEmpty = rows.filter(Boolean).length === 0;

  return (
    <div
      className="overflow-auto"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-sm" style={{ color: "var(--fg-subtle)" }}>
                {empty ?? "Nothing here yet."}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------- state */

export function Loading({
  label = "Loading",
  variant = "table",
}: {
  label?: string;
  variant?: "table" | "text";
}) {
  if (variant === "text") {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: "var(--fg-subtle)" }}>
        <Spinner />
        {label}…
      </div>
    );
  }
  return <SkeletonTable />;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="reveal flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm"
      style={{
        background: "var(--danger-soft)",
        color: "var(--danger)",
        borderLeft: "3px solid var(--danger)",
      }}
      role="alert"
    >
      <span className="mt-0.5 shrink-0 font-bold">!</span>
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && (
        <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: "var(--fg-muted)" }}>
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs" style={{ color: "var(--fg-subtle)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // Rendered through a portal to <body>. Without this the overlay is a child of the
  // app shell, whose transforms trap `position: fixed` — so the backdrop only covered
  // the content area (starting after the sidebar) instead of the whole screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div
        className="card overlay-panel max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Tab strip. Kept here so every module renders tabs the same way. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (t: T) => void;
  /** Optional badge per tab — a count of what needs attention. */
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5" role="tablist">
      {tabs.map((t) => {
        const n = counts?.[t];
        return (
          <button
            key={t}
            role="tab"
            aria-selected={active === t}
            onClick={() => onChange(t)}
            className="btn btn-ghost btn-sm"
            style={
              active === t
                ? { background: "var(--brand-soft)", color: "var(--brand-fg)", fontWeight: 600 }
                : {}
            }
          >
            {/* Humanise the tab key for display (on_the_clock → On the clock),
                without changing the value the page switches on. */}
            {String(t).replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
            {n ? (
              <span
                className="tnum ml-1.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold"
                style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              >
                {n}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn btn-primary">
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------- overlays */

/**
 * A dropdown that cannot be clipped by whatever it sits inside.
 *
 * The obvious implementation - an absolutely positioned div next to the button -
 * breaks in the one place dropdowns are most needed: a table row. `DataTable`
 * wraps its table in `overflow: auto` so wide tables scroll, and an absolute
 * child of a scrolling ancestor is clipped by it. The menu ends up cut off, or
 * drawn in the wrong place, or scrolling away from its own button.
 *
 * So the panel is rendered into `document.body` through a portal and positioned
 * with `fixed`, from the trigger's own bounding box. Nothing above it in the tree
 * can clip it, and no stacking context can trap it.
 *
 * It closes on an outside click, on Escape, and on any scroll or resize - because
 * a fixed panel does not follow its trigger, and a menu floating beside nothing is
 * worse than a menu that closed.
 */
export function Menu({
  label,
  items,
  align = "right",
  disabled,
}: {
  label: ReactNode;
  items: { label: string; run: () => void; tone?: "danger" }[];
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const [at, setAt] = useState<{ top: number; left: number; right: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setAt(null), []);

  const open = () => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    setAt({
      top: box.bottom + 4,
      left: box.left,
      right: window.innerWidth - box.right,
    });
  };

  useEffect(() => {
    if (!at) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Capture phase, so a scrolling container closes it too rather than only the
    // window.
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [at, close]);

  if (!items.length) return null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="btn btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={!!at}
        disabled={disabled}
        onClick={() => (at ? close() : open())}
      >
        {label}
      </button>
      {at &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            className="card p-1"
            style={{
              position: "fixed",
              top: at.top,
              ...(align === "right" ? { right: at.right } : { left: at.left }),
              minWidth: 210,
              // Above modals' overlays would be wrong; above everything else is
              // right. The overlay sits at 100.
              zIndex: 90,
              boxShadow: "var(--shadow-lg)",
              maxHeight: "min(60vh, 420px)",
              overflowY: "auto",
            }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                className="menu-item"
                style={item.tone === "danger" ? { color: "var(--danger)" } : undefined}
                onClick={() => {
                  close();
                  item.run();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * A panel hung off a button - filters, pickers, anything that is not a list of
 * actions. Same portal trick as `Menu`, and for the same reason.
 */
export function Popover({
  label,
  children,
  width = 320,
  badge,
}: {
  label: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  width?: number;
  /** A count shown on the trigger, e.g. how many filters are on. */
  badge?: number;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setAt(null), []);

  const open = () => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    // Nudged back from the right edge so a wide panel never opens off-screen.
    const left = Math.min(box.left, window.innerWidth - width - 16);
    setAt({ top: box.bottom + 6, left: Math.max(16, left) });
  };

  useEffect(() => {
    if (!at) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [at, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="btn btn-ghost"
        aria-expanded={!!at}
        onClick={() => (at ? close() : open())}
      >
        {label}
        {badge ? (
          <span
            className="tnum ml-1.5 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold"
            style={{ background: "var(--brand-soft)", color: "var(--brand-fg)" }}
          >
            {badge}
          </span>
        ) : null}
      </button>
      {at &&
        createPortal(
          <div
            ref={panel}
            className="card p-4"
            style={{
              position: "fixed",
              top: at.top,
              left: at.left,
              width,
              zIndex: 90,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}
