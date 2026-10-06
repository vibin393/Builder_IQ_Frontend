"use client";

import Link from "next/link";
import { useState } from "react";

import { useGuide } from "@/components/Guide";
import { Icons } from "@/components/icons";
import { Badge, Card, PageHeader, Tabs } from "@/components/ui";
import { GUIDE } from "@/lib/guide";

const TABS = ["How it works", "The people", "Every screen", "Words we use"] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------------------------------------------ flow */

const STAGES = [
  {
    n: 1,
    name: "Sell it",
    who: "Sales",
    body: "An enquiry becomes a lead, a lead becomes a buyer, and a buyer signs a contract against a lot and a plan. The contract is base price plus lot premium plus options, less incentives.",
    key: "A home record is created. Everything else in the system hangs off it.",
  },
  {
    n: 2,
    name: "Let them choose",
    who: "Sales · Design studio",
    body: "The buyer picks options in the design studio. Each option carries both what you charge and what it costs you.",
    key: "One confirmed selection moves three records at once: the contract price, the budget, and the schedule. That is the cascade, and it is the reason a homebuilder needs different software from a general contractor.",
  },
  {
    n: 3,
    name: "Buy the work",
    who: "Purchasing",
    body: "Budget lines go out to bid. Trades price them. Awarding a bid raises the purchase order at the bid price, so the number cannot drift in between.",
    key: "Issuing a purchase order passes two gates: is it over budget, and is the trade cleared to work. Both refuse by default and both can be overridden — with the override recorded.",
  },
  {
    n: 4,
    name: "Build it",
    who: "Superintendent",
    body: "A schedule template is stamped onto the home. Daily logs, inspections, punch items and hours are recorded against it. Questions become RFIs; what gets installed is approved as a submittal.",
    key: "A failed inspection raises an observation — a fix somebody owes, with a due date. A costly RFI answer becomes a change order.",
  },
  {
    n: 5,
    name: "Pay for it",
    who: "Accounting",
    body: "Trades invoice against their purchase orders. Approving an invoice turns committed cost into actual cost. Retainage is held back until the scope is signed off.",
    key: "An invoice above its purchase order is refused unless overridden. Releasing retainage needs a lien waiver on file.",
  },
  {
    n: 6,
    name: "Hand it over",
    who: "Warranty",
    body: "The buyer walks the home, raising punch items. The home closes and the warranty period starts. Claims become service orders sent back to the responsible trade.",
    key: "Everything that happened feeds the trade scorecard, which feeds the next bid award. The loop closes.",
  },
];

const MONEY = [
  { term: "Budget", body: "What the home is planned to cost, per cost code.", tone: "neutral" },
  { term: "Committed", body: "Promised to a trade on an issued purchase order.", tone: "brand" },
  { term: "Actual", body: "Invoiced and approved.", tone: "ok" },
  { term: "Exposure", body: "The greater of committed and actual — an invoice above its PO still counts.", tone: "warn" },
  { term: "Pending", body: "Change orders raised but not yet approved.", tone: "warn" },
  { term: "Forecast", body: "Exposure plus pending. Where the home lands if everything in flight lands.", tone: "danger" },
  { term: "Retainage", body: "Certified but withheld. Reduces what is paid, never what is costed.", tone: "neutral" },
];

/* --------------------------------------------------------------- people */

const PEOPLE = [
  {
    group: "Internal — your own staff",
    external: false,
    rows: [
      { role: "Owner", does: "Everything. The business view.", sees: "All" },
      { role: "Admin", does: "Runs the system: users, cost codes, templates.", sees: "All" },
      { role: "Executive", does: "Reads the business. Changes nothing.", sees: "All, read-only" },
      { role: "Sales", does: "Leads, contracts, selections, design appointments.", sees: "No budgets, no margin" },
      { role: "Purchasing", does: "Budgets, bidding, purchase orders, compliance.", sees: "The money" },
      { role: "Accounting", does: "Invoices, retainage, the GL export.", sees: "Payables" },
      { role: "Superintendent", does: "Schedule, field, safety, RFIs, labour.", sees: "No contract prices" },
      { role: "Warranty", does: "Claims after handover, service orders.", sees: "Homes and claims" },
    ],
  },
  {
    group: "External — they work with you, not for you",
    external: true,
    rows: [
      { role: "Architect", does: "Answers RFIs, reviews submittals, reads drawings.", sees: "Design surfaces only" },
      { role: "Trade", does: "Acknowledges their POs, sees their week.", sees: "Their own work only" },
      { role: "Homeowner", does: "Watches progress, raises warranty claims.", sees: "Their own home only" },
    ],
  },
];

const WORDS = [
  ["Cascade", "One confirmed selection moving contract, budget and schedule together, atomically."],
  ["Ball in court", "Whose move it is on an RFI, submittal or punch item. Never ambiguous, never nobody."],
  ["Cost code", "The chart of accounts for building. Everything — budget, PO, invoice, labour — lands on one."],
  ["Responsible party", "Who absorbs a change order: buyer (billed), builder (absorbed), or trade (backcharged)."],
  ["Prequalification", "Whether a trade is cleared to work. Checked at the moment a purchase order is issued."],
  ["Supersede", "A revised drawing set replaces the old one without deleting it. The old set is evidence of what a trade priced from."],
  ["Transmittal", "Proof that a named trade was sent a specific revision, and whether they acknowledged it."],
  ["Observation", "Something seen on site that somebody now owes a fix for, with a due date. Not a note."],
  ["Lien waiver", "The document that protects your title at closing. Retainage is the leverage for getting one."],
  ["Provisional", "A scorecard figure built on too little history to be a verdict."],
];

