/**
 * Inline stroke icons, 20x20 on a 24-unit grid.
 *
 * Hand-rolled rather than an icon package: the app needs about twenty glyphs and a
 * dependency would ship hundreds. All of them inherit `currentColor` so they follow
 * whatever the nav item is doing.
 */

type IconProps = { className?: string; size?: number };

function Svg({ children, size = 18, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const Icons = {
  dashboard: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  ),
  reports: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  leads: (p: IconProps) => (
    <Svg {...p}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="6.5" r="3.5" />
      <path d="M19 10h4M21 8v4" />
    </Svg>
  ),
  homes: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  ),
  design: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.7-9-7.7Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="11" cy="7" r="1" />
      <circle cx="15.5" cy="8.5" r="1" />
    </Svg>
  ),
  campaigns: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
      <path d="M20 6.5a8 8 0 0 1 0 11" />
    </Svg>
  ),
  schedule: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7.5 14h4M7.5 17.5h8" />
    </Svg>
  ),
  field: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  ),
  warranty: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  surveys: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8L6.7 20l1-6L3.4 9.9 9.4 9Z" />
    </Svg>
  ),
  bidding: (p: IconProps) => (
    <Svg {...p}>
      <path d="m14 9-5 5" />
      <path d="M10.5 3.5 17 10l-2.5 2.5L8 6Z" />
      <path d="M4 20h9" />
      <path d="m7.5 16.5 4-4" />
    </Svg>
  ),
  purchaseOrders: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  ),
  invoices: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  ),
  accounting: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h3M13 11h3M8 15h3M13 15h3" />
    </Svg>
  ),
  communities: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 21V9l5-3 5 3v12" />
      <path d="M13 21V13l4-2.5 4 2.5v8" />
      <path d="M6.5 12h3M6.5 16h3M16 16h2" />
    </Svg>
  ),
  plans: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h8V4M11 20v-6h10" />
    </Svg>
  ),
  options: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="m3 12.5 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5 9-4.5" />
    </Svg>
  ),
  vendors: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 9h18l-1 11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1L3 9Z" />
      <path d="M8.5 9V6a3.5 3.5 0 0 1 7 0v3" />
    </Svg>
  ),
  costCodes: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 4 7 20M17 4l-2 16" />
      <path d="M4 9h16M3.5 15H20" />
    </Svg>
  ),
  land: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2 18 9 4l6 8 3-4 4 10H2Z" />
      <circle cx="17.5" cy="6" r="1.5" />
    </Svg>
  ),
  users: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.9" />
      <path d="M16 3.6a4 4 0 0 1 0 7" />
    </Svg>
  ),
  portal: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2" y="7" width="14" height="11" rx="2" />
      <path d="M16 11h3.5L22 14v4h-6" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  ),
  myHome: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M12 16.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    </Svg>
  ),
  compliance: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8.1-7 9.5-4.1-1.4-7-5.2-7-9.5V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  rfis: (p: IconProps) => (
    <Svg {...p}>
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12Z" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.3" />
      <path d="M12 17h.01" />
    </Svg>
  ),
  submittals: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5" />
      <path d="m9.5 14 1.8 1.8L15 12" />
    </Svg>
  ),
  drawings: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
      <path d="M13 13h4M13 16.5h4" />
    </Svg>
  ),
  safety: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M2.5 16h19" />
      <path d="M9 16V8.5a3 3 0 0 1 6 0V16" />
    </Svg>
  ),
  meetings: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15 19a4.6 4.6 0 0 1 6-4.3" />
    </Svg>
  ),
  labour: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  ),
  documents: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 3h6l4 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v4h4" />
      <path d="M10 12h6M10 16h4" />
    </Svg>
  ),
  guide: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" />
      <path d="M12 16.8h.01" />
    </Svg>
  ),
  chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  arrowUp: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Svg>
  ),
  menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  signOut: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Svg>
  ),
};

export type IconName = keyof typeof Icons;
