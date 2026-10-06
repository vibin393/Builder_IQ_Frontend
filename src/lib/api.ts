/**
 * Typed client for the Corman CMS API.
 *
 * Tokens live in localStorage for now. Before production this should move to
 * httpOnly cookies - localStorage is readable by any injected script.
 */

import type {
  ActionPlan,
  RiddorCategory,
  SafetySummary,
  Severity,
  AwardResult,
  ActivityOutcome,
  ActivityType,
  AllowanceSummary,
  Bid,
  BidPackage,
  BidSummary,
  Budget,
  BulkAssignResult,
  BuildOption,
  CancellationReason,
  Campaign,
  CampaignPerformance,
  ChangeOrder,
  Community,
  CommunityInput,
  CommunityPhase,
  CommunityPlan,
  CommunityPortfolio,
  CommunityStatus,
  ComplianceCheck,
  Contract,
  Correspondence,
  CostCode,
  CostCodeStats,
  CostCodeSummary,
  CostType,
  CoverGap,
  CycleTimeReport,
  DailyLog,
  Dashboard,
  DesignAppointment,
  DocumentRecord,
  DocumentSummary,
  DrawingSet,
  DrawingsSummary,
  DuplicateMatch,
  AccountingSettings,
  AccountingSummary,
  CISReturn,
  ExportBatch,
  ExportBatchDetail,
  ExportFormat,
  ExportKind,
  ExportQueue,
  NominalMapping,
  HoldReason,
  Holiday,
  HomeownerHome,
  FieldSummary,
  Incident,
  IncidentType,
  IntakeEvent,
  IntakeHealth,
  IntakeKind,
  IntakeSource,
  IntakeSourceCreated,
  Inspection,
  InspectionCheck,
  Invoice,
  InvoiceSummary,
  Job,
  JobCostSummary,
  JobCycleTime,
  JobMarginReport,
  JobSummary,
  JobTask,
  LandBudgetLine,
  LandObligation,
  LandPhaseStatus,
  LandProject,
  LandProjectInput,
  LandSummary,
  ObligationKind,
  Lead,
  LeadActivity,
  LeadDetail,
  LeadRating,
  LeadStatus,
  LeadSummary,
  Lot,
  LotInput,
  LotStatus,
  MarketingSummary,
  Meeting,
  MeetingSummary,
  Observation,
  ObservationType,
  OptionCostLine,
  OptionDetail,
  OptionInput,
  OptionPortfolio,
  OptionSelectionRow,
  Page,
  Plan,
  PlanCostLine,
  PlanElevation,
  PlanInput,
  PlanPortfolio,
  PlanPriceChange,
  PricingGuide,
  PortalIdentity,
  Prequalification,
  ComplianceSummary,
  ExpiringDocument,
  ProductivityReport,
  PunchItem,
  PunchSeverity,
  PurchaseOrder,
  PurchaseOrderSummary,
  Realtor,
  RealtorPerformance,
  RegisterPayload,
  ReplayResult,
  RFI,
  RFIChangeOrderResult,
  RFISummary,
  SalesPipeline,
  Satisfaction,
  ScheduleTemplate,
  ScheduleSummary,
  ScheduleTemplateTask,
  Selection,
  SelectionCascade,
  ServiceOrder,
  SignatureRequest,
  Specification,
  StudioSummary,
  Submittal,
  SubmittalSummary,
  Survey,
  SurveySummary,
  TaskCompletion,
  Timecard,
  WorkerRow,
  VendorLabourRow,
  LabourSummary,
  ApprovalResult,
  TokenPair,
  TradeScore,
  Transmittal,
  User,
  UserSummary,
  TradeOverview,
  TradeRow,
  TradesSummary,
  Vendor,
  VendorContact,
  WarrantyByTrade,
  WarrantyRequest,
  WarrantyAppointment,
  WarrantyNote,
  WarrantySummary,
  WarrantyCoverage,
} from "@/types/api";

/** Which lead queue to read, and how to narrow it. */
/** Which home queue to read, and how to narrow it. */
export type JobQuery = {
  view?: "all" | "live" | "building" | "late";
  status?: string;
  community_id?: string;
  plan_id?: string;
  superintendent_id?: string;
  search?: string;
  page?: number;
  size?: number;
};

export type LeadQuery = {
  view?: "all" | "open" | "overdue" | "unassigned";
  status?: string;
  source?: string;
  rating?: string;
  assigned_to_id?: string;
  community_id?: string;
  realtor_id?: string;
  search?: string;
  page?: number;
  size?: number;
  include_archived?: boolean;
};

/** Everything the capture form and the edit form can send. */
export type LeadInput = Partial<Omit<Lead, "id" | "full_name" | "is_open" | "follow_up_overdue">> & {
  address?: string;
  postcode?: string;
  best_time_to_call?: string;
  referred_by?: string;
  lender_name?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8400";
const API_PREFIX = "/api/v1";

const ACCESS_KEY = "corman_access_token";
const REFRESH_KEY = "corman_refresh_token";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  set(tokens: TokenPair) {
    try {
      window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
      window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    } catch {
      /* private mode or blocked storage */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* nothing to do */
    }
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const token = tokenStore.access;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${API_PREFIX}${path}`, { ...init, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail =
        typeof body.detail === "string"
          ? body.detail
          : Array.isArray(body.detail)
            ? body.detail.map((d: { msg: string }) => d.msg).join(", ")
            : detail;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(detail, res.status);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/**
 * Fetch a file with the session's token and hand it to the browser as a download.
 * An <a href> to the API would be sent without the bearer token and come back 401.
 */
async function downloadFile(path: string): Promise<string> {
  const headers = new Headers();
  const token = tokenStore.access;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${API_PREFIX}${path}`, { headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const payload = await res.json();
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      /* no JSON body */
    }
    throw new ApiError(detail, res.status);
  }
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "");
  const filename = match?.[1] ?? "export.csv";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
/** PUT, for the routes that replace a set outright rather than merging into one. */
const put = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });
/** DELETE. Often 204 with no body (which `request` handles); some routes return the
    updated parent, so callers may supply the response type. */
const del = <T = void>(path: string) => request<T>(path, { method: "DELETE" });

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : "";
}

