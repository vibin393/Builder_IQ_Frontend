"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { GuidePanel, GuideToggle } from "@/components/Guide";
import { Icons, type IconName } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { Preloader } from "@/components/Preloader";
import { ProfileButton } from "@/components/Profile";
import { api, tokenStore } from "@/lib/api";
import type { User } from "@/types/api";

/* ------------------------------------------------------------------ auth */

const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);

/* -------------------------------------------------------------- nav model */

/** `badge` names a counter supplied by the live dashboard, not a hardcoded number. */
type BadgeKey =
  | "overdueTasks"
  | "openWarranty"
  | "openLeads"
  | "draftPOs"
  | "awaitingInvoices"
  | "openRFIs"
  | "awaitingSubmittals"
  | "docsExpiring"
  | "meetingActions"
  | "overdueBids"
  | "expiringCompliance"
  | "openObservations";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: BadgeKey;
  /** Omitted means every internal role. Listed means only these. */
  roles?: readonly string[];
};
type NavGroup = { heading: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/guide", label: "Guide", icon: "guide" },
    ],
  },
  {
    heading: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: "leads", badge: "openLeads",
        roles: ["owner", "admin", "executive", "sales"] },
      { href: "/jobs", label: "Homes", icon: "homes" },
      { href: "/appointments", label: "Design studio", icon: "design",
        roles: ["owner", "admin", "executive", "sales"] },
      { href: "/campaigns", label: "Campaigns", icon: "campaigns",
        roles: ["owner", "admin", "executive", "sales"] },
    ],
  },
  {
    heading: "Construction",
    items: [
      { href: "/schedule", label: "Schedule", icon: "schedule" },
      { href: "/field", label: "Field ops", icon: "field", badge: "overdueTasks" },
      { href: "/safety", label: "Safety & quality", icon: "safety", badge: "openObservations" },
      { href: "/labour", label: "Labour", icon: "labour" },
      { href: "/warranty", label: "Warranty", icon: "warranty", badge: "openWarranty",
        roles: ["owner", "admin", "executive", "warranty", "superintendent"] },
      { href: "/surveys", label: "Surveys", icon: "surveys" },
    ],
  },
  {
    heading: "Project controls",
    items: [
      { href: "/rfis", label: "RFIs", icon: "rfis", badge: "openRFIs" },
      { href: "/submittals", label: "Submittals", icon: "submittals", badge: "awaitingSubmittals" },
      { href: "/drawings", label: "Drawings & specs", icon: "drawings" },
      { href: "/documents", label: "Documents", icon: "documents", badge: "docsExpiring" },
      { href: "/meetings", label: "Meetings", icon: "meetings", badge: "meetingActions" },
    ],
  },
  {
    heading: "Purchasing",
    items: [
      { href: "/bidding", label: "Bidding", icon: "bidding", badge: "overdueBids" },
      { href: "/compliance", label: "Trade compliance", icon: "compliance", badge: "expiringCompliance" },
      { href: "/purchase-orders", label: "Purchase orders", icon: "purchaseOrders", badge: "draftPOs" },
      { href: "/invoices", label: "Invoices", icon: "invoices", badge: "awaitingInvoices" },
      { href: "/accounting", label: "Accounting", icon: "accounting",
        roles: ["owner", "admin", "executive", "accounting"] },
    ],
  },
  {
    heading: "Setup",
    items: [
      { href: "/communities", label: "Communities", icon: "communities" },
      { href: "/plans", label: "Plans", icon: "plans" },
      { href: "/options", label: "Option catalog", icon: "options" },
      { href: "/vendors", label: "Trades", icon: "vendors" },
      { href: "/scorecard", label: "Trade scorecard", icon: "reports" },
      { href: "/cost-codes", label: "Cost codes", icon: "costCodes" },
      { href: "/land", label: "Land development", icon: "land" },
      { href: "/settings/users", label: "Users", icon: "users" },
    ],
  },
];

const HOMEOWNER_NAV: NavGroup[] = [
  { heading: "My home", items: [{ href: "/my-home", label: "Overview", icon: "myHome" }] },
];

/** External design team. They answer RFIs and review submittals against the
    drawings, and have no business seeing money, buyers or trades. */
const ARCHITECT_NAV: NavGroup[] = [
  {
    heading: "Design team",
    items: [
      { href: "/rfis", label: "RFIs", icon: "rfis", badge: "openRFIs" },
      { href: "/submittals", label: "Submittals", icon: "submittals", badge: "awaitingSubmittals" },
      { href: "/drawings", label: "Drawings & specs", icon: "drawings" },
      { href: "/meetings", label: "Meetings", icon: "meetings", badge: "meetingActions" },
    ],
  },
];

const TRADE_NAV: NavGroup[] = [
  {
    heading: "My work",
    items: [
      { href: "/portal", label: "Overview", icon: "portal" },
      { href: "/portal/purchase-orders", label: "Purchase orders", icon: "purchaseOrders" },
      { href: "/portal/schedule", label: "Schedule", icon: "schedule" },
      { href: "/portal/service-orders", label: "Service orders", icon: "warranty" },
    ],
  },
];