export default function GuidePage() {
  const [tab, setTab] = useState<Tab>("How it works");
  const { on, toggle } = useGuide();

  const screens = Object.entries(GUIDE).sort((a, b) => a[1].title.localeCompare(b[1].title));

  return (
    <>
      <PageHeader
        title="Guide"
        subtitle="How the system works, who uses it, and what each screen is for."
        action={
          <button className="btn btn-primary" onClick={toggle}>
            {on ? "Turn guide mode off" : "Turn guide mode on"}
          </button>
        }
      />

      {!on && (
        <div
          className="mb-6 flex items-start gap-3 rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--brand-soft)", color: "var(--brand-fg)" }}
        >
          <span className="mt-0.5 shrink-0">
            <Icons.guide size={16} />
          </span>
          <span>
            <strong>Turn guide mode on</strong> and every screen in the app grows a panel
            explaining what it is for, whose job it is, and what moves elsewhere when you act. It
            stays on until you turn it off.
          </span>
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ------------------------------------------------------- how it works */}
      {tab === "How it works" && (
        <div className="space-y-4">
          <Card title="One home, start to finish">
            <ol className="guide-stages">
              {STAGES.map((s) => (
                <li key={s.n}>
                  <span className="guide-stage-n" aria-hidden>
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="guide-stage-name">
                      {s.name}
                      <span className="guide-stage-who">{s.who}</span>
                    </p>
                    <p className="guide-stage-body">{s.body}</p>
                    <p className="guide-stage-key">{s.key}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="How money moves through a home">
            <p className="mb-4 text-sm" style={{ color: "var(--fg-muted)" }}>
              Six words, and they never collapse into each other. Most cost overruns are somebody
              confusing two of them.
            </p>
            <dl className="guide-money">
              {MONEY.map((m) => (
                <div key={m.term}>
                  <dt>
                    <Badge tone={m.tone as "neutral" | "brand" | "ok" | "warn" | "danger"}>
                      {m.term}
                    </Badge>
                  </dt>
                  <dd>{m.body}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="The three gates">
            <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
              The system refuses three things by default. Each can be overridden, and every
              override is recorded rather than hidden — blocking people outright just means they
              work around the system, and then the record is worthless.
            </p>
            <ul className="guide-connects">
              <li>
                <strong>Over budget.</strong> Issuing a purchase order that commits more than the
                budget line has left.
              </li>
              <li>
                <strong>Trade not cleared.</strong> Issuing to a trade who is rejected, whose
                certificate has lapsed, or whose review is overdue.
              </li>
              <li>
                <strong>Invoice above its PO.</strong> Approving a bill larger than what was
                committed. This is the most common way margin leaks out of a job.
              </li>
            </ul>
          </Card>
        </div>
      )}

      {/* ----------------------------------------------------------- people */}
      {tab === "The people" && (
        <div className="space-y-4">
          {PEOPLE.map((g) => (
            <Card key={g.group} title={g.group}>
              <div className="guide-people">
                {g.rows.map((r) => (
                  <div key={r.role} className="guide-person" data-external={g.external}>
                    <p className="guide-person-role">
                      {r.role}
                      {g.external && <Badge tone="warn">External</Badge>}
                    </p>
                    <p className="guide-person-does">{r.does}</p>
                    <p className="guide-person-sees">{r.sees}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card title="How the walls are built">
            <ul className="guide-connects">
              <li>
                External accounts live in the same tenant as your staff, but every builder-side
                endpoint refuses them. This is enforced in the API, not hidden in the menu — a
                trade who guesses a URL still gets a 403.
              </li>
              <li>
                The tenant comes from the signed token, never from anything the browser sends. A
                record belonging to another builder returns 404, not 403, because a 403 would
                confirm it exists.
              </li>
              <li>
                Read-only roles are refused at the moment they authenticate, before the request
                body is even read. A guard you have to remember on every route is one you will
                forget on the route that matters.
              </li>
            </ul>
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------------- screens */}
      {tab === "Every screen" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {screens.map(([path, e]) => (
            <Card key={path} title={e.title}>
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                {e.what}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.who.map((w) => (
                  <span key={w} className="guide-chip">
                    {w}
                  </span>
                ))}
              </div>
              {e.caveat && (
                <p className="guide-caveat mt-3">
                  <strong>Not finished:</strong> {e.caveat}
                </p>
              )}
              <p className="mt-3 text-sm">
                <Link href={path} style={{ color: "var(--brand)" }}>
                  Open {e.title} →
                </Link>
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ words */}
      {tab === "Words we use" && (
        <Card title="Glossary">
          <dl className="guide-money">
            {WORDS.map(([term, body]) => (
              <div key={term}>
                <dt>
                  <strong>{term}</strong>
                </dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
