export type UserRole =
  // internal - the builder's own staff
  | "owner"
  | "admin"
  | "executive"
  | "sales"
  | "purchasing"
  | "accounting"
  | "superintendent"
  | "warranty"
  // external - they work with the builder, not for them
  | "architect"
  | "trade"
  | "homeowner";

export const STAFF_ROLES: UserRole[] = [
  "owner",
  "admin",
  "sales",
  "purchasing",
  "superintendent",
];

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  /** Path under the API origin, e.g. /uploads/avatars/xxx.jpg */
  avatar_url: string | null;
  job_title: string | null;
  phone: string | null;
  last_login_at?: string | null;
  /** Works with the builder, not for them: never sees money. */
  is_external?: boolean;
}

export interface UserSummary {
  total: number;
  active: number;
  inactive: number;
  external: number;
  owners: number;
  by_role: Record<string, number>;
  never_signed_in: number;
  /** Active, but not signed in for 90 days: likely leavers. */
  dormant: number;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface RegisterPayload {
  company_name: string;
  full_name: string;
  email: string;
  password: string;
}

/* ---------------------------------------------------------------- catalog */

export type CostType = "labour" | "materials" | "subcontract" | "plant" | "preliminaries" | "fees" | "other";

export interface CostCode {
  id: string;
  code: string;
  name: string;
  division: string | null;
  is_active: boolean;
  /** Nominal code in the accounting package. */
  gl_account?: string | null;
  cost_type?: CostType | null;
  is_archived?: boolean;
  archive_reason?: string | null;
}

export interface CostCodeStats {
  budget_original: string;
  budget_revised: string;
  committed: string;
  actual: string;
  /** Revised budget less the larger of committed and actual. */
  remaining: string;
  homes: number;
  plans: number;
  options: number;
  trades: number;
}

export interface CostCodeSummary {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  unmapped: number;
  unused: number;
  over_budget: number;
  by_division: Record<string, number>;
  by_type: Record<string, number>;
}

export type VendorType = "trade" | "supplier" | "both";

export interface Vendor {
  id: string;
  code: string;
  name: string;
  vendor_type: VendorType;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  /** HMRC Construction Industry Scheme status. Null means nobody has verified it yet. */
  cis_status: CISStatus | null;
  utr: string | null;
  is_archived?: boolean;
  archive_reason?: string | null;
  labour_rate?: string | null;
  address?: string | null;
  postcode?: string | null;
  /** Companies House registration. A sole trader has none. */
  company_number?: string | null;
  vat_number?: string | null;
  website?: string | null;
  /** Agreed terms; sets this trade's invoice due dates. Null = the standard 30 days. */
  payment_terms_days?: number | null;
  notes?: string | null;
}

export interface TradeRow extends Vendor {
  specialism_ids: string[];
  /** Null for a supplier: the compliance gate does not apply. */
  compliant: boolean | null;
  compliance_note: string | null;
  open_commitment: string;
  outstanding: string;
  overdue: number;
  contacts: number;
}

export interface TradesSummary {
  active: number;
  archived: number;
  trades: number;
  suppliers: number;
  not_compliant: number;
  cis_unverified: number;
  open_commitment: string;
  outstanding: string;
  overdue_invoices: number;
}

export interface VendorContact {
  id: string;
  vendor_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

export interface TradeDocRow {
  id: string;
  number: string;
  job_number: string | null;
  status: string;
  total: string;
  date: string | null;
}

export interface TradeOverview {
  vendor: Vendor;
  contacts: VendorContact[];
  specialisms: { id: string; code: string; name: string }[];
  compliance: { applies: boolean; ok: boolean; reason: string | null; warning: string | null; expired: string[]; expiring: string[] };
  committed: string;
  billed: string;
  open_commitment: string;
  outstanding: string;
  overdue: number;
  retention_held: string;
  paid_this_tax_year: string;
  cis_this_tax_year: string;
  tax_year_from: string;
  homes: number;
  service_orders_open: number;
  service_orders_total: number;
  score: { overall: number | null; provisional: boolean; evidence: number } | null;
  recent_pos: TradeDocRow[];
  recent_invoices: TradeDocRow[];
}

/** Gross: paid in full. Net: 20% of labour withheld. Unverified: 30% withheld. */
export type CISStatus = "gross" | "net" | "unverified";

export type CommunityStatus = "planning" | "selling" | "sold_out" | "closed";

export interface PlotCounts {
  total: number;
  not_released: number;
  available: number;
  held: number;
  sold: number;
  closed: number;
}

export interface CommunityStats {
  plots: PlotCounts;
  live_homes: number;
  /** Being built with no buyer: stock to sell. */
  spec_homes: number;
  sales_90_days: number;
  /** Sales per month over the last 90 days. */
  absorption: string;
  /** Unsold plots at that rate; null when nothing is selling. */
  months_of_supply: string | null;
  holds_expiring_soon: number;
}

export interface Community {
  id: string;
  code: string;
  name: string;
  city: string | null;
  /** County. UK addresses, so not "state". */
  county: string | null;
  is_active: boolean;
  status: CommunityStatus;
  address: string | null;
  postcode: string | null;
  /** The planning authority: consents, conditions, S106. */
  local_authority: string | null;
  description: string | null;
  planned_plots: number | null;
  opened_on: string | null;
  target_sales_per_month: string | null;
  sales_manager_id: string | null;
  site_manager_id: string | null;
  stats: CommunityStats | null;
}

export type CommunityInput = Partial<Omit<Community, "id" | "is_active" | "stats">>;

export interface CommunityPortfolio {
  communities: number;
  by_status: Record<string, number>;
  plots: PlotCounts;
  live_homes: number;
  spec_homes: number;
  sales_90_days: number;
  holds_expiring_soon: number;
  unreleased_plots: number;
}

export interface CommunityPhase {
  id: string;
  community_id: string;
  name: string;
  sequence: number;
  planned_release: string | null;
  released_on: string | null;
  notes: string | null;
  plots: PlotCounts;
}

export interface CommunityPlan {
  plan_id: string;
  code: string;
  name: string;
  bedrooms: number | null;
  plan_base_price: string;
  base_price: string | null;
  effective_price: string;
  is_active: boolean;
  homes: number;
}

/** A plot's *sales* position. Whether a home is being built on it is `job_id`. */
export type LotStatus = "available" | "held" | "sold" | "closed" | "not_released";

export interface Lot {
  id: string;
  community_id: string;
  lot_number: string;
  address: string | null;
  postcode: string | null;
  latitude: string | null;
  longitude: string | null;
  status: LotStatus;
  premium: string;
  phase_id: string | null;
  plot_area_sqm: string | null;
  notes: string | null;
  released_on: string | null;
  hold_until: string | null;
  hold_reason: string | null;
  held_on: string | null;
  held_by_id: string | null;
  held_for_lead_id: string | null;
  job_id: string | null;
  job_number: string | null;
  job_status: string | null;
  plan_id: string | null;
  /** A home is being built with no buyer — the first thing to sell. */
  is_spec: boolean;
  held_for_name: string | null;
  hold_days_left: number | null;
}

export interface LotInput {
  lot_number?: string;
  address?: string | null;
  postcode?: string | null;
  premium?: string;
  status?: "available" | "not_released";
  phase_id?: string | null;
  plot_area_sqm?: string | null;
  notes?: string | null;
}

export type HouseType =
  | "detached"
  | "semi_detached"
  | "terraced"
  | "end_terrace"
  | "bungalow"
  | "apartment"
  | "maisonette"
  | "coach_house";
export type GarageType = "none" | "single" | "double" | "integral" | "carport";

export interface PlanStats {
  standard_cost: string;
  cost_lines: number;
  labour_hours: string;
  margin: string;
  margin_pct: string | null;
  elevations: number;
  communities: number;
  live_homes: number;
  finished_homes: number;
  /** Average actual cost of finished homes of this plan; the estimator's feedback. */
  avg_actual_cost: string | null;
  cost_variance_pct: string | null;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  square_feet: number | null;
  /** Gross internal area. */
  floor_area_sqm: string | null;
  bedrooms: number | null;
  /** Full bathrooms, en-suites included. A US "half bath" is `has_cloakroom`. */
  bathrooms: string | null;
  en_suites: number | null;
  has_cloakroom: boolean;
  house_type: HouseType | null;
  storeys: number | null;
  garage: GarageType | null;
  parking_spaces: number | null;
  epc_target: string | null;
  description: string | null;
  base_price: string;
  is_active: boolean;
  stats: PlanStats | null;
}

export type PlanInput = Partial<Omit<Plan, "id" | "is_active" | "stats">> & { price_reason?: string };

export interface PlanPortfolio {
  active: number;
  archived: number;
  avg_margin_pct: string | null;
  low_margin: number;
  margin_floor_pct: string;
  no_costs: number;
  live_homes: number;
  price_changes_90_days: number;
}

export interface PlanCostLine {
  id: string;
  cost_code_id: string;
  vendor_id: string | null;
  amount: string;
  labour_hours: string | null;
  description: string | null;
}

export interface PlanElevation {
  id: string;
  plan_id: string;
  code: string;
  name: string;
  price_adjustment: string;
  description: string | null;
  is_active: boolean;
  homes: number;
}

export interface PlanPriceChange {
  id: string;
  old_price: string;
  new_price: string;
  changed_by_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface PricingGuide {
  plan_price: string;
  community_price: string | null;
  house_price: string;
  elevation_code: string | null;
  elevation_adjustment: string;
  plot_premium: string;
  base_price: string;
  total: string;
}

export type OptionCategory =
  | "structural"
  | "interior"
  | "exterior"
  | "electrical"
  | "plumbing"
  | "flooring"
  | "appliance"
  | "kitchen"
  | "bathroom"
  | "heating"
  | "landscaping"
  | "technology"
  | "other";

export interface OptionStats {
  cost: string;
  margin: string;
  margin_pct: string | null;
  cost_lines: number;
  confirmed: number;
  pending: number;
  revenue: string;
  /** Confirmed on this share of the sold homes it could have gone on. */
  attach_rate_pct: string | null;
  /** 0 means offered on every plan. */
  plans: number;
}

export interface BuildOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: OptionCategory;
  price: string;
  schedule_days: number;
  is_structural: boolean;
  is_active: boolean;
  max_quantity: number;
  unit: string | null;
  supplier_ref: string | null;
  stats: OptionStats | null;
}

export interface OptionCostLine {
  id: string;
  cost_code_id: string;
  vendor_id: string | null;
  amount: string;
  description: string | null;
}

export interface OptionDetail extends BuildOption {
  cost_lines: OptionCostLine[];
  total_cost: string;
  plan_ids: string[];
}

export type OptionInput = Partial<
  Pick<BuildOption, "code" | "name" | "description" | "category" | "price" | "schedule_days" | "is_structural" | "max_quantity" | "unit" | "supplier_ref">
> & { price_reason?: string; plan_ids?: string[] };

export interface OptionSelectionRow {
  selection_id: string;
  job_id: string;
  job_number: string;
  status: string;
  quantity: number;
  price_at_selection: string;
  cost_at_selection: string;
  selected_date: string | null;
}

export interface OptionPortfolio {
  active: number;
  archived: number;
  by_category: Record<string, number>;
  avg_margin_pct: string | null;
  low_margin: number;
  margin_floor_pct: string;
  no_costs: number;
  confirmed_revenue: string;
  pending_selections: number;
  top: { option_id: string; code: string; name: string; confirmed: number; revenue: string }[];
}

/* ------------------------------------------------------------------- jobs */

/** `on_hold` is a state, not a note: started-but-stopped reads differently
 * to everyone who opens this record. */
export type JobStatus =
  | "planned"
  | "sold"
  | "permitting"
  | "under_construction"
  | "on_hold"
  | "complete"
  | "closed"
  | "warranty"
  | "cancelled";

/** Why a build stopped. A closed list, because the point is to count them. */
export type HoldReason =
  | "weather"
  | "inspection"
  | "buyer_decision"
  | "trade_unavailable"
  | "material_shortage"
  | "permit"
  | "finance"
  | "other";

export type CancellationReason =
  | "buyer_withdrew"
  | "finance_fell_through"
  | "builder_withdrew"
  | "lot_problem"
  | "plan_changed"
  | "other";

export interface Job {
  id: string;
  job_number: string;
  community_id: string;
  lot_id: string;
  plan_id: string;
  /** Which elevation of the plan - the same house in brick and in render. */
  elevation: string | null;
  status: JobStatus;
  superintendent_id: string | null;

