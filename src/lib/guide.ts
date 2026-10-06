/**
 * In-app guidance, one entry per screen.
 *
 * Kept in one file rather than scattered through the pages for two reasons: the
 * explanations need to be read against each other to stay consistent, and a
 * writer who is not a developer can edit this without touching a component.
 *
 * Each entry answers the four questions somebody new actually has:
 *
 *   what      why this screen exists at all
 *   who       whose job this is
 *   actions   what you can do here, and what each action really does
 *   connects  what moves elsewhere when you act - the part that is never obvious
 */

export interface GuideAction {
  label: string;
  detail: string;
}

export interface GuideEntry {
  title: string;
  /** Shown in the guide card. One glyph, so a screen is recognisable at a glance. */
  icon: string;
  what: string;
  who: string[];
  /** How to use it. Rendered as the "How to use it" list in the card. */
  actions?: GuideAction[];
  connects?: string[];
  /** Stated plainly where a screen is knowingly incomplete. */
  caveat?: string;
  /** Where the card's "Open" button goes. Defaults to the entry's own key. */
  href?: string;
}

export const GUIDE: Record<string, GuideEntry> = {
  "/dashboard": {
    title: "Dashboard",
    icon: "🏠",
    what: "Everything that is true about the business right now, on one screen: what has sold, what it is costing, and what is about to go wrong.",
    who: ["Owner", "Executive", "Admin"],
    actions: [
      {
        label: "Live toggle",
        detail:
          "Refreshes every 60 seconds. Builders leave this on a wall screen in the site office.",
      },
      {
        label: "Project controls band",
        detail:
          "Six counters of work somebody owes. A pulsing dot means it is blocking work on site today.",
      },
      {
        label: "Export",
        detail: "Downloads the summary as CSV for a board pack.",
      },
    ],
    connects: [
      "Every tile is a link. The numbers are computed from the operational records, never stored, so a report can never disagree with the records it summarises.",
      "The forecast figure includes change orders that are raised but not yet approved - cost you can see coming before it commits.",
    ],
  },

  "/leads": {
    title: "Leads",
    icon: "🔎",
    what: "Everyone who has enquired but not yet signed. The top of the funnel.",
    who: ["Sales", "Owner", "Admin"],
    actions: [
      {
        label: "Work the queues first",
        detail:
          "Unassigned is leads nobody owns; Needs chasing is leads whose follow-up date has passed. Those two are where deals go quiet.",
      },
      {
        label: "Move through stages",
        detail:
          "New, contacted, qualified, appointment, converted or lost. The system will not let a lead skip qualification on its way to being a buyer.",
      },
      {
        label: "Log a call or visit",
        detail:
          "Records the touch and moves the lead on by itself: a real contact on a new lead makes it contacted, and an outcome of 'booked' makes it an appointment. Set the next follow-up in the same box.",
      },
      {
        label: "Claim, assign, or assign in bulk",
        detail:
          "Claim takes a lead yourself in one click. Tick several rows to hand out the morning's enquiries at once.",
      },
      {
        label: "Mark lost, with the reason",
        detail:
          "Price, timing, or which builder won it. A pipeline of unexplained losses tells you nothing; an annotated one shows where you are losing.",
      },
    ],
    connects: [
      "Converting a lead creates the buyer record that the contract is written against.",
      "Source and campaign are kept through conversion, so the marketing report can trace spend to a completed sale rather than only to an enquiry.",
      "Leads from an agent count towards that agent's record, which is what the Agents table ranks.",
    ],
    caveat:
      "A converted lead cannot be archived. It is the only trace of where a real buyer came from.",
  },

  "/leads/sources": {
    title: "Lead sources",
    icon: "📥",
    what: "The channels leads arrive through without anybody typing them in: your website form, the property portals, Facebook and Google ads, and an enquiries inbox.",
    who: ["Owner", "Admin", "Sales"],
    actions: [
      {
        label: "Add a channel",
        detail:
          "Pick what is sending the leads and you are given a URL and a key. Give both to whoever is sending them. The key appears once and is stored hashed - if it is lost, rotate it.",
      },
      {
        label: "Clear the failed queue",
        detail:
          "Enquiries we received and could not read. Each one is a real person who has had no reply. View the payload, correct the field map, and replay.",
      },
      {
        label: "Watch Last heard",
        detail:
          "A channel that stops sending produces no error at all - just fewer leads than last month. This column is the only thing that makes it visible.",
      },
      {
        label: "Pause a channel",
        detail:
          "Stops accepting without losing the configuration or the history. What you reach for when a form starts taking bot traffic.",
      },
    ],
    connects: [
      "Every payload is stored the moment it lands, before anything tries to read it - so a feed that renames a field costs a delay, never a customer.",
      "Automated leads are shared out between sales staff in turn, so nothing piles up unowned. Turn that off and they land in the Unassigned queue instead.",
      "A repeat enquiry from somebody already in the system is attached to their existing lead rather than duplicated, because a webhook has nobody to ask.",
    ],
    caveat:
      "The field names each portal actually sends should be confirmed against one real payload before you rely on a channel. Nothing is lost while a mapping is wrong - it sits in the failed queue - but nobody is replying either.",
  },

  "/jobs": {
    title: "Homes",
    icon: "🏘️",
    what: "One record per house being built: the plot, the plan, the buyer, the contract, the budget and the schedule. Everything else in the system hangs off this.",
    who: ["Everyone internal"],
    actions: [
      {
        label: "Watch the three queues",
        detail:
          "On site, Stopped and Running late. A stopped build burns a plot, a superintendent and a budget while making no noise at all — it is the one that costs most and shouts least.",
      },
      {
        label: "Start a home",
        detail:
          "Puts a house on a free plot. Only plots with no live home on them are offered, so you cannot double-book one.",
      },
      {
        label: "Move it through its life",
        detail:
          "Permit, start, hold, resume, complete, hand over. Each is its own step because each sets a date the business is measured by, and the system refuses the ones that would make those dates nonsense.",
      },
      {
        label: "Cancel a home",
        detail:
          "Gives the plot back so another house can be built on it, and keeps the cancellation on the books with a reason that can be counted.",
      },
    ],
    connects: [
      "Selling creates the buyer and the contract, and records the sale date — sold-to-start is the gap a sales director argues about.",
      "Starting the build freezes the projected completion. That frozen date is what 'late' is measured against; a projection quietly moved each time it slips measures nothing.",
      "Closing transfers title and starts the warranty clock from handover, not from completion — a buyer cannot report a fault in a house they do not have yet.",
    ],
    caveat:
      "Status is not editable directly. It moves through the lifecycle steps, which check the move is legal and write the dates that go with it.",
  },

  "/options": {
    title: "Option catalog",
    icon: "🎨",
    what: "Everything a buyer can choose, with both what you charge and what it costs you. The gap between the two is your margin on options, which is where a homebuilder actually makes money.",
    who: ["Sales", "Purchasing", "Admin"],
    actions: [
      {
        label: "Cost lines",
        detail:
          "Break an option down by cost code, so choosing it lands in the right budget line rather than a lump sum.",
      },
    ],
    connects: [
      "Price and cost are both recorded here, then snapshotted onto the selection. Change the catalogue tomorrow and yesterday's contracts stay as signed.",
    ],
  },

  "/compliance": {
    title: "Trade compliance",
    icon: "🛡️",
    what: "Whether a trade is cleared to work, and whether their insurance is still current. This is the gate that refuses a purchase order.",
    who: ["Purchasing", "Admin", "Owner"],
    actions: [
      {
        label: "Approve / Reject",
        detail:
          "Approving clears them for work. Rejecting means every purchase order to them is refused until it changes.",
      },
      {
        label: "Check",
        detail: "Runs the exact test the purchase-order gate runs, without issuing anything.",
      },
      {
        label: "Cover gaps tab",
        detail:
          "Tasks scheduled to run past a trade's insurance expiry. The gate refuses when money moves, which is correct but late - this asks the same question early enough to chase a renewal.",
      },
    ],
    connects: [
      "Issuing a purchase order calls this. A rejection, a lapsed certificate or an overdue review returns a 409 naming the problem.",
      "A trade with no record at all issues with a warning rather than a refusal, so the module can be switched on without freezing every existing trade.",
    ],
  },

  "/purchase-orders": {
    title: "Purchase orders",
    icon: "📄",
    what: "What you have promised to pay a trade. A draft is not a commitment; issuing it is what commits the money.",
    who: ["Purchasing", "Accounting", "Admin"],
    actions: [
      {
        label: "Issue",
        detail:
          "Runs two gates: over-budget, and trade compliance. Both can be overridden, and the override is recorded rather than hidden.",
      },
      {
        label: "Retainage %",
        detail:
          "Held back from every payment until the scope is signed off. Zero for materials; 5-10% is normal for trade labour.",
      },
    ],
    connects: [
      "Issuing turns budget into committed cost.",
      "The PO lines act as the schedule of values: an invoice can bill a portion of a line at a time.",
    ],
  },

  "/invoices": {
    title: "Invoices",
    icon: "🧾",
    what: "What a trade has actually billed. Approving one turns committed cost into actual cost.",
    who: ["Accounting", "Purchasing", "Admin"],
    actions: [
      {
        label: "Approve",
        detail:
          "Refused by default when the invoice exceeds its purchase order. A vendor billing above their PO is the most common way margin leaks out of a job.",
      },
      {
        label: "Release retainage",
        detail:
          "Refused without a lien waiver on file. Retainage is the leverage for getting one - releasing it first throws that away.",
      },
    ],
    connects: [
      "Retainage reduces what is paid, never what is costed. The work was done, so the cost is real; what is withheld is the payment.",
    ],
  },

  "/rfis": {
    title: "RFIs",
    icon: "❓",
    what: "Questions that must be answered before work can proceed. Every one names whose court the ball is in, so nothing sits unowned.",
    who: ["Superintendent", "Architect", "Admin"],
    actions: [
      {
        label: "Ball in court",
        detail:
          "Change it from the dropdown. Builder, trade, architect, engineer or buyer - whoever owes the answer next.",
      },
      {
        label: "Answer",
        detail: "Records the decision, and whether it costs money or time.",
      },
      {
        label: "Raise CO",
        detail:
          "Turns a costly answer into a priced change order against a named party. This join is the thing neither BuildTopia nor Procore can do on its own.",
      },
    ],
    connects: [
      "A change order raised here appears in the job's forecast immediately, and moves the buyer's contract when approved.",
      "The schedule impact carries across from the answer rather than being retyped.",
    ],
  },

  "/submittals": {
    title: "Submittals",
    icon: "📐",
    what: "What a trade proposes to actually install, approved before it is ordered.",
    who: ["Superintendent", "Architect", "Purchasing"],
    actions: [
      {
        label: "Review",
        detail:
          "Approved, approved as noted, revise and resubmit, or rejected. Revise-and-resubmit bumps the revision rather than overwriting.",
      },
    ],
    connects: [
      "Linking a submittal to the buyer's selection proves the fitting matches what they chose. Procore has no equivalent, because Procore has no buyer.",
    ],
  },

  "/drawings": {
    title: "Drawings & specs",
    icon: "🗂️",
    what: "Issued drawing sets, the sheets inside them, written specifications, and proof of who was sent what.",
    who: ["Superintendent", "Architect", "Purchasing"],
    actions: [
      {
        label: "Issue",
        detail: "Releases a set to trades. This is what they should be building from.",
      },
      {
        label: "Revise",
        detail:
          "Creates the next revision and marks the old one superseded, keeping it. A superseded set is the evidence of what a trade priced from - overwriting it destroys your defence in a dispute.",
      },
      {
        label: "Transmittal",
        detail: "Records who was sent which revision, and who acknowledged it.",
      },
    ],
    connects: [
      'Without a transmittal, "we sent you the revised drawings" is one party\'s word against another\'s.',
    ],
  },

  "/safety": {
    title: "Safety & quality",
    icon: "⛑️",
    what: "Fixes somebody owes with a date on them, incidents that happened and what the law requires be done about them, and the checklists you run on every home.",
    who: ["Superintendent", "Admin", "Owner"],
    actions: [
      {
        label: "Raise an observation",
        detail:
          "An owed fix, not a note. Left without a date it gets one from the severity \u2014 a day for critical, a fortnight for low \u2014 because an observation with no date is the thing that is still open at handover.",
      },
      {
        label: "Accept the fix",
        detail:
          "An observation closes when somebody looks at the fix, not when the trade says it is done. Those are two different claims and only the first is an outcome.",
      },
      {
        label: "RIDDOR category",
        detail:
          "What the law says about an incident, and therefore the deadline. Suggested from the facts so the question is never left unasked \u2014 the failure mode of a tick box is silently not reporting something.",
      },
      {
        label: "Record the HSE report",
        detail:
          "The category says a report is owed; only this says anybody made it, which is the part the HSE asks about.",
      },
      {
        label: "Start a template on a home",
        detail:
          "Copies the checklist\u2019s steps onto the home. Copied, not referenced \u2014 editing the template next month must not rewrite what somebody signed last month.",
      },
      {
        label: "Witness a step",
        detail:
          "A step marked as needing one is not done until somebody who did not do the work has signed it off. The system refuses if you try to witness your own.",
      },
    ],
    connects: [
      "A failed inspection raises an observation automatically, so the inspection record shows what was done about the problem rather than only that there was one. The punch items generated from the individual failed checks are the work list; this is the single tracked action with an owner and a date.",
      "Closing a reportable incident is refused until the HSE has been told. It is the one rule on this screen with a legal consequence rather than a commercial one.",
      "Observations and incidents both feed the trade scorecard.",
    ],
  },

  "/field": {
    title: "Field ops",
    icon: "🔨",
    what: "The last fortnight of a build, where the question stops being what are we doing and becomes what is stopping this house being handed over.",
    who: ["Superintendent", "Admin"],
    actions: [
      {
        label: "Severity",
        detail:
          "A scuff and a cracked soil pipe are both defects and only one of them should stop a handover. Cosmetic is the only severity that does not: everything above it holds the keys until it is signed off.",
      },
      {
        label: "Sign it off",
        detail:
          "A defect closes when somebody looks at the fix, not when the trade says it is done. Those are two different claims and the list used to record only the first.",
      },
      {
        label: "Make a punch list from the failures",
        detail:
          "Turns every failed check on an inspection into its own defect against the trade whose check it was. Retyping thirty of them is how three get missed.",
      },
      {
        label: "Book a re-inspection",
        detail:
          "Points back at the inspection it is retrying, so how many attempts this took can be asked - which is what tells you whose work is costing you the fees.",
      },
      {
        label: "Today's log",
        detail:
          "One log per home per day. Filing again adds to that day's entry rather than creating a second one, because a record that contradicts itself substantiates nothing.",
      },
    ],
    connects: [
      "Handing a home over is refused while any defect on it blocks handover. That gate is the point of the severity field - without it the rule would be either every scuff or nothing at all.",
      "A defect raised at the buyer walkthrough is marked as such, and scores worse against the trade than one your own QA caught.",
      "Re-inspection fees are small and relentless. Recording them is what lets one be argued back to the trade who caused it.",
    ],
  },

  "/labour": {
    title: "Labour & productivity",
    icon: "⏱️",
    what: "Hours booked against a home and a cost code, measured against what the home was supposed to take. What you spent is the half you already knew.",
    who: ["Superintendent", "Accounting", "Admin"],
    actions: [
      {
        label: "Set targets",
        detail:
          "The hours each cost code was supposed to take on this home. Without one, a row can only report actuals \u2014 a variance against zero is the actual with a minus sign in front of it.",
      },
      {
        label: "Record time",
        detail:
          "Leave the rate blank and the trade\u2019s standard rate fills it in. Overtime is charged at 1.5\u00d7. One person cannot be booked past sixteen hours in a day across every home.",
      },
      {
        label: "Approve",
        detail:
          "Hours nobody has checked are a claim about what a trade is owed, not a cost. Approving needs a rate on the entry, and approved hours cannot be edited underneath their own approval.",
      },
      {
        label: "People and Trades",
        detail:
          "Who was on site and for how long, and what each trade\u2019s labour came to. A trade running a quarter of their hours as overtime is flagged.",
      },
    ],
    connects: [
      "Labour lands in the same cost codes as materials, so job costing is complete rather than materials-only.",
      "Targets come off the plan\u2019s standard hours, so two identical homes are measured against the same number rather than whatever somebody typed that week.",
      "Hours booked with no rate cost an unknown amount rather than nothing. They are kept out of the average rate, because counting them as free is what makes the rate fall every time somebody forgets one.",
    ],
  },

  "/bidding": {
    title: "Bidding",
    icon: "⚖️",
    what: "Getting trades to price the work before you commit to it.",
    who: ["Purchasing", "Admin"],
    actions: [
      {
        label: "Award",
        detail: "Raises the purchase order at the bid price, so the number cannot drift in between.",
      },
      {
        label: "Record column",
        detail:
          "Each bidder's scorecard sits beside their price. Cheapest is not cheapest if they score 40 on quality.",
      },
    ],
    connects: [
      "A trade who cannot legally hold a purchase order is flagged here, before you award rather than after.",
    ],
  },

  "/scorecard": {
    title: "Trade scorecard",
    icon: "📊",
    what: "Whether a trade is worth the next house, across six dimensions, from records the system already holds.",
    who: ["Purchasing", "Owner", "Executive"],
    actions: [
      { label: "Expand a row", detail: "Every dimension shows its score, its evidence and why." },
    ],
    connects: [
      "A dimension with no history is excluded rather than scored zero. A trade nobody has raised a punch item against has not failed quality - it has no quality record.",
      "Trades with thin evidence are marked provisional. A score built on two events is not a verdict.",
      "This exists only because the system holds both halves: schedule and money from the homebuilder side, safety and compliance from the project-controls side.",
    ],
  },

  "/warranty": {
    title: "Warranty",
    icon: "🔧",
    what: "Claims after handover, and the service orders that send a trade back to fix them.",
    who: ["Warranty", "Superintendent", "Admin"],
    connects: [
      "Homeowners raise claims themselves from their portal.",
      "Warranty work by trade feeds the scorecard, so a trade whose work keeps coming back is visible at the next award.",
    ],
  },

  "/documents": {
    title: "Documents",
    icon: "📁",
    what: "The register of what exists and where it lives.",
    who: ["Everyone internal"],
    caveat:
      "There is no object store wired up yet, so this records where a file lives rather than holding the file. Connecting storage is the first production task.",
  },

  "/accounting": {
    title: "Accounting",
    icon: "💷",
    what: "The general ledger export: what to post, from the operational records.",
    who: ["Accounting", "Owner", "Admin"],
    caveat:
      "Export only. There is no two-way sync with an accounting package yet, so payables are entered twice until one is connected.",
  },

  "/reports": {
    title: "Reports",
    icon: "📈",
    what: "Margin by home, cycle time, warranty by trade, satisfaction and campaign performance.",
    who: ["Owner", "Executive", "Admin"],
    connects: [
      "Every figure is computed from the operational tables rather than stored, so a report can never disagree with the records it summarises.",
    ],
  },

  "/schedule": {
    title: "Schedule",
    icon: "🗓️",
    what: "What is running across every house, what has stopped, and what is due. Plus the templates every home\u2019s task list is generated from.",
    who: ["Superintendent", "Owner", "Admin"],
    actions: [
      {
        label: "Clear what is behind",
        detail:
          "Tasks that should have finished and have not. The only thing on this page costing money right now, so it comes first.",
      },
      {
        label: "Book the next fortnight",
        detail:
          "Everything due in the next fourteen days, across every house. Filter by trade to see one subcontractor\u2019s week.",
      },
      {
        label: "Say why something stopped",
        detail:
          "Blocking a task records the reason on it. A schedule that cannot say why it stopped is one nobody trusts.",
      },
      {
        label: "Mark a task finished",
        detail:
          "Everything behind it moves by however late it was. That ripple is what keeps the dates true \u2014 without it the schedule goes stale and every date in the system becomes fiction.",
      },
    ],
    connects: [
      "Durations are working days. A ten-day task never lands a trade on a Saturday, and non-working days you add stretch the calendar around every task.",
      "A slip moves the home\u2019s forecast completion. The projected completion agreed at the start never moves \u2014 the gap between the two is how far behind the build is.",
      "A trade sees only their own tasks in the trade portal.",
    ],
    caveat:
      "Templates are configuration: change one and homes already scheduled keep the dates they were given, because those were agreed with trades who have them in their diaries.",
  },

  "/vendors": {
    title: "Trades",
    icon: "👷",
    what: "The subcontractors and suppliers you buy from.",
    who: ["Purchasing", "Admin"],
    connects: [
      "A trade with a portal login sees only their own purchase orders and schedule - never your budgets or margin.",
    ],
  },

  "/meetings": {
    title: "Meetings & correspondence",
    icon: "🗣️",
    what: "Agenda, minutes, and the actions that came out of them, each with an owner and a date.",
    who: ["Superintendent", "Admin", "Architect"],
    connects: [
      "Correspondence is an audit trail of what was formally said to whom - not a chat client.",
    ],
  },

  "/communities": {
    title: "Communities",
    icon: "🗺️",
    what: "The subdivisions you build in, and the lots inside them. A lot carries its own premium, because a corner plot backing onto woodland is not the same product as the one beside the bin store.",
    who: ["Sales", "Admin"],
    connects: [
      "A home is a lot plus a plan. The lot premium flows straight into the contract price.",
    ],
  },

  "/plans": {
    title: "Plans",
    icon: "📋",
    what: "The house designs you sell, with their base price and their expected cost by cost code.",
    who: ["Sales", "Purchasing", "Admin"],
    actions: [
      {
        label: "Cost lines",
        detail:
          "What this plan is expected to cost, per cost code. Stamped onto a home's budget when it sells, which is why a homebuilder needs no takeoff.",
      },
    ],
    connects: [
      "Plan cost lines become the home's opening budget. That replaces estimating a house from scratch every time.",
    ],
  },

  "/cost-codes": {
    title: "Cost codes",
    icon: "🔢",
    what: "The chart of accounts for building. Every budget line, purchase order, invoice, timecard and specification lands on one of these.",
    who: ["Purchasing", "Accounting", "Admin"],
    connects: [
      "Get these wrong and nothing else reconciles. They are the spine the whole cost system hangs on.",
    ],
  },

  "/appointments": {
    title: "Design studio",
    icon: "🪑",
    what: "The appointments where a buyer sits down and chooses their finishes.",
    who: ["Sales", "Admin"],
    actions: [
      {
        label: "Structural cut-off",
        detail:
          "The date after which structural options can no longer be changed, because the slab is poured. Recording it is what stops an expensive promise being made.",
      },
    ],
    connects: [
      "Selections confirmed in an appointment run the cascade: price, budget and schedule all move.",
    ],
  },

  "/campaigns": {
    title: "Campaigns",
    icon: "📣",
    what: "What marketing spent, and what came back. Every channel a builder uses — email, print, roadside boards, portals, events — not only the ones that send email.",
    who: ["Sales", "Owner", "Admin"],
    actions: [
      {
        label: "Read it by cost per sale",
        detail:
          "The list is ordered by what a sale cost, not by how many enquiries arrived. The loudest campaign is very often not the one to repeat, and a list sorted by volume quietly argues that it is.",
      },
      {
        label: "Record what it cost",
        detail:
          "Separately from the budget, because overspending is the thing a budget exists to make visible. Cost per lead and cost per sale are worked out from this.",
      },
      {
        label: "Attach leads",
        detail:
          "Links leads whose campaign tag matches this campaign's code. Once linked they stay linked — renaming the code no longer detaches them.",
      },
      {
        label: "Record delivery",
        detail:
          "The numbers the provider reported back. Checked against each other: more opens than sends means the figures came from somewhere they should not have.",
      },
      {
        label: "Duplicate",
        detail:
          "Most campaigns are last year's with the dates changed. The copy keeps the content and the budget and deliberately drops the results.",
      },
    ],
    connects: [
      "Leads arriving with a campaign tag are matched to the campaign by code, and from then on by a stored link rather than by comparing text.",
      "Revenue is traced lead to buyer to contract, so a campaign is judged against what it earned rather than only against what it cost.",
      "A lead that converts carries its campaign through to the sale — which is the whole reason the lead record survives conversion.",
    ],
    caveat:
      "Nothing is sent from here. A delivery provider does that and reports back; this records what was committed, what arrived, and what it cost. Channels other than email have no open rate at all — a blank is not a zero.",
  },

  "/surveys": {
    title: "Surveys",
    icon: "⭐",
    what: "What buyers say after the fact, and the NPS that comes out of it.",
    who: ["Warranty", "Sales", "Owner"],
    connects: [
      "Satisfaction is on the dashboard beside the money, because a builder with good margins and bad reviews has a problem the P&L will not show for two years.",
    ],
  },

  "/land": {
    title: "Land development",
    icon: "🌱",
    what: "The stage before there are any houses: acquiring land, running it through entitlement, and tracking the development budget.",
    who: ["Owner", "Admin", "Accounting"],
    connects: [
      "Land cost is carried separately from vertical construction cost, so a home's margin is not distorted by the ground it stands on.",
    ],
  },

  "/settings": {
    title: "Users",
    icon: "👥",
    what: "Who can log in, and what they can reach. Eleven roles, split between your own staff and the people who work with you.",
    who: ["Owner", "Admin"],
    actions: [
      {
        label: "External roles",
        detail:
          "Architect, trade and homeowner are marked External. They share your tenant but every builder-side endpoint refuses them - enforced in the API, not hidden in a menu.",
      },
      {
        label: "Executive",
        detail:
          "Reads everything, changes nothing. Refused at the moment they authenticate, so it holds on every route.",
      },
    ],
  },

  "/guide": {
    title: "Guide",
    icon: "📘",
    what: "This guide. The whole flow, the people, every screen, and the words the system uses.",
    who: ["Everyone"],
  },

  "/portal": {
    title: "Trade portal",
    icon: "🚪",
    what: "What a subcontractor sees: their own purchase orders, their week's schedule, and their service orders. Nothing else.",
    who: ["Trade"],
    connects: [
      "Trades live in the same tenant as your staff but are walled off from every money surface. This is enforced in the API, not just hidden in the menu.",
    ],
  },

  "/my-home": {
    title: "My home",
    icon: "🔑",
    what: "What a buyer sees: their home's progress, their selections, and their warranty claims.",
    who: ["Homeowner"],
  },
};

