"use client";

/**
 * A continuously-running construction site, drawn as one SVG.
 *
 * It is decoration with a job: the dashboard hero needs to read as a building
 * platform at a glance, and a live site — a crane lifting, a frame going up
 * floor by floor, a truck crossing the lot — does that faster than any label.
 *
 * Everything animates in CSS (see the "construction scene" block in globals.css)
 * so it costs nothing to run and themes with the rest of the app. Motion-reduced
 * viewers get the finished, still scene.
 */
export function ConstructionScene({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`csite ${className}`}
      viewBox="0 0 820 240"
      fill="none"
      role="img"
      aria-label="A construction site: a tower crane raising a building, floor by floor"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="csite-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--csite-sky-top)" />
          <stop offset="100%" stopColor="var(--csite-sky-bot)" />
        </linearGradient>
        <linearGradient id="csite-frame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--steel)" />
        </linearGradient>
        <linearGradient id="csite-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(148,190,226,0.10)" />
          <stop offset="100%" stopColor="rgba(148,190,226,0)" />
        </linearGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="820" height="240" fill="url(#csite-sky)" />

      {/* faint blueprint grid, slowly panning */}
      <g className="csite-grid" opacity="0.5">
        {Array.from({ length: 22 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="240" stroke="rgba(148,190,226,0.13)" strokeWidth="1" />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="820" y2={i * 40} stroke="rgba(148,190,226,0.13)" strokeWidth="1" />
        ))}
      </g>

      {/* sun with rotating rays */}
      <g transform="translate(724 52)">
        <g className="csite-sun-rays">
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              y1="-26"
              x2="0"
              y2="-34"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              transform={`rotate(${i * 30})`}
              opacity="0.55"
            />
          ))}
        </g>
        <circle r="16" fill="var(--accent)" opacity="0.85" />
      </g>

      {/* clouds drifting */}
      <g className="csite-cloud csite-cloud-1" fill="rgba(255,255,255,0.55)">
        <ellipse cx="0" cy="46" rx="26" ry="11" />
        <ellipse cx="20" cy="40" rx="20" ry="13" />
        <ellipse cx="-18" cy="42" rx="16" ry="10" />
      </g>
      <g className="csite-cloud csite-cloud-2" fill="rgba(255,255,255,0.4)">
        <ellipse cx="0" cy="80" rx="22" ry="9" />
        <ellipse cx="18" cy="75" rx="16" ry="11" />
      </g>
      <g className="csite-cloud csite-cloud-3" fill="rgba(255,255,255,0.3)">
        <ellipse cx="0" cy="30" rx="18" ry="8" />
        <ellipse cx="14" cy="26" rx="13" ry="9" />
      </g>

      {/* back skyline — finished, still */}
      <g fill="var(--csite-skyline)" opacity="0.6">
        <rect x="40" y="150" width="34" height="60" rx="2" />
        <rect x="82" y="128" width="28" height="82" rx="2" />
        <rect x="118" y="162" width="40" height="48" rx="2" />
        <rect x="600" y="140" width="30" height="70" rx="2" />
        <rect x="636" y="120" width="26" height="90" rx="2" />
        <rect x="668" y="158" width="36" height="52" rx="2" />
      </g>

      {/* the building under construction — floors rise one by one, on a loop */}
      <g transform="translate(300 0)">
        {/* footings / slab */}
        <rect x="-6" y="204" width="150" height="8" rx="2" fill="var(--steel)" />
        {[0, 1, 2, 3, 4].map((f) => (
          // Outer group positions the floor; inner group carries the CSS
          // transform animation (a CSS transform would otherwise wipe out a
          // transform attribute on the same element).
          <g key={f} transform={`translate(0 ${188 - f * 34})`}>
            <g className={`csite-floor csite-floor-${f}`}>
              {/* slab */}
              <rect x="0" y="12" width="138" height="6" fill="url(#csite-frame)" />
              {/* columns */}
              <rect x="4" y="-18" width="5" height="34" fill="var(--steel)" />
              <rect x="66" y="-18" width="5" height="34" fill="var(--steel)" />
              <rect x="129" y="-18" width="5" height="34" fill="var(--steel)" />
              {/* glazing */}
              <rect x="12" y="-14" width="50" height="26" rx="1.5" fill="var(--accent)" opacity="0.32" />
              <rect x="74" y="-14" width="50" height="26" rx="1.5" fill="var(--accent)" opacity="0.32" />
            </g>
          </g>
        ))}
      </g>

      {/* tower crane */}
      <g className="csite-crane">
        {/* mast */}
        <rect x="196" y="60" width="8" height="150" fill="var(--csite-steel)" />
        <path d="M196 60v150M204 60v150M196 78h8M196 100h8M196 122h8M196 144h8M196 166h8M196 188h8"
          stroke="var(--csite-steel)" strokeWidth="2" opacity="0.5" />
        {/* the jib swings gently around the mast top */}
        <g className="csite-jib">
          {/* counter-jib + weight */}
          <rect x="150" y="52" width="52" height="5" fill="var(--csite-steel)" />
          <rect x="150" y="50" width="14" height="14" rx="2" fill="var(--steel)" />
          {/* main jib */}
          <rect x="200" y="52" width="150" height="5" fill="var(--csite-steel)" />
          <path d="M200 52 210 40h130l10 12" stroke="var(--csite-steel)" strokeWidth="2" opacity="0.6" />
          {/* trolley slides along the jib, cable + hook + load lift together */}
          <g className="csite-trolley">
            <rect x="-6" y="57" width="12" height="6" rx="1.5" fill="var(--steel)" />
            <g className="csite-hoist">
              <line x1="0" y1="63" x2="0" y2="120" stroke="var(--csite-steel)" strokeWidth="1.5" />
              <path d="M-4 120h8l-1 6h-6z" fill="var(--accent)" />
              <rect x="-11" y="126" width="22" height="14" rx="2" fill="var(--steel)" />
            </g>
          </g>
          {/* pivot cap */}
          <circle cx="200" cy="54" r="6" fill="var(--accent)" />
        </g>
        {/* operator cab */}
        <rect x="192" y="58" width="16" height="12" rx="2" fill="var(--steel)" />
      </g>

      {/* ground line */}
      <rect x="0" y="212" width="820" height="28" fill="url(#csite-ground)" />
      <line x1="0" y1="212" x2="820" y2="212" stroke="rgba(148,190,226,0.3)" strokeWidth="1.5" />

      {/* a dump truck crossing the lot, wheels spinning, kicking up dust */}
      <g className="csite-truck">
        <g className="csite-dust">
          <circle cx="-14" cy="8" r="3" />
          <circle cx="-22" cy="4" r="4" />
          <circle cx="-30" cy="9" r="2.5" />
        </g>
        {/* bed / cargo */}
        <path d="M0 -2h34v16H0z" fill="var(--steel)" />
        <path d="M2 -2l6 -7h20l6 7z" fill="var(--accent)" opacity="0.85" />
        {/* cab */}
        <path d="M34 2h14l6 8v4H34z" fill="var(--brand)" />
        <rect x="37" y="3" width="9" height="7" rx="1" fill="var(--accent)" opacity="0.7" />
        {/* wheels — outer group positions, inner group spins */}
        <g transform="translate(9 16)">
          <g className="csite-wheel">
            <circle r="6" fill="#1f2937" />
            <circle r="2.4" fill="var(--csite-steel)" />
            <line x1="-6" y1="0" x2="6" y2="0" stroke="var(--csite-steel)" strokeWidth="1.4" />
            <line x1="0" y1="-6" x2="0" y2="6" stroke="var(--csite-steel)" strokeWidth="1.4" />
          </g>
        </g>
        <g transform="translate(44 16)">
          <g className="csite-wheel">
            <circle r="6" fill="#1f2937" />
            <circle r="2.4" fill="var(--csite-steel)" />
            <line x1="-6" y1="0" x2="6" y2="0" stroke="var(--csite-steel)" strokeWidth="1.4" />
            <line x1="0" y1="-6" x2="0" y2="6" stroke="var(--csite-steel)" strokeWidth="1.4" />
          </g>
        </g>
      </g>

      {/* floating motes of site dust */}
      {[
        { c: "csite-mote csite-mote-1", x: 260, y: 150 },
        { c: "csite-mote csite-mote-2", x: 470, y: 120 },
        { c: "csite-mote csite-mote-3", x: 520, y: 180 },
        { c: "csite-mote csite-mote-4", x: 380, y: 100 },
      ].map((m) => (
        <circle key={m.c} className={m.c} cx={m.x} cy={m.y} r="2" fill="var(--accent)" opacity="0.4" />
      ))}
    </svg>
  );
}