  permit_number: string | null;
  permit_applied_on: string | null;
  permit_issued_on: string | null;

  sold_date: string | null;
  start_date: string | null;
  /** Frozen at the start. The baseline slip is measured against. */
  projected_completion: string | null;
  /** What the schedule currently expects. The gap to the baseline is the slip. */
  forecast_completion: string | null;
  actual_completion: string | null;
  closing_date: string | null;
  warranty_expires_on: string | null;

  hold_reason: HoldReason | null;
  hold_note: string | null;
  on_hold_since: string | null;
  days_on_hold: number;

  cancelled_on: string | null;
  cancellation_reason: CancellationReason | null;
  cancellation_note: string | null;
  notes: string | null;

  // Derived server-side. A list is read for exactly these: what is late, what
  // has stopped, how long it took.
  is_live: boolean;
  is_building: boolean;
  is_late: boolean;
  days_late: number | null;
  forecast_slip: number | null;
  cycle_time_days: number | null;
  days_building: number | null;
  days_since_hold: number | null;
  days_waiting_on_permit: number | null;
}

/** The counters above the list. `late` and `on_hold` are where money burns. */
export interface JobSummary {
  live: number;
  building: number;
  on_hold: number;
  late: number;
  awaiting_permit: number;
  by_status: Record<string, number>;
}

export interface JobCycleTime {
  homes_measured: number;
  /** Null, not zero, when nothing has finished - zero would be a lie. */
  average_days: number | null;
  by_community: { community_id: string; homes: number; average_days: number }[];
}

export type ContractStatus = "draft" | "out_for_signature" | "signed" | "cancelled";

export interface Contract {
  id: string;
  job_id: string;
  buyer_id: string;
  status: ContractStatus;
  base_price: string;
  lot_premium: string;
  options_total: string;
  incentives: string;
  total_price: string;
  signed_date: string | null;
}

export type SelectionStatus = "pending" | "confirmed" | "cancelled";

export interface Selection {
  id: string;
  job_id: string;
  option_id: string;
  status: SelectionStatus;
  quantity: number;
  price_at_selection: string;
  cost_at_selection: string;
  schedule_days_at_selection: number;
  extended_price: string;
  extended_cost: string;
  selected_date: string | null;
}

export type SelectionApprovalStatus = "not_submitted" | "awaiting" | "approved" | "declined";

/** A selection with its customer-facing signoff state. */
export interface SelectionChoice {
  id: string;
  selection_id: string;
  description: string;
  price: string;
  option_id: string | null;
  is_selected: boolean;
  sort_order: number;
  over_allowance: string | null;
}

export interface SelectionSignoff {
  id: string;
  job_id: string;
  option_id: string;
  option_name: string;
  option_category: string | null;
  status: SelectionStatus;
  approval_status: SelectionApprovalStatus;
  quantity: number;
  price_at_selection: string;
  extended_price: string;
  allowance_amount: string | null;
  requires_client_selection: boolean;
  over_allowance: string | null;
  selected_date: string | null;
  approval_requested_at: string | null;
  approval_deadline: string | null;
  decided_at: string | null;
  buyer_signature: string | null;
  approved_by_buyer_id: string | null;
  decline_reason: string | null;
  buyer_comment: string | null;
  is_awaiting_buyer: boolean;
  approval_overdue: boolean;
  choices: SelectionChoice[];
}

export interface SignoffSummary {
  job_id: string | null;
  total: number;
  not_submitted: number;
  awaiting: number;
  approved: number;
  declined: number;
  overdue: number;
}

export type LeadProposalStatus = "draft" | "sent" | "accepted" | "declined" | "expired";

export interface ProposalItem {
  id: string;
  proposal_id: string;
  group_name: string;
  description: string;
  unit: string | null;
  quantity: string;
  unit_cost: string;
  markup_percent: string;
  sort_order: number;
  unit_price: string;
  extended_cost: string;
  extended_price: string;
}

export interface ProposalTemplateItem {
  id: string;
  group_name: string;
  description: string;
  unit: string | null;
  quantity: string;
  unit_cost: string;
  markup_percent: string;
  sort_order: number;
  unit_price: string;
  extended_price: string;
}

export interface ProposalTemplate {
  id: string;
  name: string;
  description: string | null;
  total: string;
  items: ProposalTemplateItem[];
}

export interface LeadProposal {
  id: string;
  lead_id: string;
  lead_name: string;
  title: string;
  amount: string;
  total: string;
  status: LeadProposalStatus;
  sent_on: string | null;
  valid_until: string | null;
  decided_on: string | null;
  notes: string | null;
  is_expired: boolean;
  items: ProposalItem[];
}

export interface SalesCalendarEvent {
  date: string;
  kind: string;
  ref_id: string | null;
  title: string;
  detail: string | null;
}

export interface LeadMapPoint {
  id: string;
  name: string;
  lat: string;
  lng: string;
  status: string;
  city: string | null;
}

export type EstimateStatus = "draft" | "sent" | "accepted" | "declined";

export interface EstimateItem {
  id: string;
  estimate_id: string;
  group_name: string;
  description: string;
  cost_code_id: string | null;
  unit: string | null;
  quantity: string;
  unit_cost: string;
  markup_percent: string;
  sort_order: number;
  unit_price: string;
  extended_cost: string;
  extended_price: string;
}

export interface Estimate {
  id: string;
  job_id: string;
  title: string;
  status: EstimateStatus;
  default_markup_percent: string;
  tax_percent: string;
  issued_on: string | null;
  notes: string | null;
  total_cost: string;
  subtotal: string;
  tax_amount: string;
  total_price: string;
  margin: string;
  items: EstimateItem[];
}

export interface EstimateListRow {
  id: string;
  job_id: string;
  title: string;
  status: EstimateStatus;
  issued_on: string | null;
  subtotal: string;
  total_price: string;
}

export interface ClientUpdate {
  id: string;
  job_id: string;
  title: string;
  body: string;
  posted_by_id: string | null;
  posted_by_name: string;
  is_published: boolean;
  posted_on: string;
}

export interface ActivityEvent {
  kind: string;
  at: string;
  actor: string;
  title: string;
  detail: string | null;
}

/** A threaded comment on a job or a record within it. */
export interface Comment {
  id: string;
  job_id: string;
  entity_type: string | null;
  entity_id: string | null;
  parent_id: string | null;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface MessageRecipientInfo {
  user_id: string;
  user_name: string;
  read_at: string | null;
}

/** One internal message within a thread. */
export interface MessageItem {
  id: string;
  thread_id: string;
  subject: string;
  body: string;
  sender_id: string | null;
  sender_name: string;
  job_id: string | null;
  created_at: string;
  recipients: MessageRecipientInfo[];
}

export interface ThreadSummary {
  thread_id: string;
  subject: string;
  snippet: string;
  last_at: string;
  last_sender: string;
  message_count: number;
  unread: number;
  participants: string[];
}

export interface InboxSummary {
  threads: number;
  unread: number;
}

export type OwnerInvoiceKind = "deposit" | "progress" | "final" | "standard";
export type OwnerInvoiceStatus = "draft" | "sent" | "viewed" | "partial" | "paid" | "void";

export interface OwnerPayment {
  id: string;
  owner_invoice_id: string;
  amount: string;
  paid_on: string;
  method: string;
  reference: string | null;
  notes: string | null;
}

export interface OwnerInvoiceLine {
  id: string;
  owner_invoice_id: string;
  description: string;
  unit: string | null;
  quantity: string;
  unit_cost: string;
  markup_percent: string;
  sort_order: number;
  unit_price: string;
  extended_cost: string;
  extended_price: string;
}

/** An owner (client) invoice — the receivables side. */
export interface OwnerInvoice {
  id: string;
  job_id: string;
  invoice_number: string;
  title: string;
  kind: OwnerInvoiceKind;
  status: OwnerInvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  viewed_by_owner_on: string | null;
  subtotal: string;
  effective_subtotal: string;
  tax_amount: string;
  retainage_amount: string;
  notes: string | null;
  invoice_description: string | null;
  closing_text: string | null;
  payment_terms: string | null;
  total_price: string;
  amount_paid: string;
  balance_due: string;
  is_paid: boolean;
  payments: OwnerPayment[];
  lines: OwnerInvoiceLine[];
}

export interface OwnerInvoiceSummary {
  job_id: string | null;
  count: number;
  draft: number;
  outstanding_count: number;
  overdue: number;
  total_invoiced: string;
  total_paid: string;
  outstanding: string;
}

export type CostInboxStatus = "new" | "coded" | "pushed" | "rejected";

/** A captured cost awaiting coding and push to a bill. */
export interface CostInboxItem {
  id: string;
  title: string;
  status: CostInboxStatus;
  amount: string | null;
  purchase_date: string | null;
  job_id: string | null;
  vendor_id: string | null;
  cost_code_id: string | null;
  document_id: string | null;
  invoice_id: string | null;
  tags: string[] | null;
  notes: string | null;
  is_coded: boolean;
}

export interface CostInboxSummary {
  count: number;
  new: number;
  coded: number;
  pushed: number;
  rejected: number;
  open_amount: string;
}

export type ShiftStatus = "active" | "completed" | "cancelled";
export type ShiftType = "regular" | "overtime" | "break" | "pto";
export type OutOfBoundsStatus = "unknown" | "in_bounds" | "out_of_bounds";

/** An employee shift — the presence layer (clock-in/out + location). */
export interface Shift {
  id: string;
  job_id: string;
  user_id: string | null;
  worker_name: string;
  cost_code_id: string | null;
  status: ShiftStatus;
  shift_type: ShiftType;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_lat: string | null;
  clock_in_lng: string | null;
  clock_out_lat: string | null;
  clock_out_lng: string | null;
  out_of_bounds: OutOfBoundsStatus;
  notes: string | null;
  approved_at: string | null;
  approved_by_id: string | null;
  invoiced_to_client: boolean;
  duration_minutes: number;
  total_hours: string;
  is_active: boolean;
  is_approved: boolean;
}

/** One pin on the employee locator map. */
export interface ShiftMapPoint {
  id: string;
  job_id: string;
  worker_name: string;
  status: ShiftStatus;
  lat: string;
  lng: string;
  clock_in_at: string;
  out_of_bounds: OutOfBoundsStatus;
}

export interface TimeClockSummary {
  job_id: string | null;
  on_the_clock: number;
  workers_today: number;
  hours_today: string;
  pending_approval: number;
  out_of_bounds: number;
}

export type DirectoryContactType = "team" | "trade" | "customer" | "realtor";

/** One contact in the unified directory, whatever kind of person they are. */
export interface DirectoryContact {
  type: DirectoryContactType;
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  detail: string | null;
  code: string | null;
  status: string | null;
}

export interface DirectorySummary {
  total: number;
  team: number;
  trades: number;
  customers: number;
  realtors: number;
}

export interface SelectionCascade {
  selection_id: string;
  price_delta: string;
  cost_delta: string;
  schedule_days_delta: number;
  contract_options_total: string;
  budget_changes: { cost_code_id: string; delta: string; revised_amount: string }[];
}

export interface BudgetLine {
  id: string;
  cost_code_id: string;
  vendor_id: string | null;
  original_amount: string;
  revised_amount: string;
  variance: string;
  description: string | null;
}

export interface Budget {
  id: string;
  job_id: string;
  status: "draft" | "approved" | "locked";
  original_total: string;
  revised_total: string;
  lines: BudgetLine[];
}

export interface JobCostLine {
  cost_code_id: string;
  code: string;
  name: string;
  original_amount: string;
  revised_amount: string;
  committed_amount: string;
  actual_amount: string;
  uncommitted: string;
  exposure: string;
  variance: string;
  /** Raised but not yet approved, and where this code lands if it is. */
  pending_change: string;
  forecast: string;
  forecast_variance: string;
}

export interface JobCostSummary {
  job_id: string;
  has_budget: boolean;
  original_total: string;
  revised_total: string;
  committed_total: string;
  actual_total: string;
  exposure_total: string;
  uncommitted_total: string;
  variance_total: string;
  over_budget: boolean;
  /** Change orders in flight. `forecast_over_budget` fires before money commits. */
  pending_change_total: string;
  forecast_total: string;
  forecast_variance_total: string;
  forecast_over_budget: boolean;
  /** Inside budget today, outside it if everything raised gets approved. */
  will_go_over: boolean;
  /** Withheld payment. Never nets off actual cost. */
  retainage_held: string;
  retainage_released: string;
  lines: JobCostLine[];
}

/* ------------------------------------------------------------- purchasing */

export type POStatus = "draft" | "issued" | "acknowledged" | "complete" | "void";

export interface POLine {
  id: string;
  cost_code_id: string;
  amount: string;
  description: string | null;
}

export interface InvoiceLine extends POLine {
  /** The PO line being billed against — the schedule of values. */
  purchase_order_line_id: string | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  job_id: string;
  vendor_id: string;
  status: POStatus;
  issued_date: string | null;
  issued_by_id: string | null;
  required_by: string | null;
  acknowledged_on: string | null;
  completed_on: string | null;
  notes: string | null;
  total: string;
  retainage_percent: string;
  retainage_on_total: string;
  /** Set when the PO was issued past a gate that refused it. */
  compliance_override: boolean;
  budget_override: boolean;
  override_reason: string | null;
  invoiced_total: string;
  /** Invoiced and approved — now actual cost. */
  billed_to_date: string;
  remaining_to_bill: string;
  percent_billed: number;
  is_overdue: boolean;
  lines: POLine[];
}

export interface PurchaseOrderSummary {
  committed: string;
  draft_value: string;
  drafts: number;
  open: number;
  awaiting_acknowledgement: number;
  overdue: number;
  billed_to_date: string;
  remaining_to_bill: string;
  overrides: number;
  total: number;
  by_status: Record<string, number>;
}

export type InvoiceStatus = "received" | "approved" | "paid" | "disputed" | "void";

export interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string;
  vendor_id: string;
  purchase_order_id: string;
  status: InvoiceStatus;
  invoice_date: string | null;
  due_date: string | null;
  approved_date: string | null;
  paid_date: string | null;
  lien_waiver_received: boolean;
  total: string;
  retainage_percent: string;
  retainage_amount: string;
  net_payable: string;
  retainage_released_date: string | null;
  notes: string | null;
  /** The labour element CIS is deducted from. Materials are not. */
  labour_amount: string | null;
  cis_rate: string;
  /** False when the trade had no CIS status on record at receipt. */
  cis_verified: boolean;
  cis_deduction: string;
  approved_by_id: string | null;
  over_po_override: boolean;
  override_reason: string | null;
  paid_by_id: string | null;
  payment_reference: string | null;
  lien_waiver_date: string | null;
  disputed_on: string | null;
  dispute_reason: string | null;
  is_overdue: boolean;
  days_overdue: number | null;
  lines: InvoiceLine[];
}

export interface InvoiceSummary {
  actual_cost: string;
  awaiting_approval: number;
  awaiting_value: string;
  disputed: number;
  approved_unpaid: number;
  approved_unpaid_value: string;
  overdue_to_pay: number;
  overdue_value: string;
  waivers_missing: number;
  retention_held: string;
  cis_withheld_this_month: string;
  cis_unverified: number;
  total: number;
  by_status: Record<string, number>;
}

/* ----------------------------------------------------------- change orders */

export type ChangeOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "void";

export type ResponsibleParty = "buyer" | "builder" | "trade";

export interface ChangeOrder {
  id: string;
  co_number: string;
  job_id: string;
  status: ChangeOrderStatus;
  responsible_party: ResponsibleParty;
  description: string;
  reason: string | null;
  price_delta: string;
  cost_delta: string;
  margin_impact: string;
  schedule_days: number;
  approval_deadline: string | null;
  approval_overdue: boolean;
  client_notes: string | null;
  internal_notes: string | null;
  approved_date: string | null;
  cost_lines: PlanCostLine[];
}

/* --------------------------------------------------------------- schedule */

export type TaskStatus =
  | "not_started"
  | "ready"
  | "in_progress"
  | "complete"
  | "blocked"
  | "skipped";

export interface JobTask {
  id: string;
  job_id: string;
  sequence: number;
  name: string;
  status: TaskStatus;
  scheduled_start: string | null;
  scheduled_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  duration_days: number;
  cost_code_id: string | null;
  vendor_id: string | null;
  is_milestone: boolean;
  notes: string | null;
  /** Why the trade cannot start. A schedule that cannot say why it stopped is
   * one nobody trusts. */
  blocked_reason: string | null;

