"use client";

/**
 * Guide mode: a top-bar toggle that turns the app into its own manual.
 *
 * While it is on, clicking a feature does NOT act - it opens a card explaining
 * what that feature is, how to use it, and who it is for, with a button to go
 * there. Turn it off and everything behaves normally again.
 *
 * Two ways an element becomes explainable:
 *
 *   data-guide="<key>"   an explicit tag, outlined so people can see what is
 *                        clickable. Keys are routes ("/invoices") or named
 *                        controls ("header.theme").
 *   its visible label    anything else - a button reading "Approve", a column
 *                        headed "Forecast" - is matched against the term
 *                        registry, so the whole app answers without 33 pages
 *                        having to be tagged one control at a time.
 *
 * The on/off choice is a per-viewer convenience, so it lives in localStorage,
 * read through useSyncExternalStore: the server always renders "off", so there
 * is no hydration mismatch, and no setState-in-effect. Storage throws in
 * private windows, so an in-memory value backs it up and the toggle still works.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { Icons } from "@/components/icons";
import { explain, guideFor, type Explanation, type GuideEntry } from "@/lib/guide";

const KEY = "corman_guide_mode";
const EVENT = "corman:guide-mode";
let memory = false;

function read(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? memory : v === "1";
  } catch {
    return memory;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useGuideMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

function setGuideMode(on: boolean) {
  memory = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* the in-memory value still applies for this tab */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Kept for callers that want both halves. */
export function useGuide() {
  const on = useGuideMode();
  return { on, toggle: useCallback(() => setGuideMode(!on), [on]) };
}

/* ------------------------------------------------------------- what was clicked */

type Card =
  | { kind: "screen"; entry: GuideEntry; href?: string }
  | { kind: "control"; label: string; explanation: Explanation | null; el: HTMLElement };

function describe(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || el.getAttribute("role") === "button") return "button";
  if (tag === "a") return "link";
  if (tag === "select") return "dropdown";
  if (tag === "th") return "column";
  if (tag === "textarea") return "text box";
  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    return type === "checkbox" ? "checkbox" : type === "date" ? "date field" : "field";
  }
  return "item";
}

function labelOf(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const title = el.getAttribute("title");
  if (title) return title;
  if (el.tagName.toLowerCase() === "select") {
    const sel = el as HTMLSelectElement;
    return sel.options[sel.selectedIndex]?.text ?? "";
  }
  const text = (el.innerText || el.textContent || "").trim();
  // Only short text reads as a label. A whole table row does not.
  return text.length > 0 && text.length <= 60 ? text : "";
}

/* --------------------------------------------------------------------- toggle */

