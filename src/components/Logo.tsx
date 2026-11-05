"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * The Titan CR Inc lockup. The brand artwork at `public/brand/196x196.png` is the
 * full square logo (helmet + "TITAN CR INC"), so it is rendered as an image on a
 * light plate — which keeps it legible on the navy sidebar as well as on light
 * surfaces. An optional subtitle sits beneath it.
 */

const LOGO_SRC = "/brand/196x196.png";
const LOGO_RATIO = 196 / 196; // square artwork

export type LogoTone = "auto" | "chip" | "bare";

export function LogoMark({ size = 34 }: { size?: number }) {
  const [missing, setMissing] = useState(false);
  const h = size;
  const w = Math.round(size * LOGO_RATIO);

  if (missing) return <span className="logo-fallback">Titan CR Inc</span>;

  return (
    <span className="logo-plate" style={{ height: h }}>
      <Image
        src={LOGO_SRC}
        alt="Titan CR Inc"
        width={w}
        height={h}
        priority
        onError={() => setMissing(true)}
        className="logo-plate-img"
      />
    </span>
  );
}

export function Logo({
  size = 34,
  subtitle = "BUILDER PLATFORM",
  showText = true,
  inverse = false,
}: {
  size?: number;
  subtitle?: string;
  showText?: boolean;
  tone?: LogoTone;
  /** Kept for API compatibility; the wordmark is baked into the artwork. */
  inverse?: boolean;
}) {
  return (
    <span className={`logo-lockup logo-lockup-img ${inverse ? "logo-inverse" : ""}`}>
      <LogoMark size={size} />
      {showText && subtitle && <span className="logo-sub">{subtitle}</span>}
    </span>
  );
}