  days_late: number;
  is_overdue: boolean;
  days_overdue: number | null;
  is_open: boolean;
}

export interface ScheduleTemplateTask {
  id: string;
  template_id: string;
  sequence: number;
  name: string;
  /** Working days, both of them. The calendar stretches around weekends. */
  offset_days: number;
  duration_days: number;
  cost_code_id: string | null;
  vendor_id: string | null;
  is_milestone: boolean;
}

export interface Holiday {
  id: string;
  on_date: string;
  name: string;
}

export interface ScheduleSummary {
  templates: number;
  in_progress: number;
  due_soon: number;
  overdue: number;
  blocked: number;
}

export interface ScheduleTemplate {
  id: string;
  code: string;
  name: string;
  plan_id: string | null;
  is_active: boolean;
  tasks: ScheduleTemplateTask[];
}

export interface TaskCompletion {
  task_id: string;
  actual_finish: string;
  days_late: number;
  tasks_shifted: number;
  next_task_id: string | null;
}

/* -------------------------------------------------------------------- crm */

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "appointment"
  | "converted"
  | "lost";

export type LeadSource =
  | "website"
  | "walk_in"
  | "referral"
  | "realtor"
  | "portal"
  | "campaign"
  | "signage"
  | "social"
  | "event"
  | "other";

/** Hot, warm or cold - the salesperson's read on whether this will close. */
export type LeadRating = "hot" | "warm" | "cold";

export type FinancingType = "cash" | "conventional" | "fha" | "va" | "other";

export type ContactMethod = "email" | "phone" | "text";

export type ActivityType =
  | "call"
  | "email"
  | "text"
  | "visit"
  | "appointment"
  | "note"
  | "status_change"
  | "assignment";

export type ActivityOutcome =
  | "reached"
  | "no_answer"
  | "left_message"
  | "booked"
  | "not_interested"
  | "none";

/** A lead as a list row. */
export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  preferred_contact: ContactMethod | null;
  address: string | null;
  city: string | null;
  postcode: string | null;

