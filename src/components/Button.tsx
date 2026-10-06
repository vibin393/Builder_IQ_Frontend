"use client";

import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Icons, type IconName } from "@/components/icons";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  /** Label shown while an async onClick is in flight. */
  loadingText?: string;
  block?: boolean;
  children?: ReactNode;
  /**
   * May return a promise. While it is pending the button disables itself and shows a
   * spinner, so callers never have to thread their own `busy` state through.
   */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "ghost",
    size = "md",
    icon,
    iconRight,
    loading,
    loadingText,
    block,
    children,
    onClick,
    disabled,
    className = "",
    // Defaults to "button". A bare <button> inside a <form> submits, which would
    // double-fire alongside onClick. Pass type="submit" deliberately where wanted.
    type = "button",
    ...rest
  },
  ref,
) {
  const [pending, setPending] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const busy = loading || pending;
  const Icon = icon ? Icons[icon] : null;
  const IconRight = iconRight ? Icons[iconRight] : null;

  async function handle(e: React.MouseEvent<HTMLButtonElement>) {
    if (busy || disabled) return;

    // Ripple from the click point. Cleaned up after the animation.
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 600);

    const result = onClick?.(e);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPending(true);
      try {
        await result;
      } finally {
        setPending(false);
      }
    }
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={handle}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`btn2 btn2-${variant} btn2-${size} ${block ? "btn2-block" : ""} ${className}`}
      {...rest}
    >
      {ripples.map((r) => (
        <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} aria-hidden />
      ))}

      {busy ? (
        <Spinner />
      ) : Icon ? (
        <Icon size={size === "sm" ? 14 : 16} />
      ) : null}

      {children && <span className="btn2-label">{busy && loadingText ? loadingText : children}</span>}

      {!busy && IconRight && <IconRight size={size === "sm" ? 14 : 16} />}
    </button>
  );
});

export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg
      className="spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.22" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** An icon-only button with a tooltip label. */
export function IconButton({
  icon,
  label,
  onClick,
  variant = "ghost",
  danger,
}: {
  icon: IconName;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  variant?: Variant;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "danger" : variant}
      size="sm"
      icon={icon}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="btn2-icon-only"
    />
  );
}