/**
 * The entry for a path or a `data-guide` key, tolerating detail routes like
 * /jobs/{id} and sub-routes like /settings/users.
 */
export function guideFor(key: string): GuideEntry | null {
  if (!key) return null;
  if (GUIDE[key]) return GUIDE[key];
  const root = "/" + key.split("/").filter(Boolean)[0];
  return GUIDE[root] ?? null;
}


/* ==========================================================================
 * Click-to-explain
 *
 * With guide mode on, clicking anything in the app explains it instead of
 * doing it. Matching is by the element's visible label rather than by an
 * attribute on every component, so the whole app is covered without 33 pages
 * having to be edited - and a new button written tomorrow is covered the
 * moment its label is added here.
 *
 * The same word means different things in different places: "Approve" on an
 * invoice releases money, on a prequalification it clears a trade to work, and
 * on a change order it moves three records at once. ROUTE_TERMS wins over
 * TERMS for exactly that reason.
 * ========================================================================== */

export interface Explanation {
  title: string;
  body: string;
  /** What happens elsewhere. Omitted where nothing does. */
  effect?: string;
  /** Shown when the action is guarded and may be refused. */
  refuses?: string;
}

/** Label -> explanation, used on every screen unless a route overrides it. */
export const TERMS: Record<string, Explanation> = {
  /* ---------------------------------------------------- generic actions */
  cancel: {
    title: "Cancel",
    body: "Closes this form without saving. Nothing you typed is kept.",
  },
  create: {
    title: "Create",
    body: "Saves the record. Most things are created as a draft, so creating rarely commits anything on its own.",
  },
  save: { title: "Save", body: "Writes your changes to the record." },
  "save changes": { title: "Save changes", body: "Writes your changes to the record." },
  close: { title: "Close", body: "Dismisses this panel. Nothing is changed." },
  edit: { title: "Edit", body: "Opens the record for changes." },
  refresh: { title: "Refresh", body: "Re-reads everything from the server now, rather than waiting for the next automatic refresh." },
  export: {
    title: "Export",
    body: "Downloads what you are looking at as a file, for a board pack or a spreadsheet.",
  },
  remove: { title: "Remove", body: "Deletes this item. There is no undo." },

  /* ------------------------------------------------------- money words */
  budget: {
    title: "Budget",
    body: "What this home is planned to cost, per cost code. It starts from the plan and moves when a selection or an approved change order lands.",
  },
  committed: {
    title: "Committed",
    body: "Money promised to a trade on an issued purchase order. A draft PO is not committed - issuing it is what commits it.",
  },
  actual: {
    title: "Actual",
    body: "What has been invoiced and approved. The gap between committed and actual is work bought but not yet billed.",
  },
  exposure: {
    title: "Exposure",
    body: "The greater of committed and actual. An invoice above its purchase order still counts against the job, so a lagging invoice can never make a home look better than it is.",
  },
  forecast: {
    title: "Forecast",
    body: "Exposure plus change orders that are raised but not yet approved. Where this home lands if everything in flight lands.",
    effect: "This is the number that lets you act. Exposure only moves once a change order is approved, which is after the decision has been made.",
  },
  pending: {
    title: "Pending change",
    body: "Cost on change orders that have been raised but not decided. Not owed today, but visible before it commits.",
  },
  retainage: {
    title: "Retainage",
    body: "A percentage held back from every payment until the scope is signed off. Typically 5-10% on trade labour, zero on materials.",
    effect: "It reduces what is paid, never what is costed. The work was done, so the cost is real; what is withheld is the payment.",
  },
  "net payable": {
    title: "Net payable",
    body: "What the trade actually gets paid on this invoice today: the total less any retainage still held.",
  },
  variance: {
    title: "Variance",
    body: "Budget less exposure. Negative means this home is over.",
  },
  remaining: {
    title: "Remaining",
    body: "Budget still left to commit on this cost code. Negative means it is already over-committed.",
  },
  margin: {
    title: "Margin",
    body: "Revenue less exposure. For a homebuilder this is mostly made on options, not on the base house.",
  },

  /* -------------------------------------------------- controls words */
  "ball in court": {
    title: "Ball in court",
    body: "Whose move it is. Builder, trade, architect, engineer or buyer - and never nobody. An item no one owns is the one that sits open until handover week.",
  },
  overdue: {
    title: "Overdue",
    body: "Past its due date and still open. These are ordered first everywhere they appear.",
  },
  blocking: {
    title: "Blocking",
    body: "Work on site has stopped until this is resolved. The most expensive state anything in this system can be in.",
  },
  provisional: {
    title: "Provisional",
    body: "Built on too little history to be a verdict. The number is shown, but do not act on it alone.",
  },
  severity: {
    title: "Severity",
    body: "Critical, high, medium or low. Critical and overdue together is what the dashboard pulses about.",
  },
  "cost code": {
    title: "Cost code",
    body: "The chart of accounts for building. Every budget line, purchase order, invoice, timecard and specification lands on one, which is what makes job costing reconcile.",
  },

  /* ------------------------------------------ consequential elsewhere */
  confirm: {
    title: "Confirm this selection",
    body: "Locks the buyer's choice in. Until it is confirmed it is only a preference.",
    effect:
      "This is the cascade, and it is the single most important action in the system. Confirming moves three records in one transaction: the contract price, the budget for the relevant cost codes, and the schedule. The price and cost are snapshotted here, so changing the option catalogue tomorrow never restates this contract.",
  },
  "generate budget": {
    title: "Generate the budget",
    body: "Stamps the plan's expected cost onto this home, per cost code.",
    effect:
      "This is why a homebuilder needs no takeoff: the plan already knows what it costs, so a house is budgeted the moment it is sold.",
  },
  generate: {
    title: "Generate",
    body: "Builds this home's records from a template rather than from scratch. Production building repeats, which is what makes templates the right shape.",
  },
  void: {
    title: "Void",
    body: "Cancels this record without deleting it.",
    effect:
      "A voided purchase order stops counting as committed cost, so the budget frees up again. The record stays, because what was promised and withdrawn is part of the history.",
  },
  reverse: {
    title: "Reverse",
    body: "Undoes an approved change by raising an opposite one, rather than editing history.",
    effect:
      "Money records are never edited after approval. Something that moved is unmoved by a second, visible movement.",
  },
  acknowledge: {
    title: "Acknowledge",
    body: "Records that the trade has seen and accepted this.",
    effect: "Acknowledgement is the proof. Without it, being sent something is only your word.",
  },
  "sell this home": {
    title: "Sell this home",
    body: "Attaches a buyer and a contract to the lot and plan, moving it from planned to sold.",
    effect: "From here on, selections and change orders move a real contract price.",
  },
  "start a home": {
    title: "Start a home",
    body: "Creates the record everything else hangs off: a lot plus a plan.",
  },
  "convert to buyer": {
    title: "Convert to buyer",
    body: "Turns a lead into the buyer record that a contract can be written against.",
  },
  "mark signed": {
    title: "Mark as signed",
    body: "Records that the document came back executed.",
    refuses:
      "This records a signature that happened elsewhere; it is not itself a signature. No e-signature provider is connected yet, so this is a bookkeeping entry until one is.",
  },
  "request signature": {
    title: "Request a signature",
    body: "Creates a signature request against a document.",
    refuses: "Nothing is actually sent yet - no e-signature provider is connected.",
  },
  "download gl batch": {
    title: "Download the GL batch",
    body: "Exports what to post to your accounting package, as CSV.",
    refuses:
      "Export only. There is no two-way sync yet, so payables are entered twice until an accounting integration is connected.",
  },
  "clear filters": {
    title: "Clear the filters",
    body: "Returns the list to showing everything.",
  },
  "sign out": { title: "Sign out", body: "Ends your session on this browser." },
  "edit profile": {
    title: "Edit your profile",
    body: "Your name, job title, phone and photo. Everyone can edit their own.",
  },
  "change password": { title: "Change your password", body: "Requires your current one." },
  "n/a": {
    title: "Not applicable",
    body: "This check does not apply to this home. Recorded as considered rather than left blank, so a gap in the checklist always means someone has not looked yet.",
  },
  "vendor master": {
    title: "Vendor master",
    body: "Exports the trade list for your accounting package, so the two systems agree on who is who.",
  },

  /* --------------------------------------------- bare verbs and the rest */
  add: { title: "Add", body: "Adds a row to the record you are looking at." },
  log: {
    title: "Log",
    body: "Writes this down against the record. Field notes are worth keeping precisely because nobody remembers which Tuesday it rained.",
  },
  raise: {
    title: "Raise",
    body: "Opens the item and puts it in somebody's court. Raising starts a clock; it does not decide anything.",
  },
  record: { title: "Record", body: "Writes this down against the record." },
  send: { title: "Send", body: "Sends this to its recipients and records that it went." },
  register: {
    title: "Register",
    body: "Adds it to the register - a record of what exists and where it lives.",
  },
  schedule: {
    title: "Schedule",
    body: "Books it for a date. Scheduling something does not complete it; there is a separate action for that.",
  },
  "book appointment": {
    title: "Book a design appointment",
    body: "Books the session where the buyer chooses their finishes.",
    effect:
      "Record the structural cut-off date. It is the point after which structural options cannot change because the slab is poured, and writing it down is what stops an expensive promise being made.",
  },
  "capture lead": {
    title: "Capture a lead",
    body: "Records an enquiry at the top of the funnel, with where it came from.",
    effect:
      "The source follows the lead all the way to a signed contract, which is how you find out which marketing spend produces sales rather than enquiries.",
  },
  "submit a warranty claim": {
    title: "Submit a warranty claim",
    body: "Raises a defect after handover. Homeowners do this themselves from their portal.",
    effect:
      "A claim becomes a service order sent to the responsible trade, and warranty work by trade feeds the scorecard.",
  },
  "service orders": {
    title: "Service orders",
    body: "The work sent back to a trade to put a warranty claim right.",
  },
  "mark held": {
    title: "Mark as held",
    body: "Records that the meeting happened, which turns the agenda into minutes and its action items into things people owe.",
  },
  "enter response": {
    title: "Enter the response",
    body: "Records what the buyer said, so satisfaction is measured rather than assumed.",
  },
  "all reports as json": {
    title: "Download everything",
    body: "Every report in one JSON file, for a spreadsheet or another system.",
  },
  "register a document": {
    title: "Register a document",
    body: "Records that a document exists and where it is kept.",
    refuses:
      "This records the location, not the file. No object store is connected yet, so nothing is actually uploaded - that is the first production task.",
  },
  all: { title: "All", body: "Clears this filter so the list shows everything." },
};