  status: LeadStatus;
  source: LeadSource;
  rating: LeadRating | null;
  campaign: string | null;
  realtor_id: string | null;

  community_id: string | null;
  plan_id: string | null;
  price_min: string | null;
  price_max: string | null;
  bedrooms_needed: number | null;
  desired_move_in: string | null;
  project_type: string | null;
  tags: string[] | null;
  confidence: number | null;
  projected_sales_date: string | null;

  is_prequalified: boolean;
  has_home_to_sell: boolean;
  financing_type: FinancingType | null;

  assigned_to_id: string | null;
  last_contacted_on: string | null;
  next_follow_up: string | null;
  converted_buyer_id: string | null;
  is_archived: boolean;
  notes: string | null;
  latitude: string | null;
  longitude: string | null;

  /** Derived server-side: still being worked, and the follow-up date has passed. */
  is_open: boolean;
  follow_up_overdue: boolean;
}

/** A lead on its own page: everything, including the slower derived fields. */
export interface LeadDetail extends Lead {
  best_time_to_call: string | null;
  address: string | null;
  postcode: string | null;
  referred_by: string | null;
  lender_name: string | null;
  converted_on: string | null;
  lost_reason: string | null;
  lost_to: string | null;
  lost_on: string | null;
  archive_reason: string | null;
  created_by_id: string | null;
  updated_by_id: string | null;
  days_since_contact: number | null;
  is_contingent: boolean;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string | null;
  activity_type: ActivityType;
  outcome: ActivityOutcome;
  summary: string;
  occurred_on: string | null;
  /** True for entries the system wrote, so the trail can show them differently. */
  is_system: boolean;
}

/** The counters above the list. `unassigned` and `overdue` are where money leaks. */
export interface LeadSummary {
  open: number;
  unassigned: number;
  overdue: number;
  due_today: number;
  by_status: Record<string, number>;
  by_source: { source: string; leads: number; converted: number }[];
}

/** Enough to recognise an existing lead on a duplicate warning, and no more. */
export interface DuplicateMatch {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: LeadSource;
  created_at: string | null;
  assigned_to_id: string | null;
}

export interface BulkAssignResult {
  assigned: number;
  skipped: string[];
  not_found: number;
}

export interface Realtor {
  id: string;
  code: string;
  name: string;
  brokerage: string | null;
  email: string | null;
  phone: string | null;
  licence_number: string | null;
  commission_percent: string;
  notes: string | null;
  is_archived: boolean;
  archive_reason: string | null;
}

/** `conversion_rate` is null for an agent who has sent nothing - a new agent has
 * no rate yet, which is a different fact from a rate of zero. */
export interface RealtorPerformance {
  id: string;
  code: string;
  name: string;
  brokerage: string | null;
  email: string | null;
  phone: string | null;
  commission_percent: string;
  leads_sent: number;
  leads_converted: number;
  conversion_rate: number | null;
}


/* ------------------------------------------------------------------ intake */

export type IntakeKind =
  | "web_form"
  | "rightmove"
  | "zoopla"
  | "onthemarket"
  | "meta_lead_ads"
  | "google_lead_form"
  | "email"
  | "generic";

export type IntakeStatus = "accepted" | "duplicate" | "rejected" | "failed" | "replayed";

/** A configured channel that leads arrive through by themselves. */
export interface IntakeSource {
  id: string;
  code: string;
  name: string;
  kind: IntakeKind;
  lead_source: string;
  /** Last four characters of the key. The key itself is never readable again. */
  key_hint: string;
  is_active: boolean;
  default_community_id: string | null;
  default_campaign: string | null;
  default_realtor_id: string | null;
  auto_assign: boolean;
  field_map: Record<string, string> | null;
  honeypot_field: string | null;
  rate_limit_per_minute: number;
  last_received_at: string | null;
  received_count: number;
  accepted_count: number;
  rejected_count: number;
  failed_count: number;
  is_archived: boolean;
}

/** The only response that ever carries a channel key. */
export interface IntakeSourceCreated {
  source: IntakeSource;
  key: string;
  post_url: string;
  warning: string;
}

/** One inbound payload, kept exactly as it arrived. */
export interface IntakeEvent {
  id: string;
  source_id: string;
  status: IntakeStatus;
  payload: Record<string, unknown>;
  remote_ip: string | null;
  external_ref: string | null;
  lead_id: string | null;
  error: string | null;
  created_at: string;
  needs_attention: boolean;
}

export interface IntakeHealth {
  sources: {
    id: string;
    code: string;
    name: string;
    kind: string;
    is_active: boolean;
    last_received_at: string | null;
    received_count: number;
    accepted_count: number;
    rejected_count: number;
    failed_count: number;
  }[];
  events_by_status: Record<string, number>;
  /** Payloads we hold and cannot read. Each one is a real person nobody replied to. */
  needs_attention: number;
}

export interface ReplayResult {
  status: IntakeStatus;
  lead_id: string | null;
  detail: string | null;
}

/* --------------------------------------------------------------- warranty */

export type WarrantyStatus =
  | "submitted"
  | "acknowledged"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "closed"
  | "declined";

export type ServiceOrderStatus = "assigned" | "scheduled" | "complete" | "cancelled";

export type Priority = "emergency" | "high" | "normal" | "low";

export type WarrantyCategory =
  | "structural"
  | "roofing"
  | "plumbing"
  | "electrical"
  | "heating"
  | "exterior"
  | "interior"
  | "joinery"
  | "appliance"
  | "damp"
  | "drainage"
  | "landscaping"
  | "other";

export type CoverageStatus = "pending" | "in_warranty" | "out_of_warranty" | "goodwill";

export type WarrantyApptKind = "assessment" | "service_visit" | "inspection" | "follow_up";

export type WarrantyApptStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export type NoteVisibility = "internal" | "homeowner";

export interface ServiceOrder {
  id: string;
  request_id: string;
  vendor_id: string | null;
  cost_code_id: string | null;
  status: ServiceOrderStatus;
  instructions: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  resolution: string | null;
  nte_amount: string | null;
  cost_amount: string | null;
  back_charge: boolean;
}

export interface WarrantyAppointment {
  id: string;
  request_id: string;
  kind: WarrantyApptKind;
  status: WarrantyApptStatus;
  scheduled_for: string;
  slot: string | null;
  vendor_id: string | null;
  assignee_id: string | null;
  notes: string | null;
  outcome: string | null;
}

export interface WarrantyNote {
  id: string;
  request_id: string;
  author_id: string | null;
  visibility: NoteVisibility;
  body: string;
  created_at: string;
}

export interface WarrantyRequest {
  id: string;
  request_number: string;
  job_id: string;
  buyer_id: string | null;
  status: WarrantyStatus;
  priority: Priority;
  category: WarrantyCategory;
  coverage: CoverageStatus;
  title: string;
  description: string | null;
  location: string | null;
  reported_via: string | null;
  submitted_date: string | null;
  acknowledged_date: string | null;
  due_date: string | null;
  resolved_date: string | null;
  closed_date: string | null;
  assessment_notes: string | null;
  decline_reason: string | null;
  is_overdue: boolean;
  service_orders: ServiceOrder[];
  appointments: WarrantyAppointment[];
  notes: WarrantyNote[];
}

export interface WarrantyCoverage {
  job_id: string;
  closing_date: string | null;
  defects_until: string | null;
  structural_until: string | null;
  defects_active: boolean;
  structural_active: boolean;
}

export interface WarrantySummary {
  total: number;
  open: number;
  overdue: number;
  emergency_open: number;
  unassessed: number;
  resolved_last_30: number;
  avg_resolution_days: number | null;
  service_orders_open: number;
  back_charge_total: string;
  appointments_upcoming: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_coverage: Record<string, number>;
  callbacks_by_trade: {
    vendor_id: string | null;
    vendor_code: string | null;
    vendor_name: string;
    service_orders: number;
    back_charges: number;
    share: number;
  }[];
}

/* -------------------------------------------------------------- reporting */

export interface Dashboard {
  sales: {
    open_leads: number;
    converted_leads: number;
    signed_contracts: number;
    sold_value: string;
  };
  construction: {
    jobs_total: number;
    under_construction: number;
    closed: number;
    overdue_tasks: number;
  };
  money: {
    budget_revised: string;
    committed: string;
    actual: string;
    uncommitted: string;
    /** Raised but undecided — not committed, but visible before it lands. */
    pending_change: string;
    forecast: string;
    /** Withheld payment. Never nets off actual cost. */
    retainage_held: string;
  };
  warranty: { open_requests: number };
  /** What the figures cover, so the UI never has to guess. */
  scope: {
    community_id: string | null;
    jobs_in_scope: number;
    /** Figures that stay portfolio-wide however the dashboard is scoped. */
    unscoped: string[];
  };
  /** The Procore-derived half: what is owed, by whom, and what blocks money. */
  controls: {
    rfis_open: number;
    rfis_in_our_court: number;
    rfis_overdue: number;
    rfis_blocking: number;
    submittals_awaiting: number;
    observations_open: number;
    observations_overdue: number;
    incidents_reportable: number;
    trades_blocked: number;
    trades_expiring: number;
  };
}

export interface SalesPipeline {
  by_status: { status: LeadStatus; count: number }[];
  by_source: {
    source: LeadSource;
    leads: number;
    converted: number;
    conversion_rate: number;
  }[];
}

export interface JobMarginRow {
  job_id: string;
  job_number: string;
  status: JobStatus;
  revenue: string;
  budget: string;
  committed: string;
  actual: string;
  exposure: string;
  margin: string;
  margin_pct: number;
}

export interface JobMarginReport {
  jobs: JobMarginRow[];
  total_revenue: string;
  total_exposure: string;
  total_margin: string;
}

export interface CycleTimeReport {
  jobs: {
    job_id: string;
    job_number: string;
    start_date: string;
    actual_completion: string;
    cycle_days: number;
  }[];
  completed_jobs: number;
  average_cycle_days: number | null;
  fastest_days: number | null;
  slowest_days: number | null;
}

export interface WarrantyByTrade {
  since: string;
  total_service_orders: number;
  trades: {
    vendor_code: string;
    vendor_name: string;
    service_orders: number;
    share: number;
  }[];
}

/* ------------------------------------------------------------ trade portal */

export interface PortalIdentity {
  vendor_id: string;
  vendor_code: string;
  vendor_name: string;
  open_purchase_orders: number;
  upcoming_tasks: number;
  open_service_orders: number;
}

/* -------------------------------------------------------------- documents */

export type DocumentCategory =
  | "plan"
  | "specification"
  | "contract"
  | "addendum"
  | "purchase_order"
  | "change_order"
  | "permit"
  | "inspection"
  | "photo"
  | "video"
  | "warranty"
  | "insurance"
  | "lien_waiver"
  | "other";

export type DocumentStatus = "draft" | "active" | "superseded" | "archived";

export interface DocumentRecord {
  id: string;
  name: string;
  category: DocumentCategory;
  status: DocumentStatus;
  storage_key: string;
  reference: string | null;
  content_type: string | null;
  size_bytes: number | null;
  revision: number;
  superseded_by_id: string | null;
  issued_on: string | null;
  expires_on: string | null;
  job_id: string | null;
  community_id: string | null;
  plan_id: string | null;
  vendor_id: string | null;
  lead_id: string | null;
  uploaded_by_id: string | null;
  notes: string | null;
  created_at: string;
  is_critical: boolean;
  is_expired: boolean;
  is_expiring: boolean;
  days_to_expiry: number | null;
}

export interface DocumentSummary {
  total: number;
  critical: number;
  not_tied_to_home: number;
  expiring_soon: number;
  expired: number;
  categories_in_use: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}

/* ---------------------------------------------------------------- bidding */

export type BidPackageStatus = "draft" | "out_for_bid" | "awarded" | "cancelled";
export type BidStatus = "invited" | "submitted" | "awarded" | "declined" | "not_awarded";

export interface Bid {
  id: string;
  package_id: string;
  vendor_id: string;
  status: BidStatus;
  amount: string | null;
  submitted_date: string | null;
  revision_bid: number;
  notes: string | null;
}

export interface BidPackage {
  id: string;
  package_number: string;
  name: string;
  scope: string | null;
  cost_code_id: string;
  plan_id: string | null;
  community_id: string | null;
  status: BidPackageStatus;
  due_date: string | null;
  estimate: string | null;
  document_revision: number;
  low_bid: string | null;
  high_bid: string | null;
  average_bid: string | null;
  spread: string | null;
  awarded_amount: string | null;
  savings_vs_estimate: string | null;
  invited_count: number;
  submitted_count: number;
  declined_count: number;
  response_rate: number | null;
  is_overdue: boolean;
  bids: Bid[];
}

export interface AwardResult {
  bid_id: string;
  vendor_id: string;
  amount: string;
  purchase_order_id: string | null;
  po_number: string | null;
  not_awarded: number;
  savings_vs_estimate: string | null;
}

export interface BidSummary {
  packages: number;
  draft: number;
  out_for_bid: number;
  awarded: number;
  cancelled: number;
  overdue: number;
  invited: number;
  submitted: number;
  response_rate: number | null;
  awarded_value: string;
  savings: string;
}

/* -------------------------------------------------------- field operations */

export type InspectionType = "municipal" | "third_party" | "internal_qa" | "walkthrough";
export type InspectionResult = "scheduled" | "passed" | "failed" | "cancelled";
export type PunchStatus = "open" | "assigned" | "ready_for_review" | "complete" | "wont_fix";

export interface DailyLog {
  id: string;
  job_id: string;
  log_date: string;
  author_id: string | null;
  weather: string | null;
  crew_count: number | null;
  trades_on_site: string | null;
  work_performed: string | null;
  delays: string | null;
  notes: string | null;
}

export type ItemResult = "pending" | "pass" | "fail" | "not_applicable";

export interface InspectionItem {
  id: string;
  sequence: number;
  description: string;
  result: ItemResult;
  notes: string | null;
  vendor_id: string | null;
}

export interface Inspection {
  id: string;
  job_id: string;
  inspection_type: string;
  name: string;
  result: string;
  scheduled_date: string | null;
  completed_date: string | null;
  inspector: string | null;
  failure_reason: string | null;
  task_id: string | null;
  /** The failed inspection this one is retrying. */
  reinspects_id: string | null;
  fee: string;
  items: InspectionCheck[];
  checked_items: number;
  /** A failed municipal inspection is a legal stop, not just bad news. */
  is_blocking: boolean;
}

export interface InspectionCheck {
  id: string;
  inspection_id: string;
  sequence: number;
  description: string;
  result: "pending" | "pass" | "fail" | "not_applicable";
  notes: string | null;
  vendor_id: string | null;
}

/**
 * How much a defect matters.
 *
 * A scuff and a cracked soil pipe are both punch items and only one of them
 * should stop a handover. Without this the list is a flat wall of defects and the
 * superintendent sorts it by memory.
 */
export type PunchSeverity = "cosmetic" | "minor" | "major" | "blocking";

export interface PunchItem {
  id: string;
  job_id: string;
  description: string;
  location: string | null;
  status: PunchStatus;
  severity: PunchSeverity;
  vendor_id: string | null;
  cost_code_id: string | null;
  raised_by_id: string | null;
  ball_in_court: string;
  from_walkthrough: boolean;
  due_date: string | null;
  completed_date: string | null;
  /** Who accepted the fix. A defect used to close on the trade's word alone. */
  verified_by_id: string | null;
  verified_date: string | null;
  resolution_note: string | null;
  inspection_item_id: string | null;

