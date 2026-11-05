"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/Button";
import { Icons } from "@/components/icons";

/* -------------------------------------------------------------- skeletons */

/**
 * Skeletons rather than a spinner, so the page does not jump when data lands —
 * the shape that appears is the shape that stays.
 */
export function Skeleton({
  w = "100%",
  h = 14,
  rounded = 6,
}: {
  w?: string | number;
  h?: number;
  rounded?: number;
}) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: rounded }} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-5">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4" style={{ animationDelay: `${r * 60}ms` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} w={c === 0 ? "26%" : `${Math.max(12, 22 - c * 2)}%`} h={13} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton w="45%" h={9} />
          <div className="mt-3">
            <Skeleton w="65%" h={24} />
          </div>
          <div className="mt-2">
            <Skeleton w="80%" h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 180 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 px-1" style={{ height }}>
      {[62, 88, 45, 74, 96, 58, 80].map((h, i) => (
        <span
          key={i}
          className="skeleton flex-1"
          style={{ height: `${h}%`, borderRadius: 6, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------- animated value */

/**
 * Counts from the previous value to the new one. Only worth it on headline
 * numbers — on a dense table it is noise.
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = 550,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from.current === value) {
      from.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic: fast then settles, which reads as "landing" on a number.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(origin + delta * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <>{format(display)}</>;
}

/* ------------------------------------------------------------- transitions */

/** Fades and lifts children in, staggered by index. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`reveal ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- confirmation */

/**
 * Confirm before anything destructive or irreversible. `tone="danger"` colours the
 * action button; use it for voiding, deleting and overrides.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card overlay-panel max-w-md p-6"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{
              background: tone === "danger" ? "var(--danger-soft)" : "var(--brand-soft)",
              color: tone === "danger" ? "var(--danger)" : "var(--brand)",
            }}
          >
            <Icons.warranty size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            <div className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {body}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loadingText="Working…"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Drives a ConfirmDialog without every page inventing its own state. */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    body: ReactNode;
    confirmLabel?: string;
    tone?: "primary" | "danger";
    onConfirm: () => void | Promise<unknown>;
  }>({ open: false, title: "", body: null, onConfirm: () => {} });

  const confirm = (opts: Omit<typeof state, "open">) => setState({ ...opts, open: true });
  const close = () => setState((s) => ({ ...s, open: false }));

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      body={state.body}
      confirmLabel={state.confirmLabel}
      tone={state.tone}
      onConfirm={state.onConfirm}
      onClose={close}
    />
  );

  return { confirm, dialog };
}