/**
 * A compact building-construction scene for the empty middle of the hero:
 * a tower crane whose hoist lifts a load, a building that rises floor by floor,
 * and a truck crossing the lot — all looping. Motion is CSS (see globals.css).
 */
export function HeroStrip({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`hero-strip ${className}`}
      viewBox="0 0 360 64"
      fill="none"
      role="img"
      aria-label="A tower crane raising a building floor by floor, with a truck crossing the site"
      preserveAspectRatio="none"
    >
      {/* dashed ground line */}
      <line x1="0" y1="57" x2="360" y2="57" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.7" />

      {/* faint back skyline that keeps building up */}
      {[
        { x: 296, h: 22 },
        { x: 314, h: 32 },
        { x: 332, h: 26 },
      ].map((b, i) => (
        <g key={i} transform={`translate(${b.x} 57)`}>
          <g className={`hero-bar hero-bar-${i}`}>
            <rect x="0" y={-b.h} width="12" height={b.h} rx="2" fill="var(--brand)" opacity="0.12" />
            <rect x="0" y={-b.h} width="12" height="3" rx="1.5" fill="var(--accent)" opacity="0.45" />
          </g>
        </g>
      ))}

      {/* the building under construction — floors rise one by one, then repeat */}
      {[0, 1, 2, 3].map((f) => (
        <g key={f} transform={`translate(150 ${57 - (f + 1) * 11})`}>
          <g className={`hero-floor hero-floor-${f}`}>
            <rect x="0" y="0" width="56" height="10" rx="1" fill="var(--brand)" opacity="0.28" />
            <rect x="0" y="0" width="56" height="2.5" fill="var(--accent)" opacity="0.85" />
            <rect x="3" y="3.5" width="10" height="5.5" rx="1" fill="var(--accent)" opacity="0.45" />
            <rect x="16" y="3.5" width="10" height="5.5" rx="1" fill="var(--accent)" opacity="0.45" />
            <rect x="30" y="3.5" width="10" height="5.5" rx="1" fill="var(--accent)" opacity="0.45" />
            <rect x="43" y="3.5" width="10" height="5.5" rx="1" fill="var(--accent)" opacity="0.45" />
          </g>
        </g>
      ))}

      {/* tower crane */}
      <g>
        {/* mast + operator cab */}
        <rect x="119" y="8" width="5" height="49" fill="var(--steel)" />
        <rect x="114" y="10" width="12" height="8" rx="1" fill="var(--steel)" />
        {/* the jib swings gently around the mast top */}
        <g className="hero-jib">
          {/* counter-jib + weight */}
          <rect x="96" y="10" width="27" height="3" fill="var(--steel)" />
          <rect x="93" y="7" width="8" height="8" rx="1" fill="var(--brand)" />
          {/* main jib + apex struts */}
          <rect x="123" y="10" width="88" height="3" fill="var(--steel)" />
          <path d="M123 10 141 4h56l14 6" stroke="var(--steel)" strokeWidth="1.5" opacity="0.5" />
          <circle cx="123" cy="11.5" r="4" fill="var(--accent)" />
          {/* trolley + hoist lifting a load */}
          <g className="hero-hoist">
            <rect x="181" y="11" width="8" height="4" rx="1" fill="var(--steel)" />
            <line x1="185" y1="15" x2="185" y2="30" stroke="var(--steel)" strokeWidth="1.2" />
            <rect x="178" y="30" width="15" height="9" rx="1" fill="var(--brand)" />
            <rect x="178" y="30" width="15" height="2" fill="var(--accent)" opacity="0.6" />
          </g>
        </g>
      </g>

      {/* floating motes */}
      <circle className="hero-dot hero-dot-1" cx="230" cy="22" r="2" fill="var(--accent)" opacity="0.5" />
      <circle className="hero-dot hero-dot-2" cx="250" cy="34" r="1.6" fill="var(--series-3)" opacity="0.5" />
      <circle className="hero-dot hero-dot-3" cx="90" cy="30" r="1.6" fill="var(--brand)" opacity="0.4" />

      {/* a truck driving across in front */}
      <g className="hero-strip-truck">
        <line x1="-10" y1="47" x2="-22" y2="47" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        <line x1="-10" y1="51" x2="-26" y2="51" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" />
        <rect x="0" y="42" width="24" height="11" rx="2" fill="var(--brand)" />
        <path d="M24 45h9l5 5v3H24z" fill="var(--steel)" />
        <rect x="26" y="46" width="6" height="5" rx="1" fill="var(--accent)" opacity="0.7" />
        <rect x="4" y="52" width="7" height="7" rx="2" fill="#1f2937" />
        <rect x="27" y="52" width="7" height="7" rx="2" fill="#1f2937" />
      </g>
    </svg>
  );
}