  is_unresolved: boolean;
  is_overdue: boolean;
  days_overdue: number | null;
  /** Whether this one alone stops the keys changing hands. */
  blocks_handover: boolean;
}

export interface FieldSummary {
  open_punch: number;
  awaiting_review: number;
  overdue_punch: number;
  blocking_handover: number;
  from_walkthrough: number;
  failed_inspections: number;
  daily_logs: number;
}

/* ------------------------------------------------------------- marketing */

export type CampaignStatus = "draft" | "scheduled" | "running" | "sent" | "cancelled";
export type SurveyStage =
  | "contract"
  | "pre_closing"
  | "thirty_day"
  | "eleven_month"
  | "warranty";

/**
 * How a campaign reaches people.
 *
 * Email is the one with delivery numbers. The rest are money spent where the only
 * measurable outcome is the leads that arrive afterwards - which is exactly why
 * cost per lead matters more here than open rate.
 */
export type CampaignChannel =
  | "email"
  | "print"
  | "signage"
  | "social"
  | "portal"
  | "event"
  | "radio"
  | "other";

export interface Campaign {
  id: string;
  code: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  subject: string | null;
  body: string | null;
  budget: string;
  cost: string;
  community_id: string | null;
  scheduled_for: string | null;
  sent_date: string | null;
  starts_on: string | null;
  ends_on: string | null;
  cancellation_reason: string | null;
  notes: string | null;

  sent_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  open_rate: number;
  click_rate: number;