/* ---------------------------------------------------------- local storage */

function usePersisted<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* blocked storage: the default is fine */
    }
  }, [key]);

  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* not worth failing over */
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}

/* ----------------------------------------------------------------- theme */

type Theme = "light" | "dark" | "system";

function useTheme() {
  const [theme, setTheme] = usePersisted<Theme>("corman_theme", "system");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  const cycle = useCallback(
    () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system")),
    [setTheme],
  );

  return { theme, cycle };
}

/* ----------------------------------------------------------------- shell */

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersisted("corman_sidebar_collapsed", false);
  const [closedGroups, setClosedGroups] = usePersisted<string[]>("corman_nav_closed", []);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { theme, cycle } = useTheme();

  useEffect(() => {
    if (!tokenStore.access) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        setChecked(true);
      })
      .catch(() => {
        tokenStore.clear();
        router.replace("/login");
      });
  }, [router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  // Ctrl/Cmd+K focuses the menu filter, and Ctrl/Cmd+B folds the rail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCollapsed(false);
        window.setTimeout(() => searchRef.current?.focus(), 60);
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCollapsed]);

  const isTrade = user?.role === "trade";
  const isHomeowner = user?.role === "homeowner";
  const isArchitect = user?.role === "architect";
  // Everyone who works FOR the builder. The three external roles are excluded.
  const isStaff = Boolean(user) && !isTrade && !isHomeowner && !isArchitect;
  const isReadOnly = user?.role === "executive";

  // Live counts for the nav badges. Staff only — the portals have nothing to count.
  const [counts, setCounts] = useState<Partial<Record<BadgeKey, number>>>({});
  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    Promise.all([
      api.dashboard().catch(() => null),
      api.listPurchaseOrders({ status: "draft" }).catch(() => []),
      api.listInvoices({ status: "received" }).catch(() => []),
      api.listRFIs({ status: "open" }).catch(() => []),
      api.expiringCompliance(30).catch(() => []),
      // One counted query rather than pulling every open observation down to
      // filter it here - the sidebar badge was loading the whole list on every
      // page load to find out how many were late.
      api.safetySummary().catch(() => null),
      api.submittalSummary().catch(() => null),
      api.documentsSummary().catch(() => null),
      api.meetingsSummary().catch(() => null),
      api.bidSummary().catch(() => null),
    ]).then(([dash, drafts, awaiting, rfis, expiring, safety, submittals, docs, mtg, bids]) => {
      if (cancelled) return;
      setCounts({
        overdueTasks: dash?.construction.overdue_tasks ?? 0,
        openWarranty: dash?.warranty.open_requests ?? 0,
        openLeads: dash?.sales.open_leads ?? 0,
        draftPOs: drafts.length,
        awaitingInvoices: awaiting.length,
        openRFIs: rfis.length,
        expiringCompliance: expiring.length,
        openObservations: safety?.overdue ?? 0,
        awaitingSubmittals: submittals?.awaiting_review ?? 0,
        docsExpiring: (docs?.expiring_soon ?? 0) + (docs?.expired ?? 0),
        meetingActions: mtg?.open_actions ?? 0,
        overdueBids: bids?.overdue ?? 0,
      });
    });
    return () => {
      cancelled = true;
    };
    // Refreshes on navigation, which is close enough without polling.
  }, [isStaff, pathname]);

  const groups = useMemo(() => {
    if (isTrade) return TRADE_NAV;
    if (isHomeowner) return HOMEOWNER_NAV;
    if (isArchitect) return ARCHITECT_NAV;
    // Hide what this role cannot use, so nobody clicks into a 403.
    const role = user?.role ?? "";
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
    })).filter((g) => g.items.length > 0);
  }, [isTrade, isHomeowner, isArchitect, user?.role]);

  const homeHref = isTrade
    ? "/portal"
    : isHomeowner
      ? "/my-home"
      : isArchitect
        ? "/rfis"
        : "/dashboard";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const currentLabel = useMemo(() => {
    const all = groups.flatMap((g) => g.items);
    return (
      all.find((i) => pathname === i.href)?.label ??
      all.find((i) => pathname.startsWith(`${i.href}/`))?.label ??
      ""
    );
  }, [groups, pathname]);

  if (!checked || !user) {
    return <Preloader label="Preparing your workspace" />;
  }

  function signOut() {
    tokenStore.clear();
    router.replace("/login");
  }

  function toggleGroup(heading: string) {
    setClosedGroups((c) =>
      c.includes(heading) ? c.filter((x) => x !== heading) : [...c, heading],
    );
  }

  const ThemeIcon = theme === "dark" ? Icons.moon : theme === "light" ? Icons.sun : Icons.dashboard;
  // Filtering is meaningless when the rail is folded to icons.
  const showSearch = !collapsed && groups.reduce((n, g) => n + g.items.length, 0) > 6;

  return (
    <UserContext.Provider value={user}>
      <div className={`shell ${collapsed ? "shell-collapsed" : ""}`}>
        {/* ---------------------------------------------------------- sidebar */}
        <aside
          className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
          aria-label="Main navigation"
        >
          <div className="sidebar-head">
            <Link href={homeHref} className="brand-link" title="Corman Leigh">
              <Logo
                size={32}
                showText
                subtitle={
                  isTrade
                    ? "Trade portal"
                    : isHomeowner
                      ? "Homeowner portal"
                      : isArchitect
                        ? "Design team"
                        : isReadOnly
                          ? "Read-only access"
                          : "Builder platform"
                }
              />
            </Link>

            <button
              className="icon-btn sidebar-collapse"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className={`collapse-chevron ${collapsed ? "is-collapsed" : ""}`}>
                <Icons.chevron size={15} />
              </span>
            </button>

            {mobileOpen && (
              <button
                className="icon-btn sidebar-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <Icons.close size={16} />
              </button>
            )}
          </div>

          {showSearch && (
            <div className="sidebar-search">
              <Icons.search size={14} />
              <input
                ref={searchRef}
                className="sidebar-search-input"
                placeholder="Filter menu"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter navigation"
              />
              {query ? (
                <button className="icon-btn" onClick={() => setQuery("")} aria-label="Clear filter">
                  <Icons.close size={13} />
                </button>
              ) : (
                <kbd className="kbd">⌘K</kbd>
              )}
            </div>
          )}

          <nav className="sidebar-scroll">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs" style={{ color: "var(--fg-subtle)" }}>
                Nothing matches that.
              </p>
            )}

            {filtered.map((group, gi) => {
              const folded = closedGroups.includes(group.heading) && !query;
              return (
                <div
                  key={group.heading}
                  className="nav-group"
                  style={{ animationDelay: `${gi * 45}ms` }}
                >
                  {!collapsed && (
                    <button
                      className="nav-heading"
                      onClick={() => toggleGroup(group.heading)}
                      aria-expanded={!folded}
                    >
                      <span>{group.heading}</span>
                      <span className={`heading-chevron ${folded ? "is-folded" : ""}`}>
                        <Icons.chevron size={11} />
                      </span>
                    </button>
                  )}

                  <div className={`nav-items ${folded ? "is-folded" : ""}`}>
                    <div className="nav-items-inner">
                      {group.items.map((item, ii) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/portal" && pathname.startsWith(`${item.href}/`));
                      const Icon = Icons[item.icon];
                      const count = item.badge ? counts[item.badge] : undefined;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          data-guide={item.href}
                          className={`nav-item ${active ? "nav-item-active" : ""}`}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? item.label : undefined}
                          style={{ animationDelay: `${gi * 45 + ii * 22}ms` }}
                        >
                          <span className="nav-icon">
                            <Icon size={17} />
                            {collapsed && Boolean(count) && <span className="nav-dot" />}
                          </span>
                          <span className="nav-label">{item.label}</span>
                          {Boolean(count) && <span className="nav-badge">{count}</span>}
                          {collapsed && <span className="nav-tip">{item.label}</span>}
                        </Link>
                      );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="sidebar-foot">
            <ProfileButton
              user={user}
              collapsed={collapsed}
              onUpdated={setUser}
              onSignOut={signOut}
            />
          </div>
        </aside>

        {mobileOpen && (
          <div className="scrim md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
        )}

        {/* ------------------------------------------------------------- main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="topbar" data-guide-ignore>
            <button
              className="icon-btn md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icons.menu size={18} />
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-sm">
                <li>
                  <Link href={homeHref} className="crumb-root">
                    Corman Leigh
                  </Link>
                </li>
                {currentLabel && (
                  <>
                    <li aria-hidden style={{ color: "var(--fg-subtle)", display: "flex" }}>
                      <Icons.chevron size={13} />
                    </li>
                    <li className="truncate font-medium">{currentLabel}</li>
                  </>
                )}
              </ol>
            </nav>

            <GuideToggle />

            <button
              className="icon-btn"
              onClick={cycle}
              title={`Theme: ${theme}. Click to change.`}
              aria-label={`Theme: ${theme}. Click to change.`}
            >
              <ThemeIcon size={17} />
            </button>
          </header>

          <ScrollArea>
            <GuidePanel />
            {children}
          </ScrollArea>
        </div>
      </div>
    </UserContext.Provider>
  );
}

/* ------------------------------------------- scrolling main + back-to-top */

function ScrollArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? el.scrollTop / max : 0);
      setShowTop(el.scrollTop > 360);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    setProgress(0);
  }, [pathname]);

  return (
    <main ref={ref} className="main-scroll">
      <div className="main-inner">{children}</div>

      <button
        className={`to-top ${showTop ? "to-top-visible" : ""}`}
        onClick={() => ref.current?.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
      >
        {/* The ring traces how far down the page you are. */}
        <svg className="to-top-ring" viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="18" fill="none" stroke="var(--border)" strokeWidth="2" />
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 18}
            strokeDashoffset={2 * Math.PI * 18 * (1 - progress)}
            transform="rotate(-90 20 20)"
          />
        </svg>
        <Icons.arrowUp size={16} />
      </button>
    </main>
  );
}
