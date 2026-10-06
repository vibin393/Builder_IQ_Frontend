"use client";

import { Logo } from "@/components/Logo";

/**
 * The loading screen: a house assembles itself, piece by piece, in the order a
 * real one is built — slab, then frame, then roof, then windows, then the door.
 *
 * Drawn as SVG so it stays sharp, themes with the rest of the app, and costs
 * nothing to ship. The whole cycle runs ~3.4s and repeats, so a slow API call
 * never leaves a frozen frame on screen.
 */
export function HouseBuilder({ size = 132 }: { size?: number }) {
  return (
    <svg
      className="house-build"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="Loading"
    >
      <defs>
        <linearGradient id="hb-roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>

      {/* 1 — the slab */}
      <rect className="hb hb-slab" x="18" y="92" width="84" height="7" rx="2" fill="var(--brand)" />

      {/* 2 — the frame goes up */}
      <path
        className="hb hb-frame"
        d="M26 92V54M94 92V54"
        stroke="var(--steel)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* 3 — the roof */}
      <path
        className="hb hb-roof"
        d="M18 56 60 24l42 32"
        stroke="url(#hb-roof)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 4 — windows */}
      <rect className="hb hb-win hb-win-1" x="34" y="62" width="16" height="15" rx="2" fill="var(--accent)" />
      <rect className="hb hb-win hb-win-2" x="70" y="62" width="16" height="15" rx="2" fill="var(--accent)" />

      {/* 5 — the door, last */}
      <path
        className="hb hb-door"
        d="M52 92V76a8 8 0 0 1 16 0v16z"
        fill="var(--steel)"
      />

      {/* A surveyor's line sweeping the slab while everything else settles */}
      <line
        className="hb-scan"
        x1="18"
        y1="99"
        x2="102"
        y2="99"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Full-screen loading state, used while the session is being checked. */
export function Preloader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="preloader">
      <div className="preloader-inner">
        <HouseBuilder />
        <div className="preloader-brand">
          <Logo size={30} subtitle="BUILDER PLATFORM" />
        </div>
        <div className="preloader-bar" aria-hidden>
          <span />
        </div>
        <p className="preloader-label">{label}…</p>
      </div>
    </div>
  );
}