  /** Whether an open rate means anything here. A road sign has none. */
  has_delivery_numbers: boolean;
  is_over_budget: boolean;
  is_active: boolean;
}

/**
 * One campaign with what it cost and what it produced.
 *
 * Costs are null rather than zero when there is nothing to divide by - zero would
 * be a lie a report repeats, and infinity is not actionable.
 */
export interface CampaignResult {
  campaign_id: string;
  code: string;
  name: string;
  channel: string;
  status: string;
  budget: string;
  cost: string;
  is_over_budget: boolean;
  sent: number | null;
  opened: number | null;
  clicked: number | null;
  open_rate: number | null;
  click_rate: number | null;
  leads: number;
  converted: number;
  revenue: string;
  cost_per_lead: string | null;
  cost_per_sale: string | null;
  conversion_rate: number | null;
  return_on_spend: number | null;
}

export interface CampaignPerformance {
  campaigns: CampaignResult[];
  total_cost: string;
  total_leads: number;
  total_converted: number;
  total_revenue: string;
  cost_per_lead: string | null;
  cost_per_sale: string | null;
  return_on_spend: number | null;
}

export interface MarketingSummary {
  by_status: Record<string, number>;
  active: number;
  total_spend: string;
  leads_attributed: number;
  leads_converted: number;
  /** Leads tagged with a campaign that matches nothing - spend nobody can name. */
  unmatched_tags: number;
  cost_per_lead: string | null;
  cost_per_sale: string | null;
}

export interface CampaignPerformanceRow {
  campaign_id: string;
  code: string;
  name: string;
  status: CampaignStatus;
  sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  leads: number;
  converted: number;
}

export type SurveyStatus = "pending" | "responded" | "declined" | "expired";

export type NpsBand = "promoter" | "passive" | "detractor";

export interface Survey {
  id: string;
  job_id: string;
  buyer_id: string | null;
  stage: SurveyStage;
  status: SurveyStatus;
  sent_date: string | null;
  due_date: string | null;
  responded_date: string | null;
  reminder_count: number;
  last_reminded_date: string | null;
  would_recommend: number | null;
  rating_sales: number | null;
  rating_construction: number | null;
  rating_quality: number | null;
  rating_warranty: number | null;
  rating_communication: number | null;
  rating_value: number | null;
  overall_satisfaction: number | null;
  comments: string | null;
  follow_up_required: boolean;
  follow_up_done: boolean;
  follow_up_notes: string | null;
  follow_up_owner_id: string | null;
  nps_band: NpsBand | null;
  is_overdue: boolean;
  needs_follow_up: boolean;
}

export interface SurveySummary {
  sent: number;
  responses: number;
  pending: number;
  overdue: number;
  declined: number;
  response_rate: number;
  nps: number | null;
  star_rating: number | null;
  pct_recommend: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  detractors_open: number;
  avg_overall: number | null;
  ratings: Record<string, number | null>;
  by_stage: { stage: string; sent: number; responses: number; nps: number | null }[];
  trend: { label: string; nps: number | null; responses: number }[];
}

export interface Satisfaction {
  responses: number;
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  ratings: {
    sales: number | null;
    construction: number | null;
    quality: number | null;
    warranty: number | null;
  };
}

/* --------------------------------------------------- design studio / esign */

export type AppointmentStatus = "scheduled" | "complete" | "no_show" | "cancelled";
export type SignatureStatus = "draft" | "sent" | "viewed" | "signed" | "declined" | "expired";

export interface DesignAppointment {
  id: string;
  job_id: string;
  buyer_id: string | null;
  consultant_id: string | null;
  scheduled_for: string | null;
  duration_minutes: number;
  status: AppointmentStatus;
  location: string | null;
  structural_cutoff: string | null;
  notes: string | null;
  completed_at: string | null;
  outcome_note: string | null;
  /** The booking this one replaced, so a chain of moves stays visible. */
  rescheduled_from_id: string | null;

  is_open: boolean;
  structural_cutoff_passed: boolean;
  /** What a consultant leads with: after this, structural answers change to no. */
  days_to_cutoff: number | null;
}

export interface SignatureRequest {
  id: string;
  job_id: string;
  document_kind: string;
  document_name: string;
  signer_name: string;
  signer_email: string;
  status: SignatureStatus;
  sent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  void_reason: string | null;
  expires_on: string | null;
  reminders_sent: number;
  last_reminder_at: string | null;
  provider: string | null;
  external_id: string | null;