/** Route-scoped meanings. Checked before TERMS. */
export const ROUTE_TERMS: Record<string, Record<string, Explanation>> = {
  "/schedule": {
    "trade is on site": {
      title: "Start the task",
      body: "Records that the trade turned up. Kept separate from finishing, because the gap between the two is the only honest way to know a task is running long before it finishes late.",
    },
    "mark it finished": {
      title: "Finish the task",
      body: "Records the actual finish date.",
      effect:
        "Everything behind it in the sequence moves by however late it was, and the home\u2019s forecast completion moves with it. The date agreed at the start does not move.",
      refuses:
        "Refused for a future date, and refused if the finish is before the task started.",
    },
    "it has stopped": {
      title: "Block the task",
      body: "Records that the trade cannot start, and why \u2014 a waterlogged plot, materials that have not landed.",
      effect:
        "It stays in the count of work on site, because a stopped task is still occupying a slot in the programme.",
    },
    "move the dates": {
      title: "Move the task",
      body: "Sets a new start, and by default moves everything behind it too.",
      effect:
        "Leaving the cascade off books the next trade for a day the site will not be ready, which is how a schedule loses people\u2019s trust.",
    },
    "not needed here": {
      title: "Skip the task",
      body: "This house does not need this step. Distinct from completing it: a skipped task did not happen, and counting it as done would report work nobody did.",
    },
    "new template": {
      title: "New schedule template",
      body: "The standard build sequence, configured once. Every home generates its own task list from one.",
      effect:
        "Offsets and durations are working days, so the calendar stretches around weekends rather than booking a trade onto one.",
    },
    "non-working days": {
      title: "Days we do not work",
      body: "Weekends are already excluded everywhere. These are the extra ones \u2014 bank holidays, the Christmas shutdown.",
      effect:
        "Schedules generated afterwards stretch around them. Ones already generated keep their dates, because trades have those in their diaries.",
    },
    duplicate: {
      title: "Duplicate the template",
      body: "Copies every step. A second house type is usually the first with three steps changed, and retyping forty tasks is how a template ends up wrong.",
    },
  },

  "/campaigns": {
    "new campaign": {
      title: "New campaign",
      body: "Anything marketing spends money on: an email, a press ad, roadside boards, a portal listing, an open weekend.",
      effect:
        "The code is what inbound leads get tagged with, so it is worth agreeing before the campaign goes out rather than afterwards.",
    },
    "record what it cost": {
      title: "What it cost",
      body: "The actual spend, as opposed to the budget. Cost per lead and cost per sale are worked out from this, and both are blank until it is filled in.",
    },
    "attach leads": {
      title: "Attach leads with this code",
      body: "Links every lead whose campaign tag matches this campaign's code, and stores the link.",
      effect:
        "Attribution used to be that comparison done live in the report, so renaming a code silently detached every lead. Once attached they stay attached.",
    },
    "record delivery": {
      title: "Delivery numbers",
      body: "What the provider reported: sends, opens, clicks, bounces.",
      refuses:
        "Refused when the numbers contradict each other — more opens than sends, or more clicks than opens. A wrong open rate on a report nobody questions is worse than an error now. Also refused on channels that have no delivery numbers at all.",
    },
    duplicate: {
      title: "Duplicate this campaign",
      body: "Copies the content, the channel and the budget into a fresh draft.",
      effect:
        "The results stay with the original. Carrying last year's opens and leads onto this year's campaign would be the most misleading possible default.",
    },
    "hand to the provider": {
      title: "Launch it",
      body: "Marks it as out: handed to the delivery provider, or the sign is up.",
      refuses:
        "An email is refused without a subject line — one arriving with an empty subject is worse than one that does not arrive.",
    },
    "cancel it": {
      title: "Cancel the campaign",
      body: "Stops it, with a reason. Money was committed against it and somebody will ask what happened.",
    },
  },

  "/leads/sources": {
    "add a channel": {
      title: "Add a lead source",
      body: "Registers a channel and issues its key. You are given the URL to post enquiries to and a key to send with them.",
      effect:
        "The key is shown once and stored only as a hash. If it is lost it must be rotated, which immediately stops the old one working.",
    },
    replay: {
      title: "Replay this payload",
      body: "Runs a stored enquiry through the reader again, after you have corrected the field map. This is why the raw payload is kept.",
      refuses:
        "Refused if it still cannot be read - the reason is updated and the payload stays on the queue rather than being consumed by the attempt.",
    },
    "view payload": {
      title: "See what actually arrived",
      body: "The untouched body of the request. Compare its field names with what the channel is configured to expect.",
    },
    "new key": {
      title: "Rotate the key",
      body: "Issues a replacement and invalidates the current one immediately. No grace period: a key is rotated because it leaked, and a window where the old one still works is the thing being closed.",
      effect: "Whatever is using the old key stops sending until it is updated.",
    },
    pause: {
      title: "Pause this channel",
      body: "Stops accepting from it without losing the key, the settings or the history. Nothing new is captured until it is resumed.",
    },
  },

  "/leads": {
    "capture lead": {
      title: "Capture a lead",
      body: "Records an enquiry. Only the name is required - a walk-in who gives nothing else is still worth having, and a form that refuses them loses the lead altogether.",
      effect:
        "While you type an email or phone number it checks for an existing lead with the same details and warns you. It never blocks: the same family asking about two plans is not a duplicate.",
    },
    claim: {
      title: "Claim this lead",
      body: "Puts your name on it. One click, because picking up an unowned lead is the commonest thing anybody does on this page.",
    },
    "assign to…": {
      title: "Assign the selected leads",
      body: "Hands a batch to one person. Leads that have already converted or been lost are skipped, and you are told which - a bulk action that reports only success is lying the moment one row was skipped.",
    },
    "log a call or visit": {
      title: "Log a touch",
      body: "Records what happened and when. It also moves the lead on: a real contact on a new lead makes it contacted, and an outcome of 'booked' makes it an appointment.",
      effect:
        "Updates 'last contacted', which is what the days-since-contact figure counts from. A note to yourself deliberately does not count as contact.",
    },
    "schedule follow-up": {
      title: "Schedule a follow-up",
      body: "Sets the date this lead is next to be chased. Anything past its date appears in the Needs chasing queue.",
      refuses: "Refused on a converted or lost lead - there is nothing left to chase.",
    },
    qualify: {
      title: "Qualify this lead",
      body: "Records that somebody has checked they can actually pay. This step cannot be skipped on the way to becoming a buyer, because a job started for a buyer who never completes is the most expensive mistake on this screen.",
    },
    "convert to buyer": {
      title: "Convert to a buyer",
      body: "Creates the buyer record a contract is written against, and keeps the link back to this lead so the sale can be traced to its source.",
      refuses:
        "Refused before qualification, and refused when the lead has no email or phone - a buyer will be sent selection deadlines and payment requests.",
    },
    "mark lost…": {
      title: "Mark this lead lost",
      body: "Closes the lead with the reason it was lost and, if you know it, which builder won it.",
      effect: "Clears the follow-up date, so it drops out of the chasing queue.",
    },
    reopen: {
      title: "Reopen this lead",
      body: "They came back. Returns to contacted rather than new - somebody has already spoken to them, and the untouched queue should not pretend otherwise.",
    },
    agents: {
      title: "Referring agents",
      body: "The estate agents who send you business, with what each has actually delivered. Ranked by buyers rather than enquiries: three buyers beats thirty browsers.",
      effect: "Commission is held per agent, because it is negotiated per agent.",
    },
    archive: {
      title: "Archive this lead",
      body: "For junk - the bot submissions and the wrong numbers. It stops appearing in the list without being destroyed.",
      refuses: "Refused on a converted lead: that record is the only trace of where a real buyer came from.",
    },
  },

  "/invoices": {
    approve: {
      title: "Approve this invoice",
      body: "Accepts the bill for payment. This is what turns committed cost into actual cost.",
      refuses:
        "Refused when the invoice exceeds the purchase order it is matched to. A vendor billing above their PO is the single most common way margin leaks out of a job. You can override it, and the override is recorded.",
    },
    pay: {
      title: "Mark as paid",
      body: "Records that the money has gone out.",
      refuses: "Refused without a lien waiver on file - that document is what protects your title at closing.",
    },
    "release retainage": {
      title: "Release retainage",
      body: "Hands over the money that was held back on this invoice.",
      refuses:
        "Refused without a lien waiver on file. Retainage is the leverage for getting one, so releasing it first throws away the only reason it was held.",
    },
    "receive invoice": {
      title: "Receive an invoice",
      body: "Records a bill against a purchase order. Job and trade are taken from the PO, because an unmatched invoice is the classic leak.",
    },
  },

  "/compliance": {
    approve: {
      title: "Approve this trade",
      body: "Clears them for work. Purchase orders to them will now issue.",
      refuses: "Refused while any document on file has already lapsed.",
    },
    reject: {
      title: "Reject this trade",
      body: "Blocks them. Every purchase order to them is refused until this changes.",
    },
    check: {
      title: "Run the check",
      body: "Runs the exact test the purchase-order gate runs, without issuing anything. Use it before you promise a trade work.",
    },
    "prequalify a trade": {
      title: "Prequalify a trade",
      body: "Starts a compliance record: their limits, their review date, and the certificates you need from them.",
    },
    "add doc": {
      title: "Add a document",
      body: "Records a certificate and when it expires. The expiry is what the gate and the chase list both read.",
    },
  },

  "/purchase-orders": {
    issue: {
      title: "Issue this purchase order",
      body: "Sends it to the trade and commits the money. A draft commits nothing.",
      refuses:
        "Two gates run: is it over budget, and is the trade cleared to work. Both refuse by default, both can be overridden, and both overrides are recorded rather than hidden.",
    },
  },

  "/rfis": {
    answer: {
      title: "Answer this RFI",
      body: "Records the decision and stops the clock. Say whether it costs money or time - those two flags are what the rest of the system reads.",
    },
    "raise co": {
      title: "Raise a change order from this RFI",
      body: "Turns a costly answer into a priced change against a named party, quoting the RFI as the reason.",
      effect:
        "The schedule impact carries across automatically. Approve it and the buyer's contract moves. Leave it pending and it shows in the forecast.",
    },
    close: {
      title: "Close this RFI",
      body: "Marks the question settled. Only an answered RFI can be closed.",
    },
  },

  "/submittals": {
    review: {
      title: "Review this submittal",
      body: "Approve, approve as noted, revise and resubmit, or reject.",
      effect:
        "Revise-and-resubmit bumps the revision number rather than overwriting, so the history of what was proposed survives.",
    },
  },

  "/drawings": {
    issue: {
      title: "Issue this drawing set",
      body: "Releases it to trades. This is now what they should be building from.",
    },
    revise: {
      title: "Revise this set",
      body: "Creates the next revision and marks this one superseded - kept, not deleted.",
      effect:
        "A superseded set is the evidence of what a trade priced and built from. Overwriting it destroys your defence in a dispute.",
    },
    "record receipt": {
      title: "Record acknowledgement",
      body: "Logs that this trade confirmed they received the transmittal.",
      effect:
        'Without this, "we sent you the revised drawings" is one party\'s word against another\'s.',
    },
  },

  "/field": {
    pass: { title: "Pass this check", body: "Records that this item met the requirement." },
    fail: {
      title: "Fail this check",
      body: "Records what is wrong. A note is required - it is what the trade gets sent back to fix.",
      effect:
        "Failed checks become the inspection's failure reason, and can be turned into punch items in one action once the result is recorded.",
    },
    "add a defect": {
      title: "Add a defect",
      body: "Something wrong on a finished house. Severity decides whether it stops the handover - cosmetic does not, everything above it does - so it is the one field worth thinking about.",
      effect:
        "Marking it as raised by the buyer at the walkthrough scores worse against the trade than one your own QA caught - the buyer finding it is a different failure from you finding it.",
    },
    "give it to a trade": {
      title: "Assign it",
      body: "Puts the ball in their court against a date.",
      effect:
        "Assigning it is what lets the work be backcharged rather than absorbed. A defect nobody owns is the kind that sits open until handover week.",
    },
    "trade says it is done": {
      title: "Ready for review",
      body: "The trade claims the fix is made. A claim, not a conclusion - it moves the ball back to you rather than closing anything.",
    },
    "sign it off": {
      title: "Sign the fix off",
      body: "Records that somebody looked at the fix and accepted it. This is the only way a defect reaches closed.",
      effect:
        "Until somebody does, the defect still counts against the handover, however confident the trade was.",
    },
    "send it back": {
      title: "Reject the fix",
      body: "The fix was inspected and is not right. A reason is required: the trade has to know what is still wrong, and you will want the record when the same defect is argued about at handover.",
    },
    "not fixing it": {
      title: "Won't fix",
      body: "Records deliberately that this one is not being put right, with the reason on the record - it is the item a buyer will ask about.",
      refuses:
        "Refused on anything marked blocking. A life-safety defect cannot be declined; downgrade its severity deliberately if the severity is what is wrong.",
    },
    "reopen it": {
      title: "Reopen the defect",
      body: "Puts a declined item back on the list, usually because the buyer raised it again.",
    },
    "book an inspection": {
      title: "Book an inspection",
      body: "Municipal, third party, internal QA or walkthrough. The kind matters: a failed municipal inspection is a legal stop, not just bad news.",
    },
    "record the result": {
      title: "Record how it went",
      body: "The overall verdict, plus the fee if it failed.",
      effect:
        "Recording the verdict alone tells you the house failed. Recording the individual checks tells you what to send the framer back for.",
    },
    "edit details": {
      title: "Correct the defect",
      body: "The description, where it is, when it is due, and how much it matters.",
      effect:
        "The way out of the won\u2019t-fix refusal: a blocking defect cannot be declined, so if blocking was the wrong call, the severity is what changes - deliberately, and here.",
    },
    reassign: {
      title: "Give it to a different trade",
      body: "For when it turns out to be somebody else\u2019s work. The ball moves with it.",
    },
    checklist: {
      title: "The inspection\u2019s checks",
      body: "Each item, whose work it is, and whether it passed. Failing one needs a note saying what is wrong.",
      effect:
        "The checklist is fixed once the inspection has been carried out, because it is the record of what was looked at on the day.",
    },
    "make a punch list from the failures": {
      title: "Generate the punch list",
      body: "One defect per failed check, against the trade whose check it was, tracing back to the check itself.",
      effect:
        "A municipal failure makes them blocking, because that inspection is a legal stop rather than an opinion. Anything else makes them major. Running it twice adds nothing, so it is safe after a partial re-check.",
      refuses: "Refused if nothing on the inspection is marked failed.",
    },
    "book a re-inspection": {
      title: "Book the retry",
      body: "A new inspection that points back at the one it is retrying, with its own fee.",
      effect:
        "That link is what lets \u201chow many attempts did this take\u201d be asked, which is how you find whose work is costing you re-inspection fees.",
    },
    "blocking handover": {
      title: "Defects stopping the keys",
      body: "Every unresolved defect on the home that is not merely cosmetic.",
      effect:
        "Not advisory. Handing the home over is refused while this is above zero, and the refusal names them.",
    },
    "awaiting sign-off": {
      title: "Fixes claimed but not checked",
      body: "The trade says these are done. Until somebody looks, they still count against the handover.",
    },
    "failed inspections": {
      title: "Inspections that did not pass",
      body: "Each needs either a punch list generated from its failures or a re-inspection booked, usually both.",
    },
    cosmetic: {
      title: "Cosmetic",
      body: "The only severity that does not stop a handover. A buyer will take the house and a decorator comes back.",
    },
    minor: {
      title: "Minor",
      body: "Wants fixing, and stops the handover until it is signed off. Cosmetic is the only severity that does not.",
    },
    major: {
      title: "Major",
      body: "Stops the handover. Handing over with one of these still on the list is how a warranty claim becomes a dispute - the buyer has the list too.",
    },
    blocking: {
      title: "Blocking",
      body: "Life-safety or habitability. Stops the handover and cannot be declined at all.",
      effect:
        "Marking something blocking removes the option to decide not to fix it. Downgrading the severity is the deliberate step that puts it back.",
    },
  },

  "/safety": {
    "raise an observation": {
      title: "Raise an observation",
      body: "Something seen on site that somebody now owes a fix for. It has an owner and a date, which is what makes it different from a note.",
      effect:
        "No date given, it takes one from the severity: a day for critical, three for high, a week for medium, a fortnight for low. A critical safety observation with a fortnight on it is a note with a date attached.",
    },
    "give it to a trade": {
      title: "Assign it",
      body: "Puts it in a trade\u2019s court against a date. An observation nobody owns is the one still open at handover.",
    },
    "the fix is made": {
      title: "Send it for review",
      body: "A claim, not a conclusion. It moves to ready-for-review rather than closing.",
      effect:
        "What was done is asked here rather than at closing, because the person who did the work knows what they did. Asking the reviewer produces \u201cfixed\u201d.",
    },
    "accept the fix": {
      title: "Close the observation",
      body: "Records that somebody has looked at the fix and accepted it. The only route to closed.",
      refuses:
        "Refused straight from initiated. Closing on the word of whoever owed the work records an intention, not an outcome.",
    },
    "not accepted": {
      title: "Not accepted",
      body: "The fix was inspected and failed. Sends it back to the trade with a reason rather than letting it quietly close.",
      effect:
        "The state the system always had and nothing could reach. Without it a bad fix either closes or sits in review forever, and neither tells anybody to come back.",
    },
    "reopen it": {
      title: "Reopen the observation",
      body: "Puts a closed observation back on the list, with what changed on the record.",
      effect:
        "It goes back to the start rather than to review, so the second round is a full round rather than a shortcut to closed.",
    },
    "report an incident": {
      title: "Report an incident",
      body: "An injury, illness, near miss, damage or environmental event. Near misses count: they are the cheapest data there is about what is about to go wrong.",
      effect:
        "A RIDDOR category is suggested as you fill the form in, so you can see what it is about to decide and overrule it.",
    },
    "riddor category": {
      title: "RIDDOR category",
      body: "What the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations say about this incident. A specified injury, an over-seven-day incapacity, a dangerous occurrence, an occupational disease, a fatality \u2014 or none of them.",
      effect:
        "The category sets the deadline: ten days for most, fifteen for an over-seven-day incapacity because the seven have to elapse first. Fatalities, specified injuries and dangerous occurrences must also be telephoned through without delay, before the written report.",
    },
    "record the hse report": {
      title: "Record the HSE report",
      body: "That the report has actually gone in, on what date, with the reference the HSE gives back.",
      refuses:
        "Refused on an incident categorised as not reportable, and refused with a date before the incident happened. Recording a report against something that never needed one makes the reportable count wrong in the direction nobody checks.",
    },
    "record the cause": {
      title: "Root cause",
      body: "What actually caused it, as opposed to what happened.",
      effect:
        "Required before the investigation can close. An incident with no cause recorded cannot be prevented, which is the only reason to keep the record.",
    },
    "close the investigation": {
      title: "Close the investigation",
      body: "Records that the incident has been dealt with.",
      refuses:
        "Refused while a reportable incident has not been reported to the HSE, and refused with no root cause. Closing it unreported would file the obligation as met.",
    },
    "awaiting an hse report": {
      title: "Awaiting an HSE report",
      body: "Reportable incidents nobody has told the HSE about yet, with the days left on each.",
      effect:
        "The duty does not lapse because the deadline passed. A late report is still a report; no report is an offence.",
    },
    "new plan or template": {
      title: "Action plans",
      body: "The sequences a builder runs the same way on every home: a pre-pour checklist, a pre-drywall walk, a handover sequence.",
      effect:
        "A template belongs to no home. Start it against each home that needs it, and its steps are copied across.",
    },
    "start on a home": {
      title: "Start a template",
      body: "Copies the template\u2019s steps onto the home and starts the plan.",
      effect:
        "Copied, not referenced. A template edited next month must not rewrite the checklist somebody signed last month.",
      refuses: "Refused on a template with no steps \u2014 an empty checklist on a home reads as complete.",
    },
    "mark done": {
      title: "Complete a step",
      body: "These run in order, so it has to be the step the plan is waiting on.",
      refuses:
        "Refused out of order. A pre-pour checklist that lets the pour be signed off before the rebar check is a form, not a checklist.",
    },
    "witness it": {
      title: "Witness a step",
      body: "Signs off a step somebody else completed.",
      refuses:
        "Refused if you completed it yourself. The point of a sign-off step is a second pair of eyes, and the plan does not count as complete while one is outstanding.",
    },
  },

  "/bidding": {
    award: {
      title: "Award this bid",
      body: "Raises the purchase order at the bid price, so the number cannot drift between agreeing it and ordering it.",
      effect: "Check the Record column first. Cheapest is not cheapest if they score 40 on quality.",
    },
    invite: { title: "Invite a trade", body: "Adds them to this package so they can price it." },
    "revise drawings": {
      title: "Revise the drawings",
      body: "Bumps the package revision. Any bid priced against the old revision is marked stale, because it priced different work.",
    },
  },

  "/jobs": {
    "start a home": {
      title: "Start a home",
      body: "Puts a house on a plot. It begins as Planned — selling it, permitting it and putting it on site are each their own step.",
      refuses:
        "Refused if the plot already has a live home on it. A cancelled one does not count: freeing the plot is the whole reason cancelling exists.",
    },
    "start the build": {
      title: "Break ground",
      body: "Records the day work actually began, and freezes the projected completion. That frozen date is the baseline everything late is measured against.",
      refuses:
        "Refused on a home that has not been sold unless you tick the box. Building on spec is a real strategy with real risk — the tick is the difference between choosing it and clicking it.",
    },
    "put on hold": {
      title: "Stop the build",
      body: "Records that work has halted, and why. The reason comes from a fixed list so days lost can be counted per cause.",
      effect:
        "The home stays in the On site count — a stopped build still occupies a plot, a superintendent and a budget.",
    },
    "resume the build": {
      title: "Back on site",
      body: "Lifts the hold and banks the days it cost, so a home stopped three times carries the total rather than only the last one.",
    },
    "mark complete": {
      title: "The house is built",
      body: "Sets the completion date and the cycle time. Not the same as handed over — between here and closing sit the final inspection, the snagging list and the money.",
      refuses:
        "Refused before the start date, and refused on a home that never started. One negative cycle time poisons every average built on it.",
    },
    "send back to site": {
      title: "Reopen the build",
      body: "For when a final inspection fails or snagging turns out to be real work.",
      effect:
        "Clears the completion date. A home that went back on site was not finished, and leaving the date would report a cycle time that never happened.",
    },
    "hand over": {
      title: "Close the home",
      body: "Title transfers to the buyer and the warranty clock starts, counted from handover rather than from completion.",
      refuses:
        "Refused without a signed contract and a completed house. Those two are a legal problem, not a data problem.",
    },
    "apply for a permit": {
      title: "Permit application",
      body: "Records that the application has gone in and starts the clock, so the wait shows on the list.",
    },
    "permit issued": {
      title: "Permit granted",
      body: "Records the permit number and the date.",
      effect:
        "Deliberately does not start the build. A permit in hand is not work having begun, and conflating them is how a start date becomes fiction.",
    },
    "cancel this home": {
      title: "Cancel the home",
      body: "Abandons the build and returns the plot to available, so another house can be started on it.",
      refuses:
        "Refused once the home has been handed over — by then it belongs to somebody else. Everything before that can be cancelled, including a half-built house.",
    },
    approve: {
      title: "Approve this change order",
      body: "Cascades it: contract, budget and schedule all move together.",
      effect:
        "Who pays decides what moves. Buyer means price and budget both rise. Builder means the budget rises and you absorb it. Trade means neither moves - it is backcharged.",
      refuses: "This cannot be undone except by a reversing change order.",
    },
    reject: {
      title: "Reject this change order",
      body: "Nothing moves. It is kept as a record of what was asked for and turned down, and it drops out of the forecast.",
    },
  },

  "/labour": {
    "record time": {
      title: "Book hours",
      body: "Against a home and a cost code. The cost code is what puts the hours into the job cost beside the materials.",
      effect:
        "Leave the rate blank and the trade\u2019s standard rate is used. Retyping it on every entry is how an average rate drifts without anybody deciding it should.",
      refuses:
        "Refused for a day that has not happened, and refused if it would put one person past sixteen hours that day across every home \u2014 above that it is nearly always the same shift typed twice into two different houses.",
    },
    "set targets": {
      title: "Hours this home should take",
      body: "The number each cost code is measured against. It is the whole point of the screen: what was spent is the half you already knew.",
      effect:
        "Leaving one blank clears it, which is not the same as nought. No target means the row reports actuals with no variance; nought would claim the work should take no time at all.",
      refuses:
        "Refused for a cost code the home\u2019s budget has no line for. A target outside the budget sits outside the document the money argument is had over.",
    },
    approve: {
      title: "Approve the hours",
      body: "Signs off that the hours were worked. Until somebody does, they are a claim about what a trade is owed rather than a cost.",
      refuses:
        "Refused on an entry with no rate. Approving it would turn unknown money into nought money, and the nought is the one that reaches the job cost.",
    },
    "withdraw the approval": {
      title: "Withdraw the approval",
      body: "Puts the entry back to pending so it can be corrected.",
      effect:
        "Approved hours cannot be edited or deleted underneath their own approval \u2014 somebody signed them off, and changing them afterwards makes the signature a record of something that no longer exists.",
    },
    "awaiting approval": {
      title: "Hours nobody has checked",
      body: "Booked but not signed off. They count in the hours and are shown apart from the cost.",
    },
    "against target": {
      title: "Hours against the target",
      body: "Booked hours minus what this home was supposed to take. Positive is over.",
      effect:
        "Only for one home. Adding targets up across homes at different stages would give a company labour budget that nobody set.",
    },
    "average rate": {
      title: "Average rate",
      body: "The labour cost divided by the hours that actually have a rate.",
      effect:
        "Not by all the hours. Dividing by all of them reports a lower rate every time somebody forgets to enter one, and the number that moves is the one people quote.",
    },
    "no rate": {
      title: "Booked with no rate",
      body: "The hours are real; what they cost is unknown, not nought.",
      effect:
        "They are kept out of the average rate and cannot be approved. Giving the trade a standard rate fills them in by itself.",
    },
    overtime: {
      title: "Overtime",
      body: "Charged at one and a half times the rate.",
      effect:
        "A trade running a quarter of their hours as overtime is flagged on the Trades tab. They are either short-handed or billing you for being, and both are worth a conversation before the next house.",
    },
    "on 2 trades": {
      title: "Booked against more than one trade",
      body: "The same name has hours against two different trades.",
      effect:
        "Usually two different people with the same name rather than one person moving between firms. It is flagged rather than guessed, because guessing puts one person\u2019s hours on the wrong trade\u2019s scorecard.",
    },
  },

  "/scorecard": {
    detail: {
      title: "Open the detail",
      body: "Every dimension, its score, how much evidence it rests on, and why.",
      effect:
        "A dimension with no history is excluded from the composite rather than scored zero. A trade nobody has raised a punch item against has not failed quality - it has no quality record.",
    },
  },
};