export const api = {
  /* ---------------------------------------------------------------- auth */
  register: (payload: RegisterPayload) => post<TokenPair>("/auth/register", payload),
  login: (email: string, password: string) => post<TokenPair>("/auth/login", { email, password }),
  me: () => get<User>("/auth/me"),

  /* --------------------------------------------------------------- users */
  listUsers: (page = 1, size = 50, filters: { search?: string; role?: string; active?: boolean } = {}) =>
    get<Page<User>>(`/users${qs({ page, size, ...filters })}`),
  usersSummary: () => get<UserSummary>("/users/summary"),
  createUser: (body: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    job_title?: string;
    phone?: string;
  }) => post<User>("/users", body),
  /** Only an owner grants or removes owner; nobody changes their own role or access. */
  updateUser: (id: string, body: { full_name?: string; role?: string; is_active?: boolean; job_title?: string | null; phone?: string | null }) =>
    patch<User>(`/users/${id}`, body),
  resetUserPassword: (id: string, newPassword: string) =>
    post<{ detail: string }>(`/users/${id}/reset-password`, { new_password: newPassword }),

  /* ------------------------------------------------------- own profile */
  updateProfile: (body: { full_name?: string; job_title?: string; phone?: string }) =>
    patch<User>("/users/me", body),

  /** Multipart upload — deliberately not routed through `request`, which sets
      a JSON content type and would break the boundary header. */
  uploadAvatar: async (file: File): Promise<User> => {
    const body = new FormData();
    body.append("file", file);

    const headers = new Headers();
    const token = tokenStore.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${API_URL}${API_PREFIX}/users/me/avatar`, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const payload = await res.json();
        if (typeof payload.detail === "string") detail = payload.detail;
      } catch {
        /* no JSON body */
      }
      throw new ApiError(detail, res.status);
    }
    return (await res.json()) as User;
  },

  removeAvatar: () => request<User>("/users/me/avatar", { method: "DELETE" }),

  changePassword: (current_password: string, new_password: string) =>
    post<{ detail: string }>("/users/me/password", { current_password, new_password }),

  /* ------------------------------------------------------------- catalog */
  listCostCodes: () => get<CostCode[]>("/cost-codes"),
  createCostCode: (body: { code: string; name: string; division?: string; cost_type?: CostType | null; gl_account?: string | null }) =>
    post<CostCode>("/cost-codes", body),
  /** Paged, server-side search; archived codes only when asked for. */
  searchCostCodes: (params: { search?: string; page?: number; size?: number; include_archived?: boolean } = {}) =>
    get<Page<CostCode>>(`/cost-codes/search${qs({ ...params, include_archived: params.include_archived || undefined })}`),
  updateCostCode: (
    id: string,
    body: { code?: string; name?: string; division?: string | null; is_active?: boolean; cost_type?: CostType | null; gl_account?: string | null },
  ) => patch<CostCode>(`/cost-codes/${id}`, body),
  /** Refused while anything still prices, commits or spends against the code. */
  archiveCostCode: (id: string, reason?: string) => post<CostCode>(`/cost-codes/${id}/archive`, { reason: reason || null }),
  restoreCostCode: (id: string) => post<CostCode>(`/cost-codes/${id}/restore`),
  costCodeStats: () => get<Record<string, CostCodeStats>>("/cost-codes/stats"),
  costCodeSummary: () => get<CostCodeSummary>("/cost-codes/summary"),
  costCodeUsage: (id: string) => get<{ where: string; count: number }[]>(`/cost-codes/${id}/usage`),
  importCostCodes: (rows: { code: string; name: string; division?: string; cost_type?: CostType; gl_account?: string }[]) =>
    post<{ created: number; skipped: string[] }>("/cost-codes/import", { rows }),

  listVendors: () => get<Vendor[]>("/vendors"),
  createVendor: (body: Partial<Vendor> & { code: string; name: string }) =>
    post<Vendor>("/vendors", body),
  updateVendor: (id: string, body: Partial<Omit<Vendor, "id">>) =>
    patch<Vendor>(`/vendors/${id}`, body),
  /** Refused while the trade still holds open purchase orders. */
  archiveVendor: (id: string, reason?: string) => post<Vendor>(`/vendors/${id}/archive`, { reason: reason || null }),
  restoreVendor: (id: string) => post<Vendor>(`/vendors/${id}/restore`),
  tradesDirectory: (params: { include_archived?: boolean; cost_code_id?: string; search?: string } = {}) =>
    get<TradeRow[]>(`/trades/directory${qs({ ...params, include_archived: params.include_archived || undefined })}`),
  tradesSummary: () => get<TradesSummary>("/trades/summary"),
  tradeOverview: (id: string) => get<TradeOverview>(`/trades/${id}/overview`),
  addVendorContact: (id: string, body: { name: string; role?: string; email?: string; phone?: string; is_primary?: boolean }) =>
    post<VendorContact>(`/trades/${id}/contacts`, body),
  updateVendorContact: (
    id: string,
    body: { name?: string; role?: string | null; email?: string | null; phone?: string | null; is_primary?: boolean },
  ) => patch<VendorContact>(`/vendor-contacts/${id}`, body),
  deleteVendorContact: (id: string) => del(`/vendor-contacts/${id}`),
  setVendorSpecialisms: (id: string, costCodeIds: string[]) =>
    put<{ id: string; code: string; name: string }[]>(`/trades/${id}/specialisms`, { cost_code_ids: costCodeIds }),

  listCommunities: (status?: CommunityStatus) =>
    get<Community[]>(`/communities${qs({ status })}`),
  communityPortfolio: () => get<CommunityPortfolio>("/communities/summary"),
  getCommunity: (id: string) => get<Community>(`/communities/${id}`),
  createCommunity: (body: CommunityInput & { code: string; name: string }) =>
    post<Community>("/communities", body),
  updateCommunity: (id: string, body: CommunityInput) => patch<Community>(`/communities/${id}`, body),

  listPhases: (communityId: string) => get<CommunityPhase[]>(`/communities/${communityId}/phases`),
  createPhase: (communityId: string, body: { name: string; planned_release?: string; notes?: string }) =>
    post<CommunityPhase>(`/communities/${communityId}/phases`, body),
  updatePhase: (id: string, body: { name?: string; sequence?: number; planned_release?: string | null; notes?: string | null }) =>
    patch<CommunityPhase>(`/phases/${id}`, body),
  deletePhase: (id: string) => del(`/phases/${id}`),
  /** Every unreleased plot in the phase goes on sale. */
  releasePhase: (id: string) => post<CommunityPhase>(`/phases/${id}/release`),

  communityPlans: (communityId: string) => get<CommunityPlan[]>(`/communities/${communityId}/plans`),
  setCommunityPlan: (communityId: string, body: { plan_id: string; base_price?: string | null; is_active?: boolean }) =>
    put<CommunityPlan[]>(`/communities/${communityId}/plans`, body),
  removeCommunityPlan: (communityId: string, planId: string) =>
    del<CommunityPlan[]>(`/communities/${communityId}/plans/${planId}`),

  /** `buildable` leaves out plots that already have a live home on them. */
  listLots: (communityId: string, params: { status?: LotStatus; phase_id?: string; buildable?: boolean } = {}) =>
    get<Lot[]>(`/communities/${communityId}/lots${qs({ ...params, buildable: params.buildable || undefined })}`),
  createLot: (communityId: string, body: LotInput & { lot_number: string }) =>
    post<Lot>(`/communities/${communityId}/lots`, body),
  bulkCreateLots: (
    communityId: string,
    body: { start: number; end: number; prefix?: string; phase_id?: string; premium?: string; status?: "available" | "not_released"; postcode?: string },
  ) => post<{ created: number; skipped: string[] }>(`/communities/${communityId}/lots/bulk`, body),
  updateLot: (id: string, body: LotInput) => patch<Lot>(`/lots/${id}`, body),
  releaseLot: (id: string) => post<Lot>(`/lots/${id}/release`),
  withdrawLot: (id: string) => post<Lot>(`/lots/${id}/withdraw`),
  holdLot: (id: string, body: { until: string; reason?: string; lead_id?: string }) =>
    post<Lot>(`/lots/${id}/hold`, body),
  unholdLot: (id: string) => post<Lot>(`/lots/${id}/unhold`),

  listPlans: (active?: boolean) => get<Plan[]>(`/plans${qs({ active })}`),
  planPortfolio: () => get<PlanPortfolio>("/plans/summary"),
  getPlan: (id: string) => get<Plan>(`/plans/${id}`),
  createPlan: (body: PlanInput & { code: string; name: string }) => post<Plan>("/plans", body),
  /** A price change is logged with `price_reason`; it only reaches homes sold after it. */
  updatePlan: (id: string, body: PlanInput) => patch<Plan>(`/plans/${id}`, body),
  archivePlan: (id: string) => post<Plan>(`/plans/${id}/archive`),
  restorePlan: (id: string) => post<Plan>(`/plans/${id}/restore`),
  copyPlan: (id: string, body: { code: string; name: string }) => post<Plan>(`/plans/${id}/copy`, body),
  planPriceHistory: (id: string) => get<PlanPriceChange[]>(`/plans/${id}/price-history`),
  planPricing: (id: string, params: { community_id?: string; elevation?: string; lot_id?: string } = {}) =>
    get<PricingGuide>(`/plans/${id}/pricing${qs(params)}`),

  listPlanCostLines: (planId: string) => get<PlanCostLine[]>(`/plans/${planId}/cost-lines`),
  addPlanCostLine: (
    planId: string,
    body: { cost_code_id: string; amount: string; labour_hours?: string; vendor_id?: string; description?: string },
  ) => post<PlanCostLine>(`/plans/${planId}/cost-lines`, body),
  updatePlanCostLine: (
    id: string,
    body: { amount?: string; labour_hours?: string | null; vendor_id?: string | null; description?: string | null },
  ) => patch<PlanCostLine>(`/plan-cost-lines/${id}`, body),
  deletePlanCostLine: (id: string) => del(`/plan-cost-lines/${id}`),

  listElevations: (planId: string) => get<PlanElevation[]>(`/plans/${planId}/elevations`),
  createElevation: (planId: string, body: { code: string; name: string; price_adjustment?: string; description?: string }) =>
    post<PlanElevation>(`/plans/${planId}/elevations`, body),
  updateElevation: (
    id: string,
    body: { code?: string; name?: string; price_adjustment?: string; description?: string | null; is_active?: boolean },
  ) => patch<PlanElevation>(`/plan-elevations/${id}`, body),
  deleteElevation: (id: string) => del(`/plan-elevations/${id}`),

  /** `plan_id` keeps to options that can go on that house type. */
  listOptions: (params: { category?: string; active?: boolean; search?: string; plan_id?: string } = {}) =>
    get<BuildOption[]>(`/options${qs(params)}`),
  optionPortfolio: () => get<OptionPortfolio>("/options/summary"),
  getOption: (id: string) => get<OptionDetail>(`/options/${id}`),
  createOption: (body: OptionInput & { code: string; name: string }) => post<OptionDetail>("/options", body),
  updateOption: (id: string, body: OptionInput) => patch<OptionDetail>(`/options/${id}`, body),
  archiveOption: (id: string) => post<OptionDetail>(`/options/${id}/archive`),
  restoreOption: (id: string) => post<OptionDetail>(`/options/${id}/restore`),
  copyOption: (id: string, body: { code: string; name: string }) => post<OptionDetail>(`/options/${id}/copy`, body),
  setOptionPlans: (id: string, planIds: string[]) => put<OptionDetail>(`/options/${id}/plans`, { plan_ids: planIds }),
  optionPriceHistory: (id: string) => get<PlanPriceChange[]>(`/options/${id}/price-history`),
  optionSelections: (id: string) => get<OptionSelectionRow[]>(`/options/${id}/selections`),
  addOptionCostLine: (
    optionId: string,
    body: { cost_code_id: string; amount: string; vendor_id?: string; description?: string },
  ) => post<OptionCostLine>(`/options/${optionId}/cost-lines`, body),
  updateOptionCostLine: (id: string, body: { amount?: string; vendor_id?: string | null; description?: string | null }) =>
    patch<OptionCostLine>(`/option-cost-lines/${id}`, body),
  deleteOptionCostLine: (id: string) => del(`/option-cost-lines/${id}`),

  /* ---------------------------------------------------------------- jobs */
  /**
   * Homes, paged. `view` picks a queue rather than a filter: "late" and
   * "building" are computed server-side, because "late" means a comparison
   * against a frozen baseline and that definition belongs with the rules.
   */
  listJobs: (params: JobQuery = {}) => {
    const { view, ...rest } = params;
    const path = view && view !== "all" ? `/jobs/${view}` : "/jobs";
    return get<Page<Job>>(`${path}${qs(rest)}`);
  },
  /**
   * Every home, flat, for filling a picker.
   *
   * Separate from `listJobs` because a dropdown missing half its options is worse
   * than a slow one, and because a caller that wants a picker should say so
   * rather than passing a large page size and hoping.
   */
  jobOptions: () => get<Page<Job>>("/jobs?size=200").then((p) => p.items),
  jobSummary: () => get<JobSummary>("/jobs/summary"),
  /** Start to completion, over homes that actually finished. */
  jobCycleTime: () => get<JobCycleTime>("/jobs/cycle-time"),
  getJob: (id: string) => get<Job>(`/jobs/${id}`),

  assignSuperintendent: (id: string, superintendent_id: string | null) =>
    post<Job>(`/jobs/${id}/superintendent`, { superintendent_id }),

  /* The lifecycle. Named routes rather than a settable status, so no caller can
     move a home somewhere the rules would not allow. */
  applyForPermit: (id: string, body: { permit_number?: string; permit_applied_on?: string }) =>
    post<Job>(`/jobs/${id}/permit/apply`, body),
  permitIssued: (id: string, body: { number: string; issued_on?: string }) =>
    post<Job>(`/jobs/${id}/permit/issued`, body),
  /** Freezes the projection that slip is measured against. */
  startBuild: (
    id: string,
    body: { start_date?: string; projected_completion?: string; allow_unsold?: boolean } = {},
  ) => post<Job>(`/jobs/${id}/start`, body),
  holdBuild: (id: string, body: { reason: HoldReason; note?: string }) =>
    post<Job>(`/jobs/${id}/hold`, body),
  resumeBuild: (id: string) => post<Job>(`/jobs/${id}/resume`),
  completeBuild: (id: string, body: { completed_on?: string } = {}) =>
    post<Job>(`/jobs/${id}/complete`, body),
  /** Clears the completion date - it was not finished after all. */
  reopenBuild: (id: string, reason: string) => post<Job>(`/jobs/${id}/reopen`, { reason }),
  closeJob: (id: string, body: { closing_date?: string; warranty_months?: number } = {}) =>
    post<Job>(`/jobs/${id}/close`, body),
  enterWarranty: (id: string) => post<Job>(`/jobs/${id}/warranty`),
  /** Frees the plot so a new home can be started on it. */
  cancelJob: (id: string, body: { reason: CancellationReason; note?: string }) =>
    post<Job>(`/jobs/${id}/cancel`, body),
  createJob: (body: {
    community_id: string;
    lot_id: string;
    plan_id: string;
    start_date?: string;
    projected_completion?: string;
  }) => post<Job>("/jobs", body),
  updateJob: (id: string, body: Partial<Job>) => patch<Job>(`/jobs/${id}`, body),

  getContract: (jobId: string) => get<Contract>(`/jobs/${jobId}/contract`),
  createContract: (
    jobId: string,
    body: {
      buyer: { first_name: string; last_name: string; email?: string; phone?: string };
      base_price: string;
      lot_premium?: string;
      incentives?: string;
    },
  ) => post<Contract>(`/jobs/${jobId}/contract`, body),
  signContract: (jobId: string) => post<Contract>(`/jobs/${jobId}/contract/sign`),

  getBudget: (jobId: string) => get<Budget>(`/jobs/${jobId}/budget`),
  generateBudget: (jobId: string) => post<Budget>(`/jobs/${jobId}/budget`),

  listSelections: (jobId: string) => get<Selection[]>(`/jobs/${jobId}/selections`),
  addSelection: (jobId: string, body: { option_id: string; quantity?: number }) =>
    post<Selection>(`/jobs/${jobId}/selections`, body),
  confirmSelection: (jobId: string, selectionId: string) =>
    post<SelectionCascade>(`/jobs/${jobId}/selections/${selectionId}/confirm`),
  cancelSelection: (jobId: string, selectionId: string) =>
    post<{ selection_id: string; reversed: boolean }>(
      `/jobs/${jobId}/selections/${selectionId}/cancel`,
    ),

  jobCost: (jobId: string) => get<JobCostSummary>(`/jobs/${jobId}/cost`),

  /* -------------------------------------------------------- change orders */
  listChangeOrders: (jobId: string) => get<ChangeOrder[]>(`/jobs/${jobId}/change-orders`),
  createChangeOrder: (
    jobId: string,
    body: {
      description: string;
      reason?: string;
      responsible_party: string;
      price_delta: string;
      schedule_days: number;
      cost_lines: { cost_code_id: string; amount: string }[];
    },
  ) => post<ChangeOrder>(`/jobs/${jobId}/change-orders`, body),
  approveChangeOrder: (jobId: string, coId: string) =>
    post<Record<string, unknown>>(`/jobs/${jobId}/change-orders/${coId}/approve`),
  rejectChangeOrder: (jobId: string, coId: string) =>
    post<ChangeOrder>(`/jobs/${jobId}/change-orders/${coId}/reject`),

  /* ------------------------------------------------------------ schedule */

  getSchedule: (jobId: string) => get<JobTask[]>(`/jobs/${jobId}/schedule`),
  /** Committed, drafts, open, late, billed-to-date and overrides on record. */
  purchaseOrderSummary: () => get<PurchaseOrderSummary>("/purchase-orders/summary"),
  listPurchaseOrders: (
    params: { job_id?: string; vendor_id?: string; status?: string; overdue_only?: boolean } = {},
  ) => get<PurchaseOrder[]>(`/purchase-orders${qs(params)}`),
  getPurchaseOrder: (id: string) => get<PurchaseOrder>(`/purchase-orders/${id}`),
  createPurchaseOrder: (body: {
    job_id: string;
    vendor_id: string;
    lines: { cost_code_id: string; amount: string; description?: string }[];
    notes?: string;
    required_by?: string;
    /** Held back from every payment until the scope completes. 0 for materials. */
    retainage_percent?: string;
  }) => post<PurchaseOrder>("/purchase-orders", body),
  /** Edit a draft. Lines, when given, replace the draft's lines wholesale. */
  updatePurchaseOrder: (
    id: string,
    body: {
      notes?: string;
      required_by?: string;
      retainage_percent?: string;
      lines?: { cost_code_id: string; amount: string; description?: string }[];
    },
  ) => patch<PurchaseOrder>(`/purchase-orders/${id}`, body),
  /** Issue the PO. Overrides are recorded on the PO, with the reason. */
  issuePurchaseOrder: (
    id: string,
    opts: { allowOverBudget?: boolean; skipCompliance?: boolean; reason?: string } = {},
  ) =>
    post<PurchaseOrder>(
      `/purchase-orders/${id}/issue${qs({
        allow_over_budget: opts.allowOverBudget || undefined,
        skip_compliance: opts.skipCompliance || undefined,
        override_reason: opts.reason,
      })}`,
    ),
  acknowledgePurchaseOrder: (id: string) =>
    post<PurchaseOrder>(`/purchase-orders/${id}/acknowledge`),
  completePurchaseOrder: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/complete`),
  voidPurchaseOrder: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/void`),

  listInvoices: (
    params: { job_id?: string; vendor_id?: string; purchase_order_id?: string; status?: string } = {},
  ) => get<Invoice[]>(`/invoices${qs(params)}`),
  createInvoice: (body: {
    invoice_number: string;
    purchase_order_id: string;
    invoice_date?: string;
    lien_waiver_received?: boolean;
    lines: { cost_code_id: string; amount: string; purchase_order_line_id?: string }[];
    /** Unset inherits the purchase order's rate. */
    retainage_percent?: string;
    labour_amount?: string;
  }) => post<Invoice>("/invoices", body),
  invoiceSummary: () => get<InvoiceSummary>("/invoices/summary"),
  /** Refused above the PO unless overridden; the override and its reason go on the record. */
  approveInvoice: (id: string, opts: { allowOverPo?: boolean; reason?: string } = {}) =>
    post<Invoice>(
      `/invoices/${id}/approve${qs({
        allow_over_po: opts.allowOverPo || undefined,
        override_reason: opts.reason || undefined,
      })}`,
    ),
  /** Refused with no waiver on file. The reference is the BACS / cheque number. */
  payInvoice: (id: string, paymentReference?: string) =>
    post<Invoice>(`/invoices/${id}/pay${qs({ payment_reference: paymentReference || undefined })}`),
  recordLienWaiver: (id: string) => post<Invoice>(`/invoices/${id}/lien-waiver`),
  disputeInvoice: (id: string, reason: string) =>
    post<Invoice>(`/invoices/${id}/dispute`, { reason }),
  resolveInvoice: (id: string) => post<Invoice>(`/invoices/${id}/resolve`),
  voidInvoice: (id: string) => post<Invoice>(`/invoices/${id}/void`),

  /** Invoices still holding money back — the release queue at the end of a job. */
  retainageHeld: (jobId?: string) =>
    get<Invoice[]>(`/invoices/retainage/held${qs({ job_id: jobId })}`),
  releaseRetainage: (id: string) => post<Invoice>(`/invoices/${id}/release-retainage`),

  /* ----------------------------------------------------------------- crm */

  /**
   * Leads, paged. `view` picks a queue rather than a filter: "overdue" and
   * "unassigned" are computed server-side, because "open" means a specific set of
   * statuses and that definition belongs next to the rules that use it.
   */
  listLeads: (params: LeadQuery = {}) => {
    const { view, ...rest } = params;
    const path = view && view !== "all" ? `/leads/${view}` : "/leads";
    return get<Page<Lead>>(`${path}${qs(rest)}`);
  },
  leadSummary: () => get<LeadSummary>("/leads/summary"),
  getLead: (id: string) => get<LeadDetail>(`/leads/${id}`),
  createLead: (body: LeadInput & { first_name: string; last_name: string }) =>
    post<LeadDetail>("/leads", body),
  updateLead: (id: string, body: LeadInput) => patch<LeadDetail>(`/leads/${id}`, body),

  /** Advisory, never a block: the same family asking about two plans is real. */
  checkLeadDuplicates: (body: { email?: string; phone?: string; mobile?: string }) =>
    post<DuplicateMatch[]>("/leads/check-duplicates", body),
  leadDuplicates: (id: string) => get<DuplicateMatch[]>(`/leads/${id}/duplicates`),

  /** Refuses moves that skip qualification, and says what the legal next steps are. */
  setLeadStatus: (id: string, body: { status: LeadStatus; reason?: string; lost_to?: string }) =>
    post<LeadDetail>(`/leads/${id}/status`, body),
  assignLead: (id: string, assigned_to_id: string | null) =>
    post<LeadDetail>(`/leads/${id}/assign`, { assigned_to_id }),
  /** "I am picking this up" - one click, the commonest action on an unowned lead. */
  claimLead: (id: string) => post<LeadDetail>(`/leads/${id}/claim`),
  bulkAssignLeads: (lead_ids: string[], assigned_to_id: string | null) =>
    post<BulkAssignResult>("/leads/bulk-assign", { lead_ids, assigned_to_id }),
  setLeadFollowUp: (id: string, body: { next_follow_up: string; note?: string }) =>
    post<LeadDetail>(`/leads/${id}/follow-up`, body),
  setLeadRating: (id: string, rating: LeadRating) =>
    post<LeadDetail>(`/leads/${id}/rating`, { rating }),

  /** The reason is required: an unexplained loss teaches the business nothing. */
  markLeadLost: (id: string, body: { reason: string; lost_to?: string }) =>
    post<LeadDetail>(`/leads/${id}/lost`, body),
  reopenLead: (id: string, note?: string) => post<LeadDetail>(`/leads/${id}/reopen`, { note }),
  convertLead: (id: string) => post<LeadDetail>(`/leads/${id}/convert`),
  archiveLead: (id: string, reason?: string) =>
    post<LeadDetail>(`/leads/${id}/archive`, { reason }),
  restoreLead: (id: string) => post<LeadDetail>(`/leads/${id}/restore`),

  listLeadActivities: (id: string) => get<LeadActivity[]>(`/leads/${id}/activities`),
  /** Logging the call and booking the next one is one action, so one request. */
  logLeadActivity: (
    id: string,
    body: {
      activity_type: ActivityType;
      summary: string;
      occurred_on?: string;
      outcome?: ActivityOutcome;
      next_follow_up?: string;
    },
  ) => post<LeadActivity>(`/leads/${id}/activities`, body),

  listRealtors: () => get<Realtor[]>("/realtors"),
  realtorPerformance: () => get<RealtorPerformance[]>("/realtors/performance"),
  createRealtor: (body: { code: string; name: string } & Partial<Realtor>) =>
    post<Realtor>("/realtors", body),
  updateRealtor: (id: string, body: Partial<Realtor>) => patch<Realtor>(`/realtors/${id}`, body),
  archiveRealtor: (id: string, reason?: string) =>
    post<Realtor>(`/realtors/${id}/archive`, { reason }),
  restoreRealtor: (id: string) => post<Realtor>(`/realtors/${id}/restore`),

  /* -------------------------------------------------------------- intake */

  /** Is every channel still delivering, and is anything stuck. */
  intakeHealth: () => get<IntakeHealth>("/intake/health"),
  listIntakeSources: () => get<IntakeSource[]>("/intake/sources"),
  /** The response carries the key. It is stored hashed, so this is the only time. */
  createIntakeSource: (body: {
    code: string;
    name: string;
    kind: IntakeKind;
    lead_source?: string;
    default_community_id?: string;
    default_campaign?: string;
    auto_assign?: boolean;
    honeypot_field?: string;
    rate_limit_per_minute?: number;
    field_map?: Record<string, string>;
  }) => post<IntakeSourceCreated>("/intake/sources", body),
  updateIntakeSource: (id: string, body: Partial<IntakeSource>) =>
    patch<IntakeSource>(`/intake/sources/${id}`, body),
  /** No grace period: the old key stops working the moment this returns. */
  rotateIntakeKey: (id: string) => post<IntakeSourceCreated>(`/intake/sources/${id}/rotate-key`),
  pauseIntakeSource: (id: string) => post<IntakeSource>(`/intake/sources/${id}/pause`),
  resumeIntakeSource: (id: string) => post<IntakeSource>(`/intake/sources/${id}/resume`),
  archiveIntakeSource: (id: string, reason?: string) =>
    post<IntakeSource>(`/intake/sources/${id}/archive`, { reason }),

  listIntakeEvents: (params: { status?: string; source_id?: string; page?: number; size?: number } = {}) =>
    get<Page<IntakeEvent>>(`/intake/events${qs(params)}`),
  /** Enquiries we received and could not read. Held, never dropped. */
  failedIntakeEvents: (params: { page?: number; size?: number } = {}) =>
    get<Page<IntakeEvent>>(`/intake/events/failed${qs(params)}`),
  /** Run a stored payload through the adapter again, after fixing the mapping. */
  replayIntakeEvent: (id: string) => post<ReplayResult>(`/intake/events/${id}/replay`),

  /* ------------------------------------------------------- design studio */

  studioSummary: () => get<StudioSummary>("/studio/summary"),

  /** What the buyer has left to spend. The number the studio turns on. */
  getAllowance: (jobId: string) => get<AllowanceSummary>(`/jobs/${jobId}/allowance`),
  setAllowance: (jobId: string, amount: string) =>
    post<AllowanceSummary>(`/jobs/${jobId}/allowance`, { amount }),

  listAppointments: (
    params: { status?: string; job_id?: string; consultant_id?: string; page?: number; size?: number } = {},
  ) => get<Page<DesignAppointment>>(`/appointments${qs(params)}`),
  getAppointment: (id: string) => get<DesignAppointment>(`/appointments/${id}`),
  bookAppointment: (body: {
    job_id: string;
    scheduled_for: string;
    consultant_id?: string;
    duration_minutes?: number;
    location?: string;
    structural_cutoff?: string;
    notes?: string;
  }) => post<DesignAppointment>("/appointments", body),
  /** Cancels the old booking and creates a new one pointing back at it. */
  rescheduleAppointment: (id: string, body: { scheduled_for: string; note?: string }) =>
    post<DesignAppointment>(`/appointments/${id}/reschedule`, body),
  completeAppointment: (id: string, note?: string) =>
    post<DesignAppointment>(`/appointments/${id}/complete`, { note }),
  markNoShow: (id: string, note?: string) =>
    post<DesignAppointment>(`/appointments/${id}/no-show`, { note }),
  cancelAppointment: (id: string, note?: string) =>
    post<DesignAppointment>(`/appointments/${id}/cancel`, { note }),
  /** Enforced, not decorative: structural options are refused after it. */
  setStructuralCutoff: (id: string, structural_cutoff: string) =>
    post<DesignAppointment>(`/appointments/${id}/cutoff`, { structural_cutoff }),

  listSignatures: (params: { status?: string; job_id?: string; page?: number; size?: number } = {}) =>
    get<Page<SignatureRequest>>(`/signatures${qs(params)}`),
  createSignatureRequest: (body: {
    job_id: string;
    document_kind?: string;
    document_name: string;
    signer_name: string;
    signer_email: string;
    expires_on?: string;
  }) => post<SignatureRequest>("/signatures", body),
  sendForSignature: (id: string) => post<SignatureRequest>(`/signatures/${id}/send`),
  /** Counted, so "we only sent it once" cannot be claimed against the record. */
  remindSignature: (id: string) => post<SignatureRequest>(`/signatures/${id}/remind`),
  markViewed: (id: string) => post<SignatureRequest>(`/signatures/${id}/viewed`),
  markSigned: (id: string) => post<SignatureRequest>(`/signatures/${id}/mark-signed`),
  declineSignature: (id: string, reason: string) =>
    post<SignatureRequest>(`/signatures/${id}/decline`, { reason }),
  voidSignature: (id: string, reason: string) =>
    post<SignatureRequest>(`/signatures/${id}/void`, { reason }),

  /* ----------------------------------------------------------- marketing */

  listCampaigns: (params: { status?: string; channel?: string; page?: number; size?: number } = {}) =>
    get<Page<Campaign>>(`/campaigns${qs(params)}`),
  marketingSummary: () => get<MarketingSummary>("/campaigns/summary"),
  /** Ordered by cost per sale, not by volume - the loudest campaign is rarely the best. */
  campaignPerformance: () => get<CampaignPerformance>("/campaigns/performance"),
  getCampaign: (id: string) => get<Campaign>(`/campaigns/${id}`),
  createCampaign: (body: {
    code: string;
    name: string;
    channel?: string;
    subject?: string;
    body?: string;
    budget?: string;
    cost?: string;
    community_id?: string;
    starts_on?: string;
    ends_on?: string;
    notes?: string;
  }) => post<Campaign>("/campaigns", body),
  updateCampaign: (id: string, body: Partial<Campaign>) => patch<Campaign>(`/campaigns/${id}`, body),
  /** Keeps the content and the budget, drops the results - they belong to the original. */
  duplicateCampaign: (id: string, code: string) =>
    post<Campaign>(`/campaigns/${id}/duplicate`, { code }),

  scheduleCampaign: (id: string, scheduled_for: string) =>
    post<Campaign>(`/campaigns/${id}/schedule`, { scheduled_for }),
  launchCampaign: (id: string, starts_on?: string) =>
    post<Campaign>(`/campaigns/${id}/launch`, { starts_on }),
  /** Checked against each other: more opens than sends means the numbers are wrong. */
  recordDelivery: (
    id: string,
    body: {
      sent_count?: number;
      opened_count?: number;
      clicked_count?: number;
      bounced_count?: number;
      unsubscribed_count?: number;
    },
  ) => post<Campaign>(`/campaigns/${id}/delivery`, body),
  recordCampaignCost: (id: string, cost: string) => post<Campaign>(`/campaigns/${id}/cost`, { cost }),
  completeCampaign: (id: string, ends_on?: string) =>
    post<Campaign>(`/campaigns/${id}/complete`, { ends_on }),
  cancelCampaign: (id: string, reason: string) =>
    post<Campaign>(`/campaigns/${id}/cancel`, { reason }),
  /** Links leads whose free-text tag matches this campaign's code. */
  attachLeads: (id: string) => post<{ attached: number }>(`/campaigns/${id}/attach-leads`),

  /* ------------------------------------------------------------ schedule */

  scheduleSummary: () => get<ScheduleSummary>("/schedule/summary"),
  /** What is due across every house — the question a superintendent asks. */
  lookahead: (params: { days?: number; vendor_id?: string; job_id?: string } = {}) =>
    get<JobTask[]>(`/schedule/lookahead${qs(params)}`),
  behindSchedule: (params: { vendor_id?: string; job_id?: string } = {}) =>
    get<JobTask[]>(`/schedule/behind${qs(params)}`),

  listScheduleTemplates: () => get<ScheduleTemplate[]>("/schedule-templates"),
  getScheduleTemplate: (id: string) => get<ScheduleTemplate>(`/schedule-templates/${id}`),
  createScheduleTemplate: (body: { code: string; name: string; plan_id?: string }) =>
    post<ScheduleTemplate>("/schedule-templates", body),
  updateScheduleTemplate: (id: string, body: Partial<ScheduleTemplate>) =>
    patch<ScheduleTemplate>(`/schedule-templates/${id}`, body),
  duplicateTemplate: (id: string, body: { code: string; name: string }) =>
    post<ScheduleTemplate>(`/schedule-templates/${id}/duplicate`, body),
  addTemplateTask: (
    templateId: string,
    body: {
      name: string;
      offset_days?: number;
      duration_days?: number;
      sequence?: number;
      vendor_id?: string;
      cost_code_id?: string;
      is_milestone?: boolean;
    },
  ) => post<ScheduleTemplateTask>(`/schedule-templates/${templateId}/tasks`, body),
  updateTemplateTask: (taskId: string, body: Partial<ScheduleTemplateTask>) =>
    patch<ScheduleTemplateTask>(`/schedule-templates/tasks/${taskId}`, body),
  deleteTemplateTask: (taskId: string) => del(`/schedule-templates/tasks/${taskId}`),
  /** Every task, exactly once — the sequence is what the ripple is built from. */
  reorderTemplate: (id: string, task_ids: string[]) =>
    post<ScheduleTemplate>(`/schedule-templates/${id}/reorder`, { task_ids }),

  generateSchedule: (jobId: string, body: { template_id: string; start?: string }) =>
    post<JobTask[]>(`/jobs/${jobId}/schedule`, body),
  jobSchedule: (jobId: string) => get<JobTask[]>(`/jobs/${jobId}/schedule`),

  startTask: (id: string, actual_start?: string) =>
    post<JobTask>(`/tasks/${id}/start`, { actual_start }),
  blockTask: (id: string, reason: string) => post<JobTask>(`/tasks/${id}/block`, { reason }),
  unblockTask: (id: string) => post<JobTask>(`/tasks/${id}/unblock`),
  skipTask: (id: string, reason: string) => post<JobTask>(`/tasks/${id}/skip`, { reason }),
  /** Pushes everything behind it by the slip. */
  completeTask: (id: string, actual_finish?: string) =>
    post<TaskCompletion>(`/tasks/${id}/complete`, { actual_finish }),
  rescheduleTask: (id: string, body: { scheduled_start: string; cascade?: boolean }) =>
    post<{ task_id: string; tasks_shifted: number }>(`/tasks/${id}/reschedule`, body),
  assignTaskTrade: (id: string, vendor_id: string | null) =>
    post<JobTask>(`/tasks/${id}/trade`, { vendor_id }),

  /** Days this builder does not work, beyond weekends. */
  listHolidays: () => get<Holiday[]>("/schedule/holidays"),
  addHoliday: (body: { on_date: string; name: string }) => post<Holiday>("/schedule/holidays", body),
  removeHoliday: (id: string) => del(`/schedule/holidays/${id}`),

  /* ------------------------------------------------------- field operations */

  fieldSummary: (jobId?: string) => get<FieldSummary>(`/field/summary${qs({ job_id: jobId })}`),

  listPunchItems: (
    params: { job_id?: string; status?: string; severity?: string; vendor_id?: string; page?: number; size?: number } = {},
  ) => get<Page<PunchItem>>(`/field/punch-items${qs(params)}`),
  /** Defects that stop this home being handed over. Cosmetic ones are excluded. */
  blockingHandover: (jobId: string) =>
    get<PunchItem[]>(`/field/punch-items/blocking${qs({ job_id: jobId })}`),
  createPunchItem: (body: {
    job_id: string;
    description: string;
    location?: string;
    severity?: PunchSeverity;
    vendor_id?: string;
    due_date?: string;
    from_walkthrough?: boolean;
  }) => post<PunchItem>("/field/punch-items", body),
  /**
   * Only the details. Status and ball-in-court are not settable here - they move
   * through the routes below, and the API refuses the field rather than dropping
   * it, so `Partial<PunchItem>` would have typed a 422 as valid.
   */
  updatePunchItem: (
    id: string,
    body: {
      description?: string;
      location?: string | null;
      severity?: PunchSeverity;
      cost_code_id?: string | null;
      due_date?: string | null;
    },
  ) => patch<PunchItem>(`/field/punch-items/${id}`, body),

  /** Assigning it is what lets the work be backcharged rather than absorbed. */
  assignPunch: (id: string, body: { vendor_id: string; due_date?: string }) =>
    post<PunchItem>(`/field/punch-items/${id}/assign`, body),
  /** The trade says it is done — a claim, not a conclusion. */
  submitPunch: (id: string, note?: string) =>
    post<PunchItem>(`/field/punch-items/${id}/submit`, { note }),
  /** Sign the fix off. The step that was missing. */
  verifyPunch: (id: string) => post<PunchItem>(`/field/punch-items/${id}/verify`),
  rejectPunch: (id: string, reason: string) =>
    post<PunchItem>(`/field/punch-items/${id}/reject`, { reason }),
  wontFixPunch: (id: string, reason: string) =>
    post<PunchItem>(`/field/punch-items/${id}/wont-fix`, { reason }),
  reopenPunch: (id: string, reason: string) =>
    post<PunchItem>(`/field/punch-items/${id}/reopen`, { reason }),

  listInspections: (
    params: { job_id?: string; result?: string; inspection_type?: string; page?: number; size?: number } = {},
  ) => get<Page<Inspection>>(`/field/inspections${qs(params)}`),
  createInspection: (body: {
    job_id: string;
    name: string;
    inspection_type?: string;
    scheduled_date?: string;
    inspector?: string;
    fee?: string;
  }) => post<Inspection>("/field/inspections", body),
  addInspectionItem: (
    inspectionId: string,
    body: { description: string; vendor_id?: string; sequence?: number },
  ) => post<InspectionCheck>(`/field/inspections/${inspectionId}/items`, body),
  /** A failure needs a note saying what to fix. */
  recordItemResult: (itemId: string, body: { result: string; notes?: string }) =>
    post<InspectionCheck>(`/field/inspections/items/${itemId}/result`, body),
  recordInspectionResult: (
    id: string,
    body: { result: string; failure_reason?: string; completed_date?: string; fee?: string },
  ) => post<Inspection>(`/field/inspections/${id}/result`, body),
  /** Retyping thirty failed checks is how three of them get missed. */
  punchFromFailures: (id: string) =>
    post<PunchItem[]>(`/field/inspections/${id}/punch-from-failures`),
  scheduleReinspection: (id: string, body: { scheduled_date: string; fee?: string }) =>
    post<Inspection>(`/field/inspections/${id}/reinspect`, body),

  listDailyLogs: (params: { job_id?: string; page?: number; size?: number } = {}) =>
    get<Page<DailyLog>>(`/field/daily-logs${qs(params)}`),
  /** An upsert: filing twice in a day adds to the entry rather than duplicating it. */
  createDailyLog: (body: {
    job_id: string;
    log_date?: string;
    weather?: string;
    crew_count?: number;
    trades_on_site?: string;
    work_performed?: string;
    delays?: string;
    notes?: string;
  }) => post<DailyLog>("/field/daily-logs", body),

  /* --------------------------------------------------- safety and quality */

  safetySummary: (jobId?: string) =>
    get<SafetySummary>(`/safety/summary${qs({ job_id: jobId })}`),

  listObservations: (
    params: {
      job_id?: string;
      status?: string;
      observation_type?: string;
      severity?: string;
      assigned_vendor_id?: string;
      page?: number;
      size?: number;
    } = {},
  ) => get<Page<Observation>>(`/observations${qs(params)}`),
  /** Everything still owed on one home, unpaged. */
  openObservations: (jobId: string) =>
    get<Observation[]>(`/observations/open${qs({ job_id: jobId })}`),
  createObservation: (body: {
    job_id: string;
    title: string;
    description?: string;
    location?: string;
    observation_type?: ObservationType;
    severity?: Severity;
    inspection_id?: string;
    assigned_vendor_id?: string;
    /** Left off, a date is derived from the severity. */
    due_on?: string;
  }) => post<Observation>("/observations", body),
  updateObservation: (
    id: string,
    body: {
      title?: string;
      description?: string | null;
      location?: string | null;
      observation_type?: ObservationType;
      severity?: Severity;
      assigned_vendor_id?: string | null;
      due_on?: string | null;
    },
  ) => patch<Observation>(`/observations/${id}`, body),

  assignObservation: (id: string, body: { vendor_id: string; due_on?: string }) =>
    post<Observation>(`/observations/${id}/assign`, body),
  /** The fix has been made - a claim, not a conclusion. */
  submitObservation: (id: string, resolution: string) =>
    post<Observation>(`/observations/${id}/submit`, { resolution }),
  /** Accept the fix. The only way an observation reaches closed. */
  closeObservation: (id: string) => post<Observation>(`/observations/${id}/close`),
  rejectObservation: (id: string, reason: string) =>
    post<Observation>(`/observations/${id}/reject`, { reason }),
  reopenObservation: (id: string, reason: string) =>
    post<Observation>(`/observations/${id}/reopen`, { reason }),

  listIncidents: (
    params: {
      job_id?: string;
      incident_type?: string;
      riddor_category?: string;
      page?: number;
      size?: number;
    } = {},
  ) => get<Page<Incident>>(`/incidents${qs(params)}`),
  /** Reportable incidents the HSE has not been told about. The list with a deadline. */
  incidentsAwaitingReport: () => get<Incident[]>("/incidents/awaiting-report"),
  createIncident: (body: {
    job_id: string;
    incident_type: IncidentType;
    title: string;
    occurred_on?: string;
    severity?: Severity;
    description?: string;
    location?: string;
    person_involved?: string;
    vendor_id?: string;
    lost_time?: boolean;
    medical_treatment?: boolean;
    immediate_action?: string;
    /** Left off, it is suggested from the facts. */
    riddor_category?: RiddorCategory;
  }) => post<Incident>("/incidents", body),
  /** What category this looks like, so the form can say what it is about to decide. */
  riddorSuggestion: (params: {
    incident_type: IncidentType;
    severity?: Severity;
    lost_time?: boolean;
    medical_treatment?: boolean;
  }) => get<RiddorCategory>(`/incidents/riddor-suggestion${qs(params)}`),
  classifyIncident: (id: string, riddor_category: RiddorCategory) =>
    post<Incident>(`/incidents/${id}/classify`, { riddor_category }),
  recordHseReport: (id: string, body: { reported_on?: string; reference?: string }) =>
    post<Incident>(`/incidents/${id}/hse-report`, body),
  recordRootCause: (id: string, root_cause: string) =>
    post<Incident>(`/incidents/${id}/root-cause`, { root_cause }),
  closeIncident: (id: string) => post<Incident>(`/incidents/${id}/close`),

  listActionPlans: (
    params: { job_id?: string; templates?: boolean; status?: string; page?: number; size?: number } = {},
  ) => get<Page<ActionPlan>>(`/action-plans${qs(params)}`),
  createActionPlan: (body: {
    name: string;
    description?: string;
    job_id?: string;
    due_on?: string;
    is_template?: boolean;
  }) => post<ActionPlan>("/action-plans", body),
  addActionPlanItem: (
    planId: string,
    body: {
      description: string;
      requires_signoff?: boolean;
      vendor_id?: string;
      due_on?: string;
      sequence?: number;
    },
  ) => post<ActionPlan>(`/action-plans/${planId}/items`, body),
  /** Copy a template onto a home. The steps are copied, not referenced. */
  startActionPlan: (templateId: string, body: { job_id: string; due_on?: string }) =>
    post<ActionPlan>(`/action-plans/${templateId}/start`, body),
  completeActionPlanItem: (planId: string, itemId: string, notes?: string) =>
    post<ActionPlan>(`/action-plans/${planId}/items/${itemId}/complete`, { notes }),
  /** Witness a step somebody else completed. Refused if you completed it. */
  signOffActionPlanItem: (planId: string, itemId: string) =>
    post<ActionPlan>(`/action-plans/${planId}/items/${itemId}/sign-off`),

  /* ------------------------------------------------------------ warranty */
  warrantySummary: () => get<WarrantySummary>("/warranty/summary"),
  warrantyCoverage: (jobId: string) =>
    get<WarrantyCoverage>(`/warranty/coverage${qs({ job_id: jobId })}`),
  listWarrantyRequests: (
    params: {
      job_id?: string;
      status?: string;
      priority?: string;
      category?: string;
      coverage?: string;
      overdue?: boolean;
    } = {},
  ) => get<WarrantyRequest[]>(`/warranty/requests${qs(params)}`),
  getWarrantyRequest: (id: string) => get<WarrantyRequest>(`/warranty/requests/${id}`),
  createWarrantyRequest: (body: {
    job_id: string;
    title: string;
    description?: string;
    location?: string;
    priority?: string;
    category?: string;
    reported_via?: string;
  }) => post<WarrantyRequest>("/warranty/requests", body),
  updateWarrantyRequest: (
    id: string,
    body: {
      title?: string;
      description?: string;
      location?: string;
      priority?: string;
      category?: string;
    },
  ) => patch<WarrantyRequest>(`/warranty/requests/${id}`, body),
  acknowledgeWarranty: (id: string) =>
    post<WarrantyRequest>(`/warranty/requests/${id}/acknowledge`),
  assessWarranty: (
    id: string,
    body: { coverage: string; assessment_notes?: string; decline_reason?: string },
  ) => post<WarrantyRequest>(`/warranty/requests/${id}/assess`, body),
  closeWarranty: (id: string) => post<WarrantyRequest>(`/warranty/requests/${id}/close`),
  dispatchServiceOrder: (
    requestId: string,
    body: {
      vendor_id?: string;
      cost_code_id?: string;
      instructions?: string;
      scheduled_date?: string;
      nte_amount?: string;
    },
  ) => post<ServiceOrder>(`/warranty/requests/${requestId}/service-orders`, body),
  completeServiceOrder: (
    orderId: string,
    opts: { resolution?: string; cost_amount?: string | number; back_charge?: boolean } = {},
  ) => post<ServiceOrder>(`/warranty/service-orders/${orderId}/complete${qs(opts)}`),
  cancelServiceOrder: (orderId: string) =>
    post<ServiceOrder>(`/warranty/service-orders/${orderId}/cancel`),
  bookWarrantyAppointment: (
    requestId: string,
    body: {
      kind?: string;
      scheduled_for: string;
      slot?: string;
      vendor_id?: string;
      assignee_id?: string;
      notes?: string;
    },
  ) => post<WarrantyAppointment>(`/warranty/requests/${requestId}/appointments`, body),
  updateWarrantyAppointment: (
    appointmentId: string,
    body: { status?: string; scheduled_for?: string; slot?: string; notes?: string; outcome?: string },
  ) => patch<WarrantyAppointment>(`/warranty/appointments/${appointmentId}`, body),
  addWarrantyNote: (requestId: string, body: { body: string; visibility?: string }) =>
    post<WarrantyNote>(`/warranty/requests/${requestId}/notes`, body),

  /* ----------------------------------------------------------- documents */
  listDocuments: (
    params: {
      job_id?: string;
      community_id?: string;
      plan_id?: string;
      vendor_id?: string;
      category?: string;
      status?: string;
      critical_only?: boolean;
      expiring_only?: boolean;
      expired_only?: boolean;
      search?: string;
    } = {},
  ) => get<DocumentRecord[]>(`/documents${qs(params)}`),
  /** The register board: totals, critical, expiring/expired, by category. */
  documentsSummary: (jobId?: string) =>
    get<DocumentSummary>(`/documents/summary${qs({ job_id: jobId })}`),
  createDocument: (body: {
    name: string;
    category: string;
    storage_key: string;
    reference?: string;
    issued_on?: string;
    expires_on?: string;
    job_id?: string;
    community_id?: string;
    plan_id?: string;
    vendor_id?: string;
    notes?: string;
  }) => post<DocumentRecord>("/documents", body),
  updateDocument: (
    id: string,
    body: {
      name?: string;
      category?: string;
      reference?: string;
      issued_on?: string;
      expires_on?: string;
      job_id?: string;
      notes?: string;
    },
  ) => patch<DocumentRecord>(`/documents/${id}`, body),
  /** Register the replacement version; the old one is kept as superseded. */
  supersedeDocument: (
    id: string,
    body: {
      storage_key: string;
      name?: string;
      reference?: string;
      issued_on?: string;
      expires_on?: string;
      notes?: string;
    },
  ) => post<DocumentRecord>(`/documents/${id}/supersede`, body),
  archiveDocument: (id: string) => post<DocumentRecord>(`/documents/${id}/archive`),
  restoreDocument: (id: string) => post<DocumentRecord>(`/documents/${id}/restore`),

  /* ----------------------------------------------------------- reporting */
  dashboard: (communityId?: string) =>
    get<Dashboard>(`/reports/dashboard${qs({ community_id: communityId })}`),
  salesPipeline: () => get<SalesPipeline>("/reports/sales-pipeline"),
  jobMargin: () => get<JobMarginReport>("/reports/job-margin"),
  cycleTime: () => get<CycleTimeReport>("/reports/cycle-time"),
  warrantyByTrade: () => get<WarrantyByTrade>("/reports/warranty-by-trade"),
  communitySummary: () =>
    get<{ communities: { community_id: string; code: string; name: string; jobs: number; sold_or_building: number }[] }>(
      "/reports/communities",
    ),

  /* -------------------------------------------------------- trade portal */
  portalMe: () => get<PortalIdentity>("/portal/me"),
  portalPurchaseOrders: () => get<PurchaseOrder[]>("/portal/purchase-orders"),
  portalAcknowledge: (id: string) => post<PurchaseOrder>(`/portal/purchase-orders/${id}/acknowledge`),
  portalSchedule: (days = 14) => get<JobTask[]>(`/portal/schedule${qs({ days })}`),
  portalServiceOrders: () => get<ServiceOrder[]>("/portal/service-orders"),

  /* -------------------------------------------------------------- bidding */
  /** The board: out for bid, awarded, overdue, coverage and savings. */
  bidSummary: () => get<BidSummary>("/bid-packages/summary"),
  listBidPackages: (params: { status?: string; overdue_only?: boolean } = {}) =>
    get<BidPackage[]>(`/bid-packages${qs(params)}`),
  getBidPackage: (id: string) => get<BidPackage>(`/bid-packages/${id}`),
  createBidPackage: (body: {
    name: string;
    cost_code_id: string;
    scope?: string;
    plan_id?: string;
    due_date?: string;
    estimate?: string;
  }) => post<BidPackage>("/bid-packages", body),
  updateBidPackage: (
    id: string,
    body: { name?: string; scope?: string; plan_id?: string; due_date?: string; estimate?: string },
  ) => patch<BidPackage>(`/bid-packages/${id}`, body),
  cancelBidPackage: (id: string) => post<BidPackage>(`/bid-packages/${id}/cancel`),
  inviteToBid: (id: string, vendorIds: string[]) =>
    post<BidPackage>(`/bid-packages/${id}/invite`, { vendor_ids: vendorIds }),
  submitBid: (pkgId: string, bidId: string, amount: string, notes?: string) =>
    post<Bid>(`/bid-packages/${pkgId}/bids/${bidId}/submit`, { amount, notes }),
  /** Record a trade's 'no bid'. */
  declineBid: (pkgId: string, bidId: string) =>
    post<Bid>(`/bid-packages/${pkgId}/bids/${bidId}/decline`),
  reviseBidPackage: (id: string) => post<BidPackage>(`/bid-packages/${id}/revise`),
  awardBid: (pkgId: string, bidId: string, jobId?: string) =>
    post<AwardResult>(`/bid-packages/${pkgId}/bids/${bidId}/award${qs({ job_id: jobId })}`),

  /* ------------------------------------------------------------- surveys */

  surveySummary: () => get<SurveySummary>("/surveys/summary"),
  listSurveys: (
    params: {
      job_id?: string;
      stage?: string;
      status?: string;
      band?: string;
      needs_follow_up?: boolean;
    } = {},
  ) => get<Survey[]>(`/surveys${qs(params)}`),
  sendSurvey: (body: { job_id: string; stage?: string }) => post<Survey>("/surveys", body),
  respondToSurvey: (
    id: string,
    body: {
      would_recommend: number;
      rating_sales?: number;
      rating_construction?: number;
      rating_quality?: number;
      rating_warranty?: number;
      rating_communication?: number;
      rating_value?: number;
      overall_satisfaction?: number;
      comments?: string;
    },
  ) => post<Survey>(`/surveys/${id}/respond`, body),
  remindSurvey: (id: string) => post<Survey>(`/surveys/${id}/remind`),
  declineSurvey: (id: string) => post<Survey>(`/surveys/${id}/decline`),
  followUpSurvey: (
    id: string,
    body: { follow_up_notes?: string; follow_up_done?: boolean; follow_up_owner_id?: string },
  ) => post<Survey>(`/surveys/${id}/follow-up`, body),

  /* --------------------------------------------------------- design studio */
  createSignature: (body: {
    job_id: string;
    document_kind: string;
    document_name: string;
    signer_name: string;
    signer_email: string;
  }) => post<SignatureRequest>("/signatures", body),
  sendSignature: (id: string) => post<SignatureRequest>(`/signatures/${id}/send`),

  /* ----------------------------------------------------- land development */
  listLandProjects: (status?: LandPhaseStatus) => get<LandProject[]>(`/land-projects${qs({ status })}`),
  landSummary: () => get<LandSummary>("/land-projects/summary"),
  getLandProject: (id: string) => get<LandProject>(`/land-projects/${id}`),
  createLandProject: (body: LandProjectInput & { code: string; name: string }) => post<LandProject>("/land-projects", body),
  /** Starting works is refused without a buildable permission and every pre-commencement condition discharged. */
  updateLandProject: (id: string, body: LandProjectInput) => patch<LandProject>(`/land-projects/${id}`, body),
  deliverPlots: (id: string, body: { start: number; end: number; prefix?: string; phase_id?: string; premium?: string }) =>
    post<LandProject>(`/land-projects/${id}/deliver-plots`, body),
  addLandBudgetLine: (id: string, body: { category: string; budget_amount: string; actual_amount?: string; vendor_id?: string; notes?: string }) =>
    post<LandProject>(`/land-projects/${id}/budget-lines`, body),
  updateLandBudgetLine: (
    id: string,
    body: { category?: string; budget_amount?: string; actual_amount?: string; vendor_id?: string | null; notes?: string | null },
  ) => patch<LandBudgetLine>(`/land-budget-lines/${id}`, body),
  deleteLandBudgetLine: (id: string) => del(`/land-budget-lines/${id}`),
  addLandObligation: (
    id: string,
    body: { kind: ObligationKind; description: string; reference?: string; trigger?: string; pre_commencement?: boolean; due_date?: string; amount?: string; notes?: string },
  ) => post<LandObligation>(`/land-projects/${id}/obligations`, body),
  updateLandObligation: (id: string, body: Partial<Omit<LandObligation, "id" | "project_id" | "is_overdue">>) =>
    patch<LandObligation>(`/land-obligations/${id}`, body),
  submitLandObligation: (id: string) => post<LandObligation>(`/land-obligations/${id}/submit`),
  completeLandObligation: (id: string, body: { completed_on?: string; waived?: boolean; notes?: string } = {}) =>
    post<LandObligation>(`/land-obligations/${id}/complete`, body),
  reopenLandObligation: (id: string) => post<LandObligation>(`/land-obligations/${id}/reopen`),
  deleteLandObligation: (id: string) => del(`/land-obligations/${id}`),

  /* ------------------------------------------------------------ accounting */
  accountingSummary: () => get<AccountingSummary>("/accounting/summary"),
  /** What the next batch of this kind would carry, as the journal it would post. */
  exportQueue: (kind: ExportKind, throughDate?: string) =>
    get<ExportQueue>(`/accounting/queue${qs({ kind, through_date: throughDate || undefined })}`),
  listExportBatches: (params: { kind?: ExportKind; status?: string } = {}) =>
    get<ExportBatch[]>(`/accounting/batches${qs(params)}`),
  getExportBatch: (id: string) => get<ExportBatchDetail>(`/accounting/batches/${id}`),
  createExportBatch: (body: { kind: ExportKind; through_date?: string; notes?: string }) =>
    post<ExportBatchDetail>("/accounting/batches", body),
  markBatchPosted: (id: string, ledgerReference?: string) =>
    post<ExportBatch>(`/accounting/batches/${id}/post`, { ledger_reference: ledgerReference || null }),
  voidExportBatch: (id: string, reason: string) =>
    post<ExportBatch>(`/accounting/batches/${id}/void`, { reason }),
  /** Authenticated download: a plain link would go without the bearer token and 401. */
  downloadExportBatch: (id: string, format?: ExportFormat) =>
    downloadFile(`/accounting/batches/${id}/download${qs({ format })}`),
  downloadSupplierMaster: () => downloadFile("/accounting/vendors.csv"),
  accountingSettings: () => get<AccountingSettings>("/accounting/settings"),
  updateAccountingSettings: (body: Partial<AccountingSettings>) =>
    patch<AccountingSettings>("/accounting/settings", body),
  nominalMapping: () => get<NominalMapping[]>("/accounting/mapping"),
  setNominalMapping: (rows: { cost_code_id: string; gl_account: string | null }[]) =>
    put<NominalMapping[]>("/accounting/mapping", rows),
  cisReturn: (period?: string) => get<CISReturn>(`/accounting/cis-return${qs({ period })}`),

  /* ------------------------------------------------- extra analytics */
  satisfaction: () => get<Satisfaction>("/reports/satisfaction"),

  /* ------------------------------------------------- homeowner portal */
  homeownerHome: () => get<HomeownerHome>("/homeowner/me"),
  homeownerWarranty: () => get<WarrantyRequest[]>("/homeowner/warranty"),
  homeownerSubmitClaim: (body: {
    job_id: string;
    title: string;
    description?: string;
    location?: string;
    priority?: string;
  }) => post<WarrantyRequest>("/homeowner/warranty", body),

  /* ------------------------------------------------- prequalification */
  /** The board: approved, would-be-refused, no record, missing cover, lapsing paperwork. */
  complianceSummary: () => get<ComplianceSummary>("/prequalification/summary"),
  listPrequalifications: () => get<Prequalification[]>("/prequalification"),
  createPrequalification: (body: {
    vendor_id: string;
    single_job_limit?: string;
    aggregate_limit?: string;
    review_due?: string;
    notes?: string;
  }) => post<Prequalification>("/prequalification", body),
  updatePrequalification: (
    id: string,
    body: {
      single_job_limit?: string;
      aggregate_limit?: string;
      review_due?: string;
      notes?: string;
    },
  ) => patch<Prequalification>(`/prequalification/${id}`, body),
  /** Ask the trade for their pack. */
  invitePrequalification: (id: string, body: { review_due?: string; note?: string } = {}) =>
    post<Prequalification>(`/prequalification/${id}/invite`, body),
  /** The trade has returned their pack. */
  submitPrequalification: (id: string) =>
    post<Prequalification>(`/prequalification/${id}/submit`),
  startPrequalificationReview: (id: string) =>
    post<Prequalification>(`/prequalification/${id}/start-review`),
  /** Approve outright, or conditionally with a cap or caveat. */
  approvePrequalification: (
    id: string,
    body: { conditional?: boolean; single_job_limit?: string; aggregate_limit?: string; note?: string } = {},
  ) => post<Prequalification>(`/prequalification/${id}/approve`, body),
  rejectPrequalification: (id: string, reason?: string) =>
    post<Prequalification>(`/prequalification/${id}/reject${qs({ reason })}`),
  /** Re-examine the record and push the annual review out a year. */
  renewPrequalificationReview: (id: string) =>
    post<Prequalification>(`/prequalification/${id}/renew-review`),
  removeComplianceDocument: (id: string, docId: string) =>
    del<Prequalification>(`/prequalification/${id}/documents/${docId}`),
  addComplianceDocument: (
    id: string,
    body: {
      document_type: string;
      reference?: string;
      issuer?: string;
      coverage_amount?: string;
      issued_on?: string;
      expires_on?: string;
    },
  ) => post<Prequalification>(`/prequalification/${id}/documents`, body),
  /** The chase list: trades whose paperwork lapses inside `withinDays`. */
  expiringCompliance: (withinDays = 30) =>
    get<ExpiringDocument[]>(`/prequalification/expiring${qs({ within_days: withinDays })}`),
  /** Scheduled work that runs past a trade's insurance expiry. */
  coverGaps: (jobId?: string) =>
    get<CoverGap[]>(`/prequalification/cover-gaps${qs({ job_id: jobId })}`),
  checkVendorCompliance: (vendorId: string) =>
    get<ComplianceCheck>(`/prequalification/check/${vendorId}`),

  /* ---------------------------------------------------------------- RFIs */
  listRFIs: (
    params: {
      job_id?: string;
      status?: string;
      ball_in_court?: string;
      priority?: string;
      category?: string;
      overdue_only?: boolean;
      blocking_only?: boolean;
    } = {},
  ) => get<RFI[]>(`/rfis${qs(params)}`),
  /** The analytics board: open, overdue, blocking, in-our-court, aging and breakdowns. */
  rfiSummary: (jobId?: string) => get<RFISummary>(`/rfis/summary${qs({ job_id: jobId })}`),
  getRFI: (id: string) => get<RFI>(`/rfis/${id}`),
  createRFI: (body: {
    job_id: string;
    subject: string;
    question: string;
    priority?: string;
    category?: string;
    assigned_vendor_id?: string;
    cost_code_id?: string;
    drawing_id?: string;
    location?: string;
    spec_reference?: string;
    due_on?: string;
    is_blocking?: boolean;
    ball_in_court?: string;
  }) => post<RFI>("/rfis", body),
  updateRFI: (
    id: string,
    body: {
      subject?: string;
      question?: string;
      status?: string;
      ball_in_court?: string;
      priority?: string;
      category?: string;
      location?: string;
      spec_reference?: string;
      assigned_vendor_id?: string;
      cost_code_id?: string;
      due_on?: string;
      is_blocking?: boolean;
    },
  ) => patch<RFI>(`/rfis/${id}`, body),
  /** Move the ball to another court, with an optional reason for the log. */
  reassignRFI: (id: string, body: { ball_in_court: string; note?: string }) =>
    post<RFI>(`/rfis/${id}/reassign`, body),
  /** Add a response to the thread. Marking it official records it as the answer. */
  addRFIResponse: (
    id: string,
    body: {
      body: string;
      court?: string;
      is_official?: boolean;
      cost_impact?: boolean;
      schedule_impact_days?: number;
    },
  ) => post<RFI>(`/rfis/${id}/responses`, body),
  answerRFI: (
    id: string,
    body: { answer: string; cost_impact?: boolean; schedule_impact_days?: number },
  ) => post<RFI>(`/rfis/${id}/answer`, body),
  closeRFI: (id: string) => post<RFI>(`/rfis/${id}/close`),
  reopenRFI: (id: string) => post<RFI>(`/rfis/${id}/reopen`),
  voidRFI: (id: string) => post<RFI>(`/rfis/${id}/void`),

  /* ---------------------------------------------------------- submittals */
  listSubmittals: (
    params: {
      job_id?: string;
      plan_id?: string;
      status?: string;
      ball_in_court?: string;
      type?: string;
      priority?: string;
      overdue_only?: boolean;
      at_risk_only?: boolean;
    } = {},
  ) => get<Submittal[]>(`/submittals${qs(params)}`),
  /** The register board: review queue, overdue, being revised, procurement at-risk. */
  submittalSummary: (jobId?: string) =>
    get<SubmittalSummary>(`/submittals/summary${qs({ job_id: jobId })}`),
  getSubmittal: (id: string) => get<Submittal>(`/submittals/${id}`),
  createSubmittal: (body: {
    title: string;
    job_id?: string;
    plan_id?: string;
    submittal_type?: string;
    priority?: string;
    description?: string;
    spec_section?: string;
    manufacturer?: string;
    model_number?: string;
    vendor_id?: string;
    cost_code_id?: string;
    option_id?: string;
    due_on?: string;
    required_on_site?: string;
    lead_time_days?: number;
    submit_now?: boolean;
  }) => post<Submittal>("/submittals", body),
  updateSubmittal: (
    id: string,
    body: {
      title?: string;
      submittal_type?: string;
      priority?: string;
      description?: string;
      spec_section?: string;
      manufacturer?: string;
      model_number?: string;
      vendor_id?: string;
      cost_code_id?: string;
      option_id?: string;
      due_on?: string;
      required_on_site?: string;
      lead_time_days?: number;
    },
  ) => patch<Submittal>(`/submittals/${id}`, body),
  submitSubmittal: (id: string) => post<Submittal>(`/submittals/${id}/submit`),
  startSubmittalReview: (id: string) => post<Submittal>(`/submittals/${id}/start-review`),
  reviewSubmittal: (id: string, body: { status: string; review_notes?: string }) =>
    post<Submittal>(`/submittals/${id}/review`, body),
  resubmitSubmittal: (id: string, body: { storage_key?: string; note?: string } = {}) =>
    post<Submittal>(`/submittals/${id}/resubmit`, body),
  reassignSubmittal: (id: string, body: { ball_in_court: string; note?: string }) =>
    post<Submittal>(`/submittals/${id}/reassign`, body),

  /* ------------------------------------------------------- drawing sets */
  /** The register board across sets, specs and transmittals. */
  drawingsSummary: () => get<DrawingsSummary>("/drawings/summary"),
  listDrawingSets: (params: { plan_id?: string; community_id?: string; status?: string } = {}) =>
    get<DrawingSet[]>(`/drawing-sets${qs(params)}`),
  createDrawingSet: (body: {
    name: string;
    plan_id?: string;
    community_id?: string;
    notes?: string;
  }) => post<DrawingSet>("/drawing-sets", body),
  updateDrawingSet: (
    setId: string,
    body: { name?: string; plan_id?: string; community_id?: string; notes?: string },
  ) => patch<DrawingSet>(`/drawing-sets/${setId}`, body),
  addDrawing: (
    setId: string,
    body: { sheet_number: string; title: string; discipline?: string; notes?: string },
  ) => post<DrawingSet>(`/drawing-sets/${setId}/drawings`, body),
  updateDrawing: (
    setId: string,
    drawingId: string,
    body: { sheet_number?: string; title?: string; discipline?: string; notes?: string },
  ) => patch<DrawingSet>(`/drawing-sets/${setId}/drawings/${drawingId}`, body),
  removeDrawing: (setId: string, drawingId: string) =>
    del<DrawingSet>(`/drawing-sets/${setId}/drawings/${drawingId}`),
  issueDrawingSet: (setId: string) => post<DrawingSet>(`/drawing-sets/${setId}/issue`),
  /** Creates the next revision and supersedes this one. */
  reviseDrawingSet: (setId: string) => post<DrawingSet>(`/drawing-sets/${setId}/revise`),
  voidDrawingSet: (setId: string) => post<DrawingSet>(`/drawing-sets/${setId}/void`),

  /* ------------------------------------------------------ specifications */
  listSpecifications: (params: { plan_id?: string; current_only?: boolean } = {}) =>
    get<Specification[]>(`/specifications${qs(params)}`),
  getSpecification: (id: string) => get<Specification>(`/specifications/${id}`),
  createSpecification: (body: {
    section: string;
    title: string;
    body?: string;
    plan_id?: string;
    cost_code_id?: string;
    issue_now?: boolean;
  }) => post<Specification>("/specifications", body),
  updateSpecification: (
    id: string,
    body: { title?: string; body?: string; plan_id?: string; cost_code_id?: string },
  ) => patch<Specification>(`/specifications/${id}`, body),
  issueSpecification: (id: string) => post<Specification>(`/specifications/${id}/issue`),
  /** Supersedes the current spec with the next revision; unspecified fields carry over. */
  reviseSpecification: (
    id: string,
    body: { title?: string; body?: string; cost_code_id?: string } = {},
  ) => post<Specification>(`/specifications/${id}/revise`, body),

  /* -------------------------------------------------------- transmittals */
  listTransmittals: (params: { overdue_only?: boolean } = {}) =>
    get<Transmittal[]>(`/transmittals${qs(params)}`),
  createTransmittal: (body: {
    subject: string;
    vendor_ids: string[];
    purpose?: string;
    message?: string;
    drawing_set_id?: string;
    specification_id?: string;
    job_id?: string;
    response_due?: string;
  }) => post<Transmittal>("/transmittals", body),
  acknowledgeTransmittal: (id: string, vendorId: string) =>
    post<Transmittal>(`/transmittals/${id}/acknowledge/${vendorId}`),

  /* --------------------------------------------------------- observations */

  /* ------------------------------------------------------------ incidents */

  /* --------------------------------------------------------- action plans */

  /* ------------------------------------------------------------- meetings */
  /** The board: meetings, scheduled, open/overdue actions, correspondence awaiting reply. */
  meetingsSummary: (jobId?: string) =>
    get<MeetingSummary>(`/meetings/summary${qs({ job_id: jobId })}`),
  listMeetings: (params: { job_id?: string; status?: string; type?: string } = {}) =>
    get<Meeting[]>(`/meetings${qs(params)}`),
  createMeeting: (body: {
    title: string;
    meeting_type?: string;
    job_id?: string;
    meeting_date?: string;
    location?: string;
    attendees?: string;
    notes?: string;
  }) => post<Meeting>("/meetings", body),
  updateMeeting: (
    id: string,
    body: {
      title?: string;
      meeting_type?: string;
      job_id?: string;
      meeting_date?: string;
      location?: string;
      attendees?: string;
      notes?: string;
    },
  ) => patch<Meeting>(`/meetings/${id}`, body),
  addMeetingItem: (
    meetingId: string,
    body: { topic: string; discussion?: string; is_action?: boolean; owner_id?: string; due_on?: string },
  ) => post<Meeting>(`/meetings/${meetingId}/items`, body),
  updateMeetingItem: (
    meetingId: string,
    itemId: string,
    body: { topic?: string; discussion?: string; is_action?: boolean; owner_id?: string; due_on?: string },
  ) => patch<Meeting>(`/meetings/${meetingId}/items/${itemId}`, body),
  removeMeetingItem: (meetingId: string, itemId: string) =>
    del<Meeting>(`/meetings/${meetingId}/items/${itemId}`),
  /** Close an action agreed in a meeting. */
  completeMeetingAction: (itemId: string) => post<Meeting>(`/meetings/items/${itemId}/complete`),
  reopenMeetingAction: (itemId: string) => post<Meeting>(`/meetings/items/${itemId}/reopen`),
  holdMeeting: (meetingId: string) => post<Meeting>(`/meetings/${meetingId}/hold`),
  cancelMeeting: (meetingId: string) => post<Meeting>(`/meetings/${meetingId}/cancel`),
  /** Open the next meeting in the series, carrying the open actions forward. */
  followUpMeeting: (meetingId: string, meetingDate?: string) =>
    post<Meeting>(`/meetings/${meetingId}/follow-up${qs({ meeting_date: meetingDate })}`),

  /* ------------------------------------------------------- correspondence */
  listCorrespondence: (
    params: { job_id?: string; kind?: string; awaiting_only?: boolean } = {},
  ) => get<Correspondence[]>(`/correspondence${qs(params)}`),
  createCorrespondence: (body: {
    subject: string;
    body?: string;
    kind?: string;
    direction?: string;
    job_id?: string;
    vendor_id?: string;
    occurred_on?: string;
    requires_response?: boolean;
    response_due?: string;
  }) => post<Correspondence>("/correspondence", body),
  /** Record that the reply this correspondence was waiting on has happened. */
  respondCorrespondence: (id: string) => post<Correspondence>(`/correspondence/${id}/respond`),

  /* --------------------------------------------- labour & productivity */

  labourSummary: (jobId?: string) =>
    get<LabourSummary>(`/timecards/summary${qs({ job_id: jobId })}`),

  listTimecards: (
    params: {
      job_id?: string;
      vendor_id?: string;
      cost_code_id?: string;
      page?: number;
      size?: number;
    } = {},
  ) => get<Page<Timecard>>(`/timecards${qs(params)}`),
  createTimecard: (body: {
    job_id: string;
    worker_name: string;
    hours: string;
    worked_on?: string;
    overtime_hours?: string;
    cost_code_id?: string;
    vendor_id?: string;
    /** Left off, the trade's standard rate is used. */
    hourly_rate?: string;
    notes?: string;
  }) => post<Timecard>("/timecards", body),
  updateTimecard: (
    id: string,
    body: {
      worker_name?: string;
      hours?: string;
      worked_on?: string;
      overtime_hours?: string;
      cost_code_id?: string | null;
      vendor_id?: string | null;
      hourly_rate?: string | null;
      notes?: string | null;
    },
  ) => patch<Timecard>(`/timecards/${id}`, body),
  deleteTimecard: (id: string) => del(`/timecards/${id}`),

  /** Refused with no rate on the entry: it would book the hours at nothing. */
  approveTimecard: (id: string) => post<Timecard>(`/timecards/${id}/approve`),
  withdrawTimecardApproval: (id: string) =>
    post<Timecard>(`/timecards/${id}/withdraw-approval`),
  /** Approves what it can and says what it could not, rather than refusing the lot. */
  approveTimecards: (ids: string[]) =>
    post<ApprovalResult>("/timecards/approve", { timecard_ids: ids }),

  /** Hours and cost by cost code, against what the home was budgeted to take. */
  productivity: (jobId?: string) =>
    get<ProductivityReport>(`/timecards/productivity${qs({ job_id: jobId })}`),
  labourByWorker: (jobId?: string) =>
    get<WorkerRow[]>(`/timecards/by-worker${qs({ job_id: jobId })}`),
  labourByVendor: (jobId?: string) =>
    get<VendorLabourRow[]>(`/timecards/by-vendor${qs({ job_id: jobId })}`),
  /** The target the home's labour is measured against. Null clears one. */
  setBudgetedHours: (
    jobId: string,
    rows: { cost_code_id: string; budgeted_hours: string | null }[],
  ) => put<ProductivityReport>(`/timecards/budgeted-hours/${jobId}`, rows),

  /* --------------------------------------------- consolidated features */

  /** Whether a trade is worth re-hiring, across all six dimensions. */
  tradeScorecard: (vendorId?: string, costCodeId?: string) =>
    get<TradeScore[]>(`/reports/trade-scorecard${qs({ vendor_id: vendorId, cost_code_id: costCodeId })}`),
  scorecardWeights: () =>
    get<{ weights: Record<string, number>; defaults: Record<string, number> }>("/reports/trade-scorecard/weights"),
  setScorecardWeights: (weights: Record<string, number>) =>
    put<{ weights: Record<string, number>; defaults: Record<string, number> }>("/reports/trade-scorecard/weights", weights),
  scorecardHistory: (vendorId: string) =>
    get<{ period: string; overall: number | null; dimensions: Record<string, number | null> }[]>(
      `/reports/trade-scorecard/${vendorId}/history`,
    ),

  /** Turn an answered, cost-bearing RFI into a priced change order. */
  changeOrderFromRFI: (
    rfiId: string,
    body: {
      responsible_party?: string;
      price_delta?: string;
      reason?: string;
      cost_lines?: { cost_code_id: string; amount: string; description?: string }[];
    },
  ) => post<RFIChangeOrderResult>(`/rfis/${rfiId}/change-order`, body),
};