  is_outstanding: boolean;
  days_outstanding: number | null;
  is_expired: boolean;
}

/**
 * What the buyer may spend on options and how much is gone.
 *
 * `pending` and `confirmed` are separate because they mean different things:
 * confirmed is on a signed addendum, pending is a decision made in the room that
 * has not been papered yet. Both draw down the budget.
 */
export interface AllowanceSummary {
  job_id: string;
  has_contract: boolean;
  allowance: string;
  confirmed: string;
  pending: string;
  spent: string;
  remaining: string;
  over_by: string;
  is_over: boolean;
}

export interface StudioSummary {
  appointments: Record<string, number>;
  signatures: Record<string, number>;
  scheduled: number;
  awaiting_signature: number;
  signed: number;
  /** Buyers about to lose the ability to change anything structural. */
  cutoff_soon: number;
}

/* -------------------------------------------------------- land development */

export type LandPhaseStatus =
  | "planning"
  | "entitlement"
  | "development"
  | "complete"
  | "on_hold";

export interface LandBudgetLine {
  id: string;
  category: string;
  vendor_id: string | null;
  budget_amount: string;
  actual_amount: string;
  variance: string;
  notes: string | null;
}

export type PlanningStatus =
  | "not_submitted"
  | "submitted"
  | "outline"
  | "reserved_matters"
  | "full"
  | "refused"
  | "appeal";
export type ObligationKind = "condition" | "s106" | "cil" | "s38" | "s278" | "s104" | "other";
export type ObligationStatus = "outstanding" | "submitted" | "discharged" | "paid" | "waived";

export interface LandObligation {
  id: string;
  project_id: string;
  kind: ObligationKind;
  reference: string | null;
  description: string;
  trigger: string | null;
  /** Must be discharged before any work starts on site. */
  pre_commencement: boolean;
  due_date: string | null;
  amount: string | null;
  status: ObligationStatus;
  completed_on: string | null;
  notes: string | null;
  is_overdue: boolean;
}

export interface LandProject {
  id: string;
  code: string;
  name: string;
  community_id: string | null;
  status: LandPhaseStatus;
  acres: string | null;
  site_area_ha: string | null;
  planned_lots: number | null;
  delivered_lots: number;
  acquisition_cost: string;
  gdv: string | null;
  build_cost_estimate: string | null;
  purchased_on: string | null;
  start_date: string | null;
  projected_completion: string | null;
  local_authority: string | null;
  planning_ref: string | null;
  planning_status: PlanningStatus;
  planning_approved_on: string | null;
  /** The permission lapses if not implemented by this date. */
  planning_expires_on: string | null;
  notes: string | null;
  budget_total: string;
  actual_total: string;
  forecast_total: string;
  cost_per_lot: string | null;
  profit: string | null;
  margin_on_gdv: string | null;
  is_buildable: boolean;
  days_to_consent_expiry: number | null;
  budget_lines: LandBudgetLine[];
  obligations: LandObligation[];
}

export type LandProjectInput = Partial<
  Omit<LandProject, "id" | "budget_lines" | "obligations" | "budget_total" | "actual_total" | "forecast_total" | "cost_per_lot" | "profit" | "margin_on_gdv" | "is_buildable" | "days_to_consent_expiry">
>;

export interface LandSummary {
  projects: number;
  by_status: Record<string, number>;
  acquisition: string;
  budget: string;
  actual: string;
  forecast: string;
  planned_plots: number;
  delivered_plots: number;
  consents_expiring: number;
  obligations_open: number;
  obligations_overdue: number;
  pre_commencement_open: number;
  contributions_due: string;
}

/* ------------------------------------------------------------- accounting */

export type ExportKind = "invoices" | "payments" | "retention";
export type ExportStatus = "exported" | "posted" | "void";
export type ExportFormat = "journal" | "sage50" | "xero";

/** One side of a double entry. Exactly one of debit and credit is non-zero. */
export interface JournalLine {
  posting_date: string;
  /** Set when the item was dated in a locked period and moved to the first open day. */
  original_date: string | null;
  account: string;
  debit: string;
  credit: string;
  job_number: string | null;
  reference: string;
  details: string;
  supplier_code: string | null;
}

export interface ExportItem {
  invoice_id: string;
  document: string;
  event_date: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  job_number: string | null;
  amount: string;
  warnings: string[];
}

export interface ExportQueue {
  kind: ExportKind;
  through_date: string;
  items: ExportItem[];
  journal: JournalLine[];
  debits: string;
  credits: string;
  balanced: boolean;
  /** Payments / releases held until their invoice has gone to the ledger. */
  waiting: number;
}

export interface ExportBatch {
  id: string;
  batch_number: string;
  kind: ExportKind;
  status: ExportStatus;
  through_date: string;
  item_count: number;
  total: string;
  notes: string | null;
  created_at: string;
  created_by_id: string | null;
  posted_at: string | null;
  posted_by_id: string | null;
  ledger_reference: string | null;
  voided_at: string | null;
  void_reason: string | null;
  download_count: number;
  last_downloaded_at: string | null;
}

export interface ExportBatchDetail extends ExportBatch {
  items: ExportItem[];
  journal: JournalLine[];
  debits: string;
  credits: string;
}

export interface AccountingSummary {
  ready: Record<ExportKind, { count: number; value: string }>;
  waiting: number;
  unposted_batches: number;
  last_export_on: string | null;
  exported_this_month: string;
  unmapped_cost_codes: number;
  open_commitments: string;
  cis_this_period: string;
  locked_through: string | null;
}

export interface AccountingSettings {
  default_format: ExportFormat;
  cost_account: string;
  creditors_account: string;
  retention_account: string;
  cis_account: string;
  bank_account: string;
  locked_through: string | null;
}

export interface NominalMapping {
  cost_code_id: string;
  code: string;
  name: string;
  division: string | null;
  gl_account: string | null;
  is_active: boolean;
}

export interface CISReturnRow {
  vendor_id: string;
  supplier_code: string;
  supplier_name: string;
  utr: string | null;
  cis_status: CISStatus | null;
  payments: number;
  gross_paid: string;
  materials: string;
  labour: string;
  deducted: string;
  problems: string[];
}

export interface CISReturn {
  period_start: string;
  period_end: string;
  due_date: string;
  rows: CISReturnRow[];
  gross_paid: string;
  materials: string;
  deducted: string;
}

/* -------------------------------------------------------- homeowner portal */

export interface HomeownerHome {
  buyer_name: string;
  homes: {
    job_id: string;
    job_number: string;
    status: JobStatus;
    projected_completion: string | null;
    closing_date: string | null;
    contract_total: string;
    open_warranty_claims: number;
  }[];
}

/** A client invoice as the buyer sees it: price, paid and balance only — never cost. */
export interface BuyerInvoice {
  id: string;
  job_id: string;
  invoice_number: string;
  title: string;
  kind: OwnerInvoiceKind;
  status: OwnerInvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  total_price: string;
  tax_amount: string;
  retainage_amount: string;
  amount_paid: string;
  balance_due: string;
  is_paid: boolean;
  payment_terms: string | null;
  invoice_description: string | null;
  closing_text: string | null;
  lines: {
    description: string;
    unit: string | null;
    quantity: string;
    unit_price: string;
    extended_price: string;
  }[];
  payments: { amount: string; paid_on: string; method: string; reference: string | null }[];
}

/** A published client update shown in the homeowner portal. */
export interface BuyerUpdate {
  id: string;
  job_id: string;
  title: string;
  body: string;
  posted_on: string;
}

/* ========================================================================== */
/* Procore-derived modules                                                    */
/* ========================================================================== */

/* ------------------------------------------ prequalification & compliance */

export type PrequalStatus =
  | "not_started"
  | "invited"
  | "submitted"
  | "under_review"
  | "approved"
  | "conditional"
  | "rejected"
  | "expired";

export type DocumentType =
  // UK trade paperwork
  | "public_liability"
  | "employers_liability"
  | "professional_indemnity"
  | "cis_registration"
  | "vat_registration"
  | "trade_accreditation"
  | "health_safety_policy"
  | "dbs_check"
  // legacy values, kept so older records still read
  | "general_liability"
  | "workers_comp"
  | "auto_liability"
  | "umbrella"
  | "trade_licence"
  | "w9"
  | "business_licence"
  | "safety_program"
  | "other";

export interface ComplianceDocument {
  id: string;
  document_type: DocumentType;
  reference: string | null;
  issuer: string | null;
  coverage_amount: string | null;
  issued_on: string | null;
  expires_on: string | null;
  is_expired: boolean;
  days_remaining: number | null;
}

export interface Prequalification {
  id: string;
  vendor_id: string;
  status: PrequalStatus;
  single_job_limit: string | null;
  aggregate_limit: string | null;
  reviewed_on: string | null;
  review_due: string | null;
  notes: string | null;
  is_compliant: boolean;
  review_overdue: boolean;
  /** Why the purchase-order gate would refuse this trade today; null when clear. */
  blocking_reason: string | null;
  /** Required cover types (public/employers' liability) with no in-date document. */
  missing_required: string[];
  documents: ComplianceDocument[];
}

/** One lapsing (or lapsed) certificate on the chase list. */
export interface ExpiringDocument {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  document_type: string;
  reference: string | null;
  expires_on: string;
  days_remaining: number | null;
  is_expired: boolean;
}

export interface ComplianceSummary {
  prequalified: number;
  cleared: number;
  approved: number;
  conditional: number;
  would_be_refused: number;
  no_record: number;
  review_overdue: number;
  missing_required: number;
  expiring_soon: number;
  expired_documents: number;
  cover_gaps: number;
  by_status: Record<string, number>;
}

/** The verdict the purchase-order gate acts on. */
export interface ComplianceCheck {
  vendor_id: string;
  ok: boolean;
  reason: string | null;
  warning: string | null;
  expired: string[];
  expiring: string[];
}

/* ------------------------------------------------------ RFIs & submittals */

export type BallInCourt = "builder" | "trade" | "architect" | "engineer" | "buyer" | "closed";
export type RFIStatus = "draft" | "open" | "answered" | "closed" | "void";
/** RFI/submittal urgency. Distinct from the warranty `Priority`, which has
    an `emergency` band instead of `urgent`. */
export type RFIPriority = "urgent" | "high" | "normal" | "low";

export type RFICategory =
  | "design"
  | "structural"
  | "architectural"
  | "mep"
  | "civils"
  | "coordination"
  | "site_condition"
  | "materials"
  | "building_control"
  | "other";

export type RFIActivityKind =
  | "raised"
  | "responded"
  | "answered"
  | "reassigned"
  | "edited"
  | "reopened"
  | "closed"
  | "voided"
  | "change_order";

export interface RFIResponse {
  id: string;
  rfi_id: string;
  author_id: string | null;
  court: BallInCourt;
  body: string;
  is_official: boolean;
  cost_impact: boolean;
  schedule_impact_days: number;
  created_at: string;
}

export interface RFIActivity {
  id: string;
  rfi_id: string;
  author_id: string | null;
  kind: RFIActivityKind;
  detail: string | null;
  created_at: string;
}

export interface RFI {
  id: string;
  rfi_number: string;
  job_id: string;
  subject: string;
  question: string;
  status: RFIStatus;
  ball_in_court: BallInCourt;
  priority: RFIPriority;
  category: RFICategory;
  location: string | null;
  spec_reference: string | null;
  assigned_vendor_id: string | null;
  cost_code_id: string | null;
  drawing_id: string | null;
  raised_on: string | null;
  due_on: string | null;
  answered_on: string | null;
  closed_on: string | null;
  is_blocking: boolean;
  cost_impact: boolean;
  schedule_impact_days: number;
  answer: string | null;
  is_overdue: boolean;
  days_open: number | null;
  days_to_answer: number | null;
  response_count: number;
  responses: RFIResponse[];
  activity: RFIActivity[];
}

export interface RFISummary {
  total: number;
  open: number;
  answered: number;
  closed: number;
  overdue: number;
  blocking: number;
  in_our_court: number;
  unassigned: number;
  due_this_week: number;
  avg_response_days: number | null;
  by_status: Record<string, number>;
  by_court: Record<string, number>;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  aging: Record<string, number>;
}

export type SubmittalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "approved_as_noted"
  | "revise_and_resubmit"
  | "rejected";

export type SubmittalType =
  | "product_data"
  | "shop_drawing"
  | "sample"
  | "mock_up"
  | "certificate"
  | "method_statement"
  | "o_and_m"
  | "warranty_doc"
  | "other";

export type SubmittalActivityKind =
  | "created"
  | "submitted"
  | "review_started"
  | "approved"
  | "approved_as_noted"
  | "revise_and_resubmit"
  | "rejected"
  | "resubmitted"
  | "reassigned"
  | "edited";

export interface SubmittalRevision {
  id: string;
  submittal_id: string;
  revision: number;
  outcome: SubmittalStatus;
  submitted_on: string | null;
  returned_on: string | null;
  reviewer_id: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface SubmittalActivity {
  id: string;
  submittal_id: string;
  author_id: string | null;
  kind: SubmittalActivityKind;
  detail: string | null;
  created_at: string;
}

export interface Submittal {
  id: string;
  submittal_number: string;
  job_id: string | null;
  plan_id: string | null;
  title: string;
  description: string | null;
  spec_section: string | null;
  manufacturer: string | null;
  model_number: string | null;
  submittal_type: SubmittalType;
  priority: RFIPriority;
  status: SubmittalStatus;
  ball_in_court: BallInCourt;
  revision: number;
  vendor_id: string | null;
  cost_code_id: string | null;
  option_id: string | null;
  submitted_on: string | null;
  due_on: string | null;
  returned_on: string | null;
  approved_on: string | null;
  reviewer_id: string | null;
  review_notes: string | null;
  required_on_site: string | null;
  lead_time_days: number;
  is_overdue: boolean;
  order_by_date: string | null;
  submit_by_date: string | null;
  is_at_risk: boolean;
  review_turnaround_days: number | null;
  revisions: SubmittalRevision[];
  activity: SubmittalActivity[];
}

export interface SubmittalSummary {
  total: number;
  draft: number;
  awaiting_review: number;
  being_revised: number;
  approved: number;
  rejected: number;
  overdue: number;
  at_risk: number;
  ball_with_trade: number;
  avg_review_days: number | null;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_court: Record<string, number>;
  by_priority: Record<string, number>;
}

/* ------------------------------------ drawings, specs and transmittals */

export type DrawingDiscipline =
  | "architectural"
  | "structural"
  | "mechanical"
  | "electrical"
  | "plumbing"
  | "civil"
  | "landscape"
  | "other";

export type SetStatus = "draft" | "issued" | "superseded" | "void";
export type SpecStatus = "draft" | "issued" | "superseded";
export type TransmittalPurpose =
  | "for_construction"
  | "for_review"
  | "for_approval"
  | "for_information"
  | "for_record";

export interface Drawing {
  id: string;
  sheet_number: string;
  title: string;
  discipline: DrawingDiscipline;
  storage_key: string | null;
  notes: string | null;
}

export interface DrawingSet {
  id: string;
  set_number: string;
  name: string;
  revision: number;
  plan_id: string | null;
  community_id: string | null;
  status: SetStatus;
  issued_on: string | null;
  superseded_by_id: string | null;
  notes: string | null;
  sheet_count: number;
  disciplines: Record<string, number>;
  drawings: Drawing[];
}

export interface Specification {
  id: string;
  section: string;
  division: string;
  title: string;
  body: string | null;
  revision: number;
  status: SpecStatus;
  superseded_by_id: string | null;
  plan_id: string | null;
  cost_code_id: string | null;
  storage_key: string | null;
  is_current: boolean;
}

export interface TransmittalRecipient {
  id: string;
  vendor_id: string;
  acknowledged_at: string | null;
}

export interface Transmittal {
  id: string;
  transmittal_number: string;
  subject: string;
  purpose: TransmittalPurpose;
  message: string | null;
  drawing_set_id: string | null;
  specification_id: string | null;
  job_id: string | null;
  sent_on: string | null;
  response_due: string | null;
  acknowledged_count: number;
  outstanding: number;
  is_overdue: boolean;
  recipients: TransmittalRecipient[];
}

export interface DrawingsSummary {
  draft_sets: number;
  live_sets: number;
  superseded_sets: number;
  total_sheets: number;
  specifications: number;
  draft_specs: number;
  transmittals: number;
  unacknowledged: number;
  overdue_transmittals: number;
  by_discipline: Record<string, number>;
  by_purpose: Record<string, number>;
}

/* ------------------------------------------------------------------ safety */

export type ObservationType = "safety" | "quality" | "commissioning" | "work_to_complete";
export type ObservationStatus = "initiated" | "ready_for_review" | "closed" | "not_accepted";
export type Severity = "critical" | "high" | "medium" | "low";
export type IncidentType =
  | "injury"
  | "near_miss"
  | "property_damage"
  | "environmental"
  | "illness";

/**
 * What makes an incident reportable to the HSE, and how fast.
 *
 * RIDDOR decides this, not a judgement on the day - which is why `reportable`
 * alone was the wrong shape. Each category carries its own deadline.
 */
export type RiddorCategory =
  | "not_reportable"
  | "fatality"
  | "specified_injury"
  | "over_7_day"
  | "occupational_disease"
  | "dangerous_occurrence";

export interface Observation {
  id: string;
  job_id: string;
  title: string;
  description: string | null;
  location: string | null;
  observation_type: ObservationType;
  status: ObservationStatus;
  severity: Severity;
  /** The inspection whose failure raised this, where one did. */
  inspection_id: string | null;
  assigned_vendor_id: string | null;
  raised_by_id: string | null;
  due_on: string | null;
  closed_on: string | null;
  /** Who accepted the fix - not the same person as whoever did it. */
  closed_by_id: string | null;
  resolution: string | null;