/**
 * Families of buttons share a shape - "New bid package", "Add sheet", "Record
 * time" - so they are answered by prefix rather than by listing every one. An
 * exact entry always wins; these only catch what would otherwise fall through.
 */
const PREFIXES: [RegExp, (rest: string) => Explanation][] = [
  [
    /^new (.+)$/,
    (rest) => ({
      title: `New ${rest}`,
      body: `Creates a ${rest}. Most records here are created as a draft, so this commits nothing on its own - there is usually a separate action that does.`,
    }),
  ],
  [
    /^add (.+)$/,
    (rest) => ({
      title: `Add ${rest}`,
      body: `Adds a ${rest} to the record you are looking at.`,
    }),
  ],
  [
    /^record (.+)$/,
    (rest) => ({
      title: `Record ${rest}`,
      body: `Writes down ${rest} against this record. Recording is how this system keeps evidence: it is the written note that makes a decision defensible later.`,
    }),
  ],
  [
    /^raise (.+)$/,
    (rest) => ({
      title: `Raise ${rest}`,
      body: `Opens a ${rest}. Raising it starts a clock and puts it in somebody's court; it does not decide anything yet.`,
    }),
  ],
  [
    /^log (.+)$/,
    (rest) => ({
      title: `Log ${rest}`,
      body: `Records ${rest}. Field records are worth keeping precisely because nobody remembers which Tuesday it rained.`,
    }),
  ],
  [
    /^send (.+)$/,
    (rest) => ({
      title: `Send ${rest}`,
      body: `Sends ${rest}.`,
    }),
  ],
  [
    /^my (.+)$/,
    (rest) => ({
      title: `My ${rest}`,
      body: `Your own ${rest}, and nobody else's. External accounts only ever see their own records - enforced by the API, not just hidden in the menu.`,
    }),
  ],
];

/** The explanation for a label on a route, if there is one. */
export function explain(pathname: string, label: string): Explanation | null {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.…]+$/, "")
    .replace(/\s*\(\d+\)$/, "");   // drop a trailing count, e.g. "Overdue (3)"
  if (!key) return null;

  const root = "/" + pathname.split("/").filter(Boolean)[0];
  const exact =
    ROUTE_TERMS[pathname]?.[key] ?? ROUTE_TERMS[root]?.[key] ?? TERMS[key] ?? null;
  if (exact) return exact;

  for (const [pattern, build] of PREFIXES) {
    const m = key.match(pattern);
    if (m) return build(m[1]);
  }
  return null;
}
