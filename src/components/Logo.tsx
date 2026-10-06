"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The Corman Leigh lockup: circular emblem, wordmark, letterspaced subtitle.
 *
 * ── The artwork ───────────────────────────────────────────────────────────
 * `public/brand/logo-mark.png` is the file you supply. It arrives as the full
 * lockup on a white background, so it is not used directly — run
 *
 *     cd backend && .venv/Scripts/python.exe scripts/prepare_logo.py
 *
 * which lifts the white to transparency, splits the emblem from the baked-in
 * wordmark, and writes `logo-mark-web.png`. That is what this component loads.
 * Re-run it whenever you replace the source file.
 *
 * The wordmark beside the emblem is live text on purpose: it stays crisp at any
 * zoom, recolours with the theme, and the subtitle can differ by role.
 *
 * ── The chip ──────────────────────────────────────────────────────────────
 * The emblem is navy (#00274c), which disappears on the navy sidebar. `tone`
 * decides what sits behind it:
 *   "auto"  — follows the surface it is on (default)
 *   "chip"  — always a light disc, for dark backgrounds
 *   "bare"  — no disc, for light backgrounds
 */

const MARK_SRC = "/brand/logo-mark-web.png";

export type LogoTone = "auto" | "chip" | "bare";

export function LogoMark({ size = 34, tone = "auto" }: { size?: number; tone?: LogoTone }) {
  const [missing, setMissing] = useState(false);

  return (
    <span
      className={`logo-mark logo-mark-${tone}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {missing ? (
        <DrawnMark size={size} />
      ) : (
        <Image
          src={MARK_SRC}
          alt=""
          width={size * 2}
          height={size * 2}
          priority
          onError={() => setMissing(true)}
          className="logo-mark-img"
        />
      )}
    </span>
  );
}

/**
 * Placeholder, used only if the processed artwork is missing — so a fresh clone
 * that has not run prepare_logo.py still renders something sensible rather than
 * a broken image.
 */
function DrawnMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="cl-disc" cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#1b4a76" />
          <stop offset="55%" stopColor="#00274c" />
          <stop offset="100%" stopColor="#001b36" />
        </radialGradient>
        <linearGradient id="cl-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dfe8f2" />
          <stop offset="45%" stopColor="#9db4cc" />
          <stop offset="100%" stopColor="#6e8ba8" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="url(#cl-disc)" />
      <circle cx="32" cy="32" r="28.5" fill="none" stroke="url(#cl-metal)" strokeWidth="1.1" opacity="0.65" />
      <path d="M40 21.5a14.5 14.5 0 1 0 0 21" fill="none" stroke="url(#cl-metal)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M33 24.5v15.5h10.5" fill="none" stroke="url(#cl-metal)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({
  size = 34,
  subtitle = "BUILDER PLATFORM",
  showText = true,
  tone = "auto",
  inverse = false,
}: {
  size?: number;
  subtitle?: string;
  showText?: boolean;
  tone?: LogoTone;
  /** White text, for placing the lockup on a dark panel. */
  inverse?: boolean;
}) {
  return (
    <span className={`logo-lockup ${inverse ? "logo-inverse" : ""}`}>
      <LogoMark size={size} tone={tone} />
      {showText && (
        <span className="logo-text">
          <span className="logo-name">Corman Leigh</span>
          <span className="logo-sub">{subtitle}</span>
        </span>
      )}
    </span>
  );
}