  /** Ready-for-review counts as open: a claimed fix nobody has looked at is not done. */
  is_open: boolean;
  is_overdue: boolean;
  days_overdue: number | null;
}

export interface Incident {
  id: string;
  job_id: string;
  incident_type: IncidentType;
  severity: Severity;
  occurred_on: string;
  title: string;
  description: string | null;
  location: string | null;
  person_involved: string | null;
  vendor_id: string | null;
  lost_time: boolean;
  medical_treatment: boolean;
  reportable: boolean;
  riddor_category: RiddorCategory;
  reported_to_hse_on: string | null;
  hse_reference: string | null;
  immediate_action: string | null;
  root_cause: string | null;
  closed_on: string | null;

  /** The day the written report is due with the HSE, from the category. */
  riddor_deadline: string | null;
  /** Some categories must be telephoned first, so the deadline alone would mislead. */
  report_without_delay: boolean;
  report_overdue: boolean;
  /** Negative once the deadline has passed. Null when nothing is owed. */
  days_to_report: number | null;
  is_open: boolean;
}

export type ActionPlanStatus = "draft" | "active" | "complete" | "overdue";

export interface ActionPlanItem {
  id: string;
  plan_id: string;
  sequence: number;
  description: string;
  requires_signoff: boolean;
  assigned_to_id: string | null;
  vendor_id: string | null;
  due_on: string | null;
  completed_on: string | null;
  completed_by_id: string | null;
  signed_off_by_id: string | null;
  signed_off_on: string | null;
  notes: string | null;

  awaiting_signoff: boolean;
  /** Done means witnessed, where a witness was required. */
  is_done: boolean;
}

export interface ActionPlan {
  id: string;
  job_id: string | null;
  name: string;
  description: string | null;
  status: ActionPlanStatus;
  due_on: string | null;
  owner_id: string | null;
  is_template: boolean;
  /** The template this was started from, where it was. */
  template_id: string | null;
  started_on: string | null;
  items: ActionPlanItem[];

  /** Steps somebody marked done, witnessed or not. */
  completed_items: number;
  /** Steps actually finished — witnessed, where a witness was required. */
  done_items: number;
  percent_complete: number;
  is_overdue: boolean;
  /** The one step the plan is waiting on. These run in order. */
  next_item: ActionPlanItem | null;
}

export interface SafetySummary {
  open_observations: number;
  awaiting_review: number;
  overdue: number;
  critical: number;
  from_inspections: number;

  incidents: number;
  open_incidents: number;
  reportable: number;
  awaiting_hse_report: number;
  hse_report_overdue: number;
  lost_time: number;
  near_misses: number;

  action_plans: number;
  plans_in_progress: number;
  plans_overdue: number;
  plan_templates: number;
}

/* ------------------------------------------ meetings and correspondence */

export type MeetingStatus = "scheduled" | "held" | "cancelled";
export type MeetingType =
  | "pre_construction"
  | "coordination"
  | "oac"
  | "progress"
  | "pre_install"
  | "safety"
  | "handover"
  | "other";

export interface MeetingItem {
  id: string;
  sequence: number;
  topic: string;
  discussion: string | null;
  is_action: boolean;
  owner_id: string | null;
  due_on: string | null;
  completed_on: string | null;
  carried_from_id: string | null;
  is_open_action: boolean;
  is_overdue: boolean;
}

export interface Meeting {
  id: string;
  job_id: string | null;
  title: string;
  meeting_type: MeetingType;
  meeting_date: string | null;
  location: string | null;
  attendees: string | null;
  status: MeetingStatus;
  notes: string | null;
  chaired_by_id: string | null;
  previous_meeting_id: string | null;
  item_count: number;
  open_actions: number;
  overdue_actions: number;
  items: MeetingItem[];
}

export interface MeetingSummary {
  meetings: number;
  scheduled: number;
  held: number;
  open_actions: number;
  overdue_actions: number;
  correspondence: number;
  awaiting_response: number;
  overdue_correspondence: number;
  by_type: Record<string, number>;
}

export interface Correspondence {
  id: string;
  job_id: string | null;
  subject: string;
  body: string | null;
  kind: string;
  direction: string;
  vendor_id: string | null;
  buyer_id: string | null;
  author_id: string | null;
  occurred_on: string | null;
  requires_response: boolean;
  response_due: string | null;
  responded_on: string | null;
  is_awaiting_response: boolean;
  is_overdue: boolean;
}

/* --------------------------------------------- timecards & productivity */

export interface Timecard {
  id: string;
  job_id: string;
  cost_code_id: string | null;
  vendor_id: string | null;
  task_id: string | null;
  worked_on: string;
  worker_name: string;
  hours: string;
  overtime_hours: string;
  total_hours: string;
  hourly_rate: string | null;
  /** Null, not zero, when no rate is known. Zero would claim the work was free. */
  labour_cost: string | null;
  notes: string | null;
  entered_by_id: string | null;
  approved_on: string | null;
  approved_by_id: string | null;
  is_approved: boolean;
}

export interface ProductivityRow {
  cost_code_id: string | null;
  cost_code: string;
  cost_code_name: string;
  hours: string;
  labour_cost: string;
  entries: number;
  /** Hours booked with no rate. Their cost is unknown, not nought. */
  unrated_hours: string;
  /** Hours nobody has signed off yet. */
  pending_hours: string;

  /** What the home was supposed to take. Null where no target was set. */
  budgeted_hours: string | null;
  budgeted_cost: string | null;
  /** Positive is over. Null where there is no target to be over. */
  hours_variance: string | null;
  cost_variance: string | null;
  /** Over the hours that have a rate, not over all of them. */
  average_rate: string | null;
}

export interface ProductivityReport {
  job_id: string | null;
  total_hours: string;
  total_labour_cost: string;
  overtime_hours: string;
  unrated_hours: string;
  pending_hours: string;
  average_rate: string | null;
  budgeted_hours: string | null;
  budgeted_cost: string | null;
  hours_variance: string | null;
  cost_variance: string | null;
  rows: ProductivityRow[];
}

export interface WorkerRow {
  worker_name: string;
  hours: string;
  overtime_hours: string;
  labour_cost: string;
  unrated_hours: string;
  entries: number;
  days_on_site: number;
  average_day: string | null;
  average_rate: string | null;
  vendor_id: string | null;
  /** More than one usually means two people with the same name. */
  vendor_count: number;
}

export interface VendorLabourRow {
  vendor_id: string | null;
  hours: string;
  overtime_hours: string;
  labour_cost: string;
  unrated_hours: string;
  entries: number;
  workers: number;
  average_rate: string | null;
  /** A trade at a third overtime is short-handed or billing you for being. */
  overtime_share: string | null;
}

export interface LabourSummary {
  entries: number;
  workers: number;
  pending_approval: number;
  unrated_entries: number;

  total_hours: string;
  total_labour_cost: string;
  overtime_hours: string;
  unrated_hours: string;
  pending_hours: string;
  average_rate: string | null;
  budgeted_hours: string | null;
  hours_variance: string | null;
  cost_variance: string | null;
}

export interface ApprovalResult {
  approved: Timecard[];
  skipped: { timecard_id: string; reason: string }[];
}

/* ========================================================================== */
/* Consolidated features — only possible with both halves of the system       */
/* ========================================================================== */

export interface ScorecardDimension {
  /** null means no history, and the dimension is left out of the composite. */
  score: number | null;
  sample: number;
  detail: string;
  provisional: boolean;
  facts: Record<string, unknown>;
}

export interface TradeScore {
  vendor_id: string;
  vendor_name: string;
  overall: number | null;
  /** A (80+) B (65+) C (50+) D; null with no history. */
  tier: "A" | "B" | "C" | "D" | null;
  /** Too little history to lean on the number. */
  provisional: boolean;
  evidence: number;
  /** Last month's overall, and the change since. Null before the second month. */
  last_month: number | null;
  change: number | null;
  dimensions: {
    schedule: ScorecardDimension;
    quality: ScorecardDimension;
    warranty: ScorecardDimension;
    safety: ScorecardDimension;
    responsiveness: ScorecardDimension;
    compliance: ScorecardDimension;
    billing: ScorecardDimension;
  };
}

export interface RFIChangeOrderResult {
  change_order_id: string;
  co_number: string;
  job_id: string;
  rfi_number: string;
  schedule_days: number;
  responsible_party: string;
  detail: string;
}

/** A task booked to a trade whose cover runs out before the work finishes. */
export interface CoverGap {
  task_id: string;
  task_name: string;
  job_id: string;
  scheduled_start: string | null;
  scheduled_finish: string;
  vendor_id: string;
  vendor_name: string;
  document_type: string;
  expires_on: string;
  days_uncovered: number;
  already_lapsed: boolean;
}