/** Top-bar switch. Labelled, not just an icon - people hunt for help. */
export function GuideToggle() {
  const on = useGuideMode();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-guide-ignore
      onClick={() => setGuideMode(!on)}
      className="guide-toggle"
      data-on={on}
      title={
        on
          ? "Guide is on: click any feature to learn what it does"
          : "Turn on the guide and click anything to find out what it does"
      }
    >
      <span aria-hidden className="guide-toggle-glyph">
        <Icons.guide size={14} />
      </span>
      <span className="guide-toggle-label">Guide</span>
      <span className="guide-toggle-track" aria-hidden>
        <span className="guide-toggle-knob" />
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------------- layer */

/** Mounted once in the app layout: intercepts clicks while on, and shows the card. */
export function GuideModeLayer() {
  const on = useGuideMode();
  const router = useRouter();
  const pathname = usePathname();
  const [card, setCard] = useState<Card | null>(null);

  // Reflect the mode on <html> for the outline styles. Writing to the DOM is an
  // external side effect, not React state.
  useEffect(() => {
    document.documentElement.classList.toggle("guide-mode", on);
    if (!on) setCard(null);
  }, [on]);

  // A new screen is a new context, so the old card is no longer about anything.
  useEffect(() => setCard(null), [pathname]);

  // Capture phase on window runs before React's own handlers, so stopping it
  // here means the link does not navigate and the button does not fire.
  useEffect(() => {
    if (!on) return;

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-guide-ignore]")) return;

      // An explicit tag wins: it names a whole screen rather than one control.
      const tagged = target.closest("[data-guide]") as HTMLElement | null;
      if (tagged) {
        const key = tagged.getAttribute("data-guide") ?? "";
        const entry = guideFor(key);
        if (entry) {
          e.preventDefault();
          e.stopPropagation();
          setCard({ kind: "screen", entry, href: entry.href ?? key });
          return;
        }
      }

      // Otherwise match on what the control says it is.
      let el: HTMLElement | null = target;
      let fallback: { label: string; el: HTMLElement } | null = null;
      for (let d = 0; el && d < 6; d += 1, el = el.parentElement) {
        const label = labelOf(el);
        if (!label) continue;
        const hit = explain(pathname, label);
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          setCard({ kind: "control", label, explanation: hit, el });
          return;
        }
        if (!fallback) fallback = { label, el };
      }

      if (fallback) {
        e.preventDefault();
        e.stopPropagation();
        setCard({ kind: "control", label: fallback.label, explanation: null, el: fallback.el });
      }
    }

    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [on, pathname]);

  const close = useCallback(() => setCard(null), []);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, close]);

  return (
    <>
      {on && !card && (
        <div className="guide-banner" data-guide-ignore>
          <span aria-hidden>
            <Icons.guide size={15} />
          </span>
          <span>Guide is on — click any feature to see what it does.</span>
          <button className="guide-banner-off" onClick={() => setGuideMode(false)}>
            Turn off
          </button>
        </div>
      )}

      {card && (
        <div className="guide-overlay" onClick={close} role="presentation" data-guide-ignore>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-card-title"
            onClick={(e) => e.stopPropagation()}
            className="guide-card"
          >
            {card.kind === "screen" ? (
              <ScreenCard entry={card.entry} href={card.href} onClose={close} router={router} />
            ) : (
              <ControlCard card={card} onClose={close} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- the cards */

function CardHead({ icon, kicker, title, onClose }: {
  icon: ReactNode;
  kicker: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="guide-card-head">
      <span className="guide-card-icon" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="guide-card-kicker">{kicker}</p>
        <h2 id="guide-card-title" className="guide-card-title">
          {title}
        </h2>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close">
        <Icons.close size={16} />
      </button>
    </div>
  );
}

function ScreenCard({
  entry,
  href,
  onClose,
  router,
}: {
  entry: GuideEntry;
  href?: string;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      <CardHead icon={entry.icon} kicker="Guide" title={entry.title} onClose={onClose} />

      <div className="guide-card-body">
        <p className="guide-card-what">{entry.what}</p>

        {entry.actions && entry.actions.length > 0 && (
          <div>
            <p className="guide-card-label">How to use it</p>
            <ul className="guide-card-list">
              {entry.actions.map((a) => (
                <li key={a.label}>
                  <span className="guide-dot" aria-hidden />
                  <span>
                    <strong>{a.label}.</strong> {a.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.connects && entry.connects.length > 0 && (
          <div>
            <p className="guide-card-label">What else it moves</p>
            <ul className="guide-card-list">
              {entry.connects.map((c) => (
                <li key={c}>
                  <span className="guide-dot" aria-hidden />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.caveat && (
          <p className="guide-card-caveat">
            <strong>Not finished:</strong> {entry.caveat}
          </p>
        )}

        <p className="guide-card-who">
          <strong>Who can use it:</strong> {entry.who.join(", ")}
        </p>
      </div>

      <div className="guide-card-foot">
        <Link href="/guide" onClick={onClose} className="guide-card-fulllink">
          Full guide
        </Link>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          {href && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onClose();
                router.push(href);
              }}
            >
              Open {entry.title}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ControlCard({
  card,
  onClose,
}: {
  card: Extract<Card, { kind: "control" }>;
  onClose: () => void;
}) {
  const e = card.explanation;
  return (
    <>
      <CardHead
        icon={<Icons.guide size={20} />}
        kicker="Guide"
        title={e ? e.title : card.label}
        onClose={onClose}
      />

      <div className="guide-card-body">
        {e ? (
          <>
            <p className="guide-card-what">{e.body}</p>

            {e.effect && (
              <div>
                <p className="guide-card-label">What else it moves</p>
                <p className="guide-card-effect">{e.effect}</p>
              </div>
            )}

            {e.refuses && (
              <div>
                <p className="guide-card-label">It can refuse</p>
                <p className="guide-card-refuses">{e.refuses}</p>
              </div>
            )}
          </>
        ) : (
          <p className="guide-card-what">
            This is a <strong>{describe(card.el)}</strong> labelled &ldquo;{card.label}&rdquo;.
            There is no note written for it yet — the{" "}
            <Link href="/guide" onClick={onClose}>
              full guide
            </Link>{" "}
            covers what this screen is for.
          </p>
        )}
      </div>

      <div className="guide-card-foot">
        <Link href="/guide" onClick={onClose} className="guide-card-fulllink">
          Full guide
        </Link>
        <button className="btn btn-primary btn-sm" onClick={onClose}>
          Got it
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- page banner */

/** A short strip naming what this screen is for. Detail comes per click. */
export function GuidePanel() {
  const on = useGuideMode();
  const pathname = usePathname();

  if (!on) return null;
  const entry = guideFor(pathname);
  if (!entry) return null;

  return (
    <aside className="guide-panel reveal" aria-label={`About ${entry.title}`} data-guide-ignore>
      <div className="guide-panel-head">
        <span className="guide-panel-mark" aria-hidden>
          {entry.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="guide-panel-title">{entry.title}</p>
          <p className="guide-panel-what">{entry.what}</p>
          <p className="guide-panel-hint">
            Click any feature to find out what it does. Nothing will actually run.{" "}
            <Link href="/guide">Full guide</Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
