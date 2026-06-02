import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE =
  "individual_development_profile" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE = "hr" as const;
export const INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE =
  "assessment" as const;

export const INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_STATUSES = [
  "queued",
  "processing",
  "ready",
  "failed",
] as const;

export type IndividualDevelopmentProfileAssessmentReportStatus =
  (typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_STATUSES)[number];

export type IndividualDevelopmentProfileAssessmentReportRecord = {
  id: string;
  assessment_assignment_id: string;
  organization_id: string;
  participant_id: string;
  report_type: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE;
  audience: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE;
  source_type: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE;
  report_status: IndividualDevelopmentProfileAssessmentReportStatus;
  generator_type: string | null;
  contract_version: string | null;
  prompt_version_id: string | null;
  model_name: string | null;
  generator_version: string | null;
  input_snapshot: unknown;
  report_snapshot: unknown;
  failure_code: string | null;
  failure_reason: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type IndividualDevelopmentProfileAssignmentOwnershipRecord = {
  id: string;
  organization_id: string;
  participant_id: string;
  assignment_type: "standard_battery";
  status: "active" | "completed" | "abandoned" | "cancelled";
};

export type IndividualDevelopmentProfileLifecycleFailureReason =
  | "invalid_payload"
  | "assignment_not_found"
  | "assignment_load_failed"
  | "report_load_failed"
  | "report_insert_failed"
  | "report_update_failed";

export type IndividualDevelopmentProfileAssessmentReportReadResult =
  | { ok: true; status: "missing" }
  | {
      ok: true;
      status: IndividualDevelopmentProfileAssessmentReportStatus;
      report: IndividualDevelopmentProfileAssessmentReportRecord;
    }
  | {
      ok: false;
      reason: IndividualDevelopmentProfileLifecycleFailureReason;
      details: string;
    };

export type IndividualDevelopmentProfileQueueAction =
  | "queued"
  | "noop_queued"
  | "noop_processing"
  | "noop_ready"
  | "noop_failed";

export type IndividualDevelopmentProfileAssessmentReportQueueResult =
  | {
      ok: true;
      action: IndividualDevelopmentProfileQueueAction;
      assignment: IndividualDevelopmentProfileAssignmentOwnershipRecord;
      report: IndividualDevelopmentProfileAssessmentReportRecord | null;
    }
  | {
      ok: false;
      reason: IndividualDevelopmentProfileLifecycleFailureReason;
      details: string;
    };

export type IndividualDevelopmentProfileAssessmentReportResetResult =
  | {
      ok: true;
      action: "reset_to_queued" | "noop_missing" | "noop_not_failed";
      report: IndividualDevelopmentProfileAssessmentReportRecord | null;
    }
  | {
      ok: false;
      reason: IndividualDevelopmentProfileLifecycleFailureReason;
      details: string;
    };

export type ClaimIndividualDevelopmentProfileAssessmentReportForProcessingResult =
  | {
      ok: true;
      reportId: string;
      status: "processing";
      report: IndividualDevelopmentProfileAssessmentReportRecord & {
        report_status: "processing";
      };
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "already_processing"
        | "already_ready"
        | "failed_not_claimable"
        | "not_claimable"
        | "report_update_failed";
      message: string;
      report?: IndividualDevelopmentProfileAssessmentReportRecord;
    };

export type MarkIndividualDevelopmentProfileAssessmentReportFailedResult =
  | {
      ok: true;
      reportId: string;
      status: "failed";
      report: IndividualDevelopmentProfileAssessmentReportRecord & {
        report_status: "failed";
      };
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "not_processing"
        | "not_fail_claimable"
        | "report_update_failed";
      message: string;
      report?: IndividualDevelopmentProfileAssessmentReportRecord;
    };

export type IndividualDevelopmentProfileAssessmentReportInsert = {
  assessment_assignment_id: string;
  organization_id: string;
  participant_id: string;
  report_type: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE;
  audience: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE;
  source_type: typeof INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE;
  report_status: "queued";
  generator_type: null;
  contract_version: null;
  prompt_version_id: null;
  model_name: null;
  generator_version: null;
  input_snapshot: null;
  report_snapshot: null;
  failure_code: null;
  failure_reason: null;
  queued_at: string;
  started_at: null;
  completed_at: null;
  generated_at: null;
  metadata: Record<string, unknown>;
};

export type IndividualDevelopmentProfileAssessmentReportRetryPatch = {
  report_status: "queued";
  queued_at: string;
  started_at: null;
  completed_at: null;
  generated_at: null;
  input_snapshot: null;
  report_snapshot: null;
  failure_code: null;
  failure_reason: null;
  metadata: Record<string, unknown>;
};

type IndividualDevelopmentProfileLifecycleDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  now?: () => string;
};

const REPORT_SELECT =
  "id, assessment_assignment_id, organization_id, participant_id, report_type, audience, source_type, report_status, generator_type, contract_version, prompt_version_id, model_name, generator_version, input_snapshot, report_snapshot, failure_code, failure_reason, queued_at, started_at, completed_at, generated_at, created_at, updated_at, metadata";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getSupabaseClient(
  deps: IndividualDevelopmentProfileLifecycleDependencies = {},
) {
  return deps.supabase ?? createSupabaseAdminClient();
}

function getNow(
  deps: IndividualDevelopmentProfileLifecycleDependencies = {},
): string {
  return deps.now?.() ?? new Date().toISOString();
}

function buildFailure(
  reason: IndividualDevelopmentProfileLifecycleFailureReason,
  details: string,
):
  | Extract<IndividualDevelopmentProfileAssessmentReportReadResult, { ok: false }>
  | Extract<IndividualDevelopmentProfileAssessmentReportQueueResult, { ok: false }>
  | Extract<IndividualDevelopmentProfileAssessmentReportResetResult, { ok: false }> {
  return { ok: false, reason, details };
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function buildQueueMetadata(input: {
  existingMetadata?: Record<string, unknown> | null;
  requestedByUserId?: string | null;
}): Record<string, unknown> {
  const metadata = {
    ...(input.existingMetadata ?? {}),
  };

  if (input.requestedByUserId) {
    metadata.requested_by_user_id = input.requestedByUserId;
    metadata.last_queued_by_user_id = input.requestedByUserId;
  }

  return metadata;
}

function isIndividualDevelopmentProfileAssessmentReportRecord(
  value: unknown,
): value is IndividualDevelopmentProfileAssessmentReportRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.assessment_assignment_id === "string" &&
    typeof candidate.organization_id === "string" &&
    typeof candidate.participant_id === "string" &&
    candidate.report_type === INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE &&
    candidate.audience === INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE &&
    candidate.source_type === INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE &&
    INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_STATUSES.includes(
      candidate.report_status as IndividualDevelopmentProfileAssessmentReportStatus,
    )
  );
}

function normalizeProcessingReport(
  report: IndividualDevelopmentProfileAssessmentReportRecord,
): (IndividualDevelopmentProfileAssessmentReportRecord & { report_status: "processing" }) | null {
  if (report.report_status !== "processing") {
    return null;
  }

  return {
    ...report,
    report_status: "processing",
  };
}

function normalizeFailedReport(
  report: IndividualDevelopmentProfileAssessmentReportRecord,
): (IndividualDevelopmentProfileAssessmentReportRecord & { report_status: "failed" }) | null {
  if (report.report_status !== "failed") {
    return null;
  }

  return {
    ...report,
    report_status: "failed",
  };
}

async function loadAssignmentOwnership(
  input: {
    assessmentAssignmentId: string;
    organizationId: string;
    participantId?: string;
  },
  deps: IndividualDevelopmentProfileLifecycleDependencies = {},
): Promise<
  | { ok: true; assignment: IndividualDevelopmentProfileAssignmentOwnershipRecord }
  | { ok: false; reason: "assignment_not_found" | "assignment_load_failed"; details: string }
> {
  const supabase = getSupabaseClient(deps);
  let query = supabase
    .from("assessment_assignments")
    .select("id, organization_id, participant_id, assignment_type, status")
    .eq("id", input.assessmentAssignmentId)
    .eq("organization_id", input.organizationId)
    .eq("assignment_type", "standard_battery");

  if (isNonEmptyString(input.participantId)) {
    query = query.eq("participant_id", input.participantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "assignment_load_failed",
      details: `Failed to load assessment assignment ownership: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "assignment_not_found",
      details: "Assessment assignment was not found for the provided organization boundary.",
    };
  }

  return {
    ok: true,
    assignment: data as IndividualDevelopmentProfileAssignmentOwnershipRecord,
  };
}

export async function loadLatestIndividualDevelopmentProfileAssessmentReportRow(
  input: {
    assessmentAssignmentId: string;
    organizationId: string;
    participantId?: string;
  },
  deps: IndividualDevelopmentProfileLifecycleDependencies = {},
): Promise<
  | { ok: true; report: IndividualDevelopmentProfileAssessmentReportRecord | null }
  | { ok: false; reason: "report_load_failed"; details: string }
> {
  const supabase = getSupabaseClient(deps);
  let query = supabase
    .from("assessment_reports")
    .select(REPORT_SELECT)
    .eq("assessment_assignment_id", input.assessmentAssignmentId)
    .eq("organization_id", input.organizationId)
    .eq("report_type", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE)
    .eq("audience", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE)
    .eq("source_type", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (isNonEmptyString(input.participantId)) {
    query = query.eq("participant_id", input.participantId);
  }

  const { data, error } = await query;

  if (error) {
    return {
      ok: false,
      reason: "report_load_failed",
      details: `Failed to load Individual Development Profile assessment report: ${error.message}`,
    };
  }

  const report = ((data ?? []) as unknown[]).find(
    isIndividualDevelopmentProfileAssessmentReportRecord,
  ) ?? null;

  return {
    ok: true,
    report,
  };
}

export async function loadIndividualDevelopmentProfileAssessmentReportRowById(
  input: {
    assessmentReportId: string;
    organizationId: string;
    participantId?: string;
  },
  deps: IndividualDevelopmentProfileLifecycleDependencies = {},
): Promise<
  | { ok: true; report: IndividualDevelopmentProfileAssessmentReportRecord | null }
  | { ok: false; reason: "report_load_failed"; details: string }
> {
  const supabase = getSupabaseClient(deps);
  let query = supabase
    .from("assessment_reports")
    .select(REPORT_SELECT)
    .eq("id", input.assessmentReportId)
    .eq("organization_id", input.organizationId)
    .eq("report_type", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE)
    .eq("audience", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE)
    .eq("source_type", INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE);

  if (isNonEmptyString(input.participantId)) {
    query = query.eq("participant_id", input.participantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "report_load_failed",
      details: `Failed to load Individual Development Profile assessment report by id: ${error.message}`,
    };
  }

  if (!isIndividualDevelopmentProfileAssessmentReportRecord(data)) {
    return {
      ok: true,
      report: null,
    };
  }

  return {
    ok: true,
    report: data,
  };
}

export function buildQueuedIndividualDevelopmentProfileAssessmentReportInsert(input: {
  assessmentAssignmentId: string;
  organizationId: string;
  participantId: string;
  requestedByUserId?: string | null;
  queuedAt?: string;
}): IndividualDevelopmentProfileAssessmentReportInsert {
  const queuedAt = input.queuedAt ?? new Date().toISOString();

  return {
    assessment_assignment_id: input.assessmentAssignmentId,
    organization_id: input.organizationId,
    participant_id: input.participantId,
    report_type: INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_TYPE,
    audience: INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_AUDIENCE,
    source_type: INDIVIDUAL_DEVELOPMENT_PROFILE_ASSESSMENT_REPORT_SOURCE_TYPE,
    report_status: "queued",
    generator_type: null,
    contract_version: null,
    prompt_version_id: null,
    model_name: null,
    generator_version: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    queued_at: queuedAt,
    started_at: null,
    completed_at: null,
    generated_at: null,
    metadata: buildQueueMetadata({
      requestedByUserId: input.requestedByUserId,
    }),
  };
}

export function buildRetryFailedIndividualDevelopmentProfileAssessmentReportPatch(input: {
  existingReport: IndividualDevelopmentProfileAssessmentReportRecord;
  requestedByUserId?: string | null;
  queuedAt?: string;
}): IndividualDevelopmentProfileAssessmentReportRetryPatch | null {
  if (input.existingReport.report_status !== "failed") {
    return null;
  }

  const queuedAt = input.queuedAt ?? new Date().toISOString();

  return {
    report_status: "queued",
    queued_at: queuedAt,
    started_at: null,
    completed_at: null,
    generated_at: null,
    input_snapshot: null,
    report_snapshot: null,
    failure_code: null,
    failure_reason: null,
    metadata: buildQueueMetadata({
      existingMetadata: normalizeMetadata(input.existingReport.metadata),
      requestedByUserId: input.requestedByUserId,
    }),
  };
}

export async function queueIndividualDevelopmentProfileAssessmentReport(input: {
  assessmentAssignmentId: string;
  organizationId: string;
  participantId?: string;
  requestedByUserId?: string | null;
}, deps: IndividualDevelopmentProfileLifecycleDependencies = {}): Promise<IndividualDevelopmentProfileAssessmentReportQueueResult> {
  if (!isNonEmptyString(input.assessmentAssignmentId) || !isNonEmptyString(input.organizationId)) {
    return buildFailure(
      "invalid_payload",
      "assessmentAssignmentId and organizationId are required.",
    );
  }

  const ownership = await loadAssignmentOwnership(input, deps);

  if (!ownership.ok) {
    return ownership;
  }

  const existingReportResult = await loadLatestIndividualDevelopmentProfileAssessmentReportRow(
    {
      assessmentAssignmentId: ownership.assignment.id,
      organizationId: ownership.assignment.organization_id,
      participantId: ownership.assignment.participant_id,
    },
    deps,
  );

  if (!existingReportResult.ok) {
    return existingReportResult;
  }

  const existingReport = existingReportResult.report;

  if (existingReport?.report_status === "queued") {
    return {
      ok: true,
      action: "noop_queued",
      assignment: ownership.assignment,
      report: existingReport,
    };
  }

  if (existingReport?.report_status === "processing") {
    return {
      ok: true,
      action: "noop_processing",
      assignment: ownership.assignment,
      report: existingReport,
    };
  }

  if (existingReport?.report_status === "ready") {
    return {
      ok: true,
      action: "noop_ready",
      assignment: ownership.assignment,
      report: existingReport,
    };
  }

  if (existingReport?.report_status === "failed") {
    return {
      ok: true,
      action: "noop_failed",
      assignment: ownership.assignment,
      report: existingReport,
    };
  }

  const supabase = getSupabaseClient(deps);
  const insertPayload = buildQueuedIndividualDevelopmentProfileAssessmentReportInsert({
    assessmentAssignmentId: ownership.assignment.id,
    organizationId: ownership.assignment.organization_id,
    participantId: ownership.assignment.participant_id,
    requestedByUserId: input.requestedByUserId,
    queuedAt: getNow(deps),
  });
  const { data, error } = await supabase
    .from("assessment_reports")
    .insert(insertPayload)
    .select(REPORT_SELECT)
    .single();

  if (error || !data || !isIndividualDevelopmentProfileAssessmentReportRecord(data)) {
    return buildFailure(
      "report_insert_failed",
      `Failed to create queued Individual Development Profile assessment report: ${error?.message ?? "Unknown error"}`,
    );
  }

  return {
    ok: true,
    action: "queued",
    assignment: ownership.assignment,
    report: data,
  };
}

export async function loadIndividualDevelopmentProfileAssessmentReport(input: {
  assessmentAssignmentId: string;
  organizationId: string;
  participantId?: string;
}, deps: IndividualDevelopmentProfileLifecycleDependencies = {}): Promise<IndividualDevelopmentProfileAssessmentReportReadResult> {
  if (!isNonEmptyString(input.assessmentAssignmentId) || !isNonEmptyString(input.organizationId)) {
    return buildFailure(
      "invalid_payload",
      "assessmentAssignmentId and organizationId are required.",
    );
  }

  const result = await loadLatestIndividualDevelopmentProfileAssessmentReportRow(input, deps);

  if (!result.ok) {
    return result;
  }

  if (!result.report) {
    return {
      ok: true,
      status: "missing",
    };
  }

  return {
    ok: true,
    status: result.report.report_status,
    report: result.report,
  };
}

export async function claimIndividualDevelopmentProfileAssessmentReportForProcessing(input: {
  assessmentReportId: string;
  organizationId: string;
  participantId?: string;
}, deps: IndividualDevelopmentProfileLifecycleDependencies = {}): Promise<ClaimIndividualDevelopmentProfileAssessmentReportForProcessingResult> {
  if (!isNonEmptyString(input.assessmentReportId) || !isNonEmptyString(input.organizationId)) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: "assessmentReportId and organizationId are required.",
    };
  }

  const existing = await loadIndividualDevelopmentProfileAssessmentReportRowById(input, deps);

  if (!existing.ok) {
    return {
      ok: false,
      reason: "report_update_failed",
      message: existing.details,
    };
  }

  if (!existing.report) {
    return {
      ok: false,
      reason: "report_not_found",
      message: "Individual Development Profile assessment report was not found.",
    };
  }

  if (existing.report.report_status === "processing") {
    return {
      ok: false,
      reason: "already_processing",
      message: "Individual Development Profile assessment report is already processing.",
      report: existing.report,
    };
  }

  if (existing.report.report_status === "ready") {
    return {
      ok: false,
      reason: "already_ready",
      message: "Individual Development Profile assessment report is already ready.",
      report: existing.report,
    };
  }

  if (existing.report.report_status === "failed") {
    return {
      ok: false,
      reason: "failed_not_claimable",
      message: "Failed Individual Development Profile assessment reports must be reset before processing.",
      report: existing.report,
    };
  }

  if (existing.report.report_status !== "queued") {
    return {
      ok: false,
      reason: "not_claimable",
      message: "Individual Development Profile assessment report cannot be claimed from its current state.",
      report: existing.report,
    };
  }

  const supabase = getSupabaseClient(deps);
  const { data, error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "processing",
      started_at: getNow(deps),
      completed_at: null,
      generated_at: null,
      failure_code: null,
      failure_reason: null,
    })
    .eq("id", existing.report.id)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "queued")
    .select(REPORT_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "report_update_failed",
      message: `Failed to claim Individual Development Profile assessment report for processing: ${error.message}`,
      report: existing.report,
    };
  }

  if (!isIndividualDevelopmentProfileAssessmentReportRecord(data)) {
    return {
      ok: false,
      reason: "not_claimable",
      message: "Individual Development Profile assessment report could not be claimed because it is no longer queued.",
      report: existing.report,
    };
  }

  const claimed = normalizeProcessingReport(data);

  if (!claimed) {
    return {
      ok: false,
      reason: "not_claimable",
      message: "Individual Development Profile assessment report could not be claimed because it is no longer queued.",
      report: existing.report,
    };
  }

  return {
    ok: true,
    reportId: claimed.id,
    status: "processing",
    report: claimed,
  };
}

export async function markIndividualDevelopmentProfileAssessmentReportReady(input: {
  assessmentReportId: string;
  organizationId: string;
  reportSnapshot: unknown;
  inputSnapshot: unknown;
  generatorType?: string | null;
  generatorVersion?: string | null;
  contractVersion?: string | null;
  modelName?: string | null;
}, deps: IndividualDevelopmentProfileLifecycleDependencies = {}): Promise<
  | { ok: true }
  | { ok: false; reason: "invalid_payload" | "report_update_failed"; message: string }
> {
  if (!isNonEmptyString(input.assessmentReportId) || !isNonEmptyString(input.organizationId)) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: "assessmentReportId and organizationId are required.",
    };
  }

  const completedAt = getNow(deps);
  const supabase = getSupabaseClient(deps);
  const { data, error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "ready",
      input_snapshot: input.inputSnapshot,
      report_snapshot: input.reportSnapshot,
      completed_at: completedAt,
      generated_at: completedAt,
      failure_code: null,
      failure_reason: null,
      generator_type: input.generatorType ?? null,
      generator_version: input.generatorVersion ?? null,
      contract_version: input.contractVersion ?? null,
      model_name: input.modelName ?? null,
    })
    .eq("id", input.assessmentReportId)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "processing")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      reason: "report_update_failed",
      message: `Failed to mark Individual Development Profile assessment report as ready: ${error?.message ?? "Report is no longer processing."}`,
    };
  }

  return { ok: true };
}

export async function markIndividualDevelopmentProfileAssessmentReportFailed(input: {
  assessmentReportId: string;
  organizationId: string;
  failureCode: string;
  failureReason: string;
}, deps: IndividualDevelopmentProfileLifecycleDependencies = {}): Promise<MarkIndividualDevelopmentProfileAssessmentReportFailedResult> {
  if (
    !isNonEmptyString(input.assessmentReportId) ||
    !isNonEmptyString(input.organizationId) ||
    !isNonEmptyString(input.failureCode) ||
    !isNonEmptyString(input.failureReason)
  ) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: "assessmentReportId, organizationId, failureCode, and failureReason are required.",
    };
  }

  const existing = await loadIndividualDevelopmentProfileAssessmentReportRowById(
    {
      assessmentReportId: input.assessmentReportId,
      organizationId: input.organizationId,
    },
    deps,
  );

  if (!existing.ok) {
    return {
      ok: false,
      reason: "report_update_failed",
      message: existing.details,
    };
  }

  if (!existing.report) {
    return {
      ok: false,
      reason: "report_not_found",
      message: "Individual Development Profile assessment report was not found.",
    };
  }

  if (existing.report.report_status !== "processing") {
    return {
      ok: false,
      reason: "not_processing",
      message: "Only processing Individual Development Profile assessment reports can be marked failed.",
      report: existing.report,
    };
  }

  const supabase = getSupabaseClient(deps);
  const { data, error } = await supabase
    .from("assessment_reports")
    .update({
      report_status: "failed",
      report_snapshot: null,
      completed_at: getNow(deps),
      failure_code: input.failureCode,
      failure_reason: input.failureReason,
    })
    .eq("id", existing.report.id)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "processing")
    .select(REPORT_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "report_update_failed",
      message: `Failed to mark Individual Development Profile assessment report as failed: ${error.message}`,
      report: existing.report,
    };
  }

  if (!isIndividualDevelopmentProfileAssessmentReportRecord(data)) {
    return {
      ok: false,
      reason: "not_fail_claimable",
      message: "Individual Development Profile assessment report could not be marked failed because it is no longer processing.",
      report: existing.report,
    };
  }

  const failed = normalizeFailedReport(data);

  if (!failed) {
    return {
      ok: false,
      reason: "not_fail_claimable",
      message: "Individual Development Profile assessment report could not be marked failed because it is no longer processing.",
      report: existing.report,
    };
  }

  return {
    ok: true,
    reportId: failed.id,
    status: "failed",
    report: failed,
  };
}

export async function resetFailedIndividualDevelopmentProfileAssessmentReportToQueued(input: {
  assessmentAssignmentId: string;
  organizationId: string;
  participantId?: string;
  requestedByUserId?: string | null;
}, deps: IndividualDevelopmentProfileLifecycleDependencies = {}): Promise<IndividualDevelopmentProfileAssessmentReportResetResult> {
  if (!isNonEmptyString(input.assessmentAssignmentId) || !isNonEmptyString(input.organizationId)) {
    return buildFailure(
      "invalid_payload",
      "assessmentAssignmentId and organizationId are required.",
    );
  }

  const existingReportResult = await loadLatestIndividualDevelopmentProfileAssessmentReportRow(
    input,
    deps,
  );

  if (!existingReportResult.ok) {
    return existingReportResult;
  }

  if (!existingReportResult.report) {
    return {
      ok: true,
      action: "noop_missing",
      report: null,
    };
  }

  const existingReport = existingReportResult.report;

  if (existingReport.report_status !== "failed") {
    return {
      ok: true,
      action: "noop_not_failed",
      report: existingReport,
    };
  }

  const patch = buildRetryFailedIndividualDevelopmentProfileAssessmentReportPatch({
    existingReport,
    requestedByUserId: input.requestedByUserId,
    queuedAt: getNow(deps),
  });

  if (!patch) {
    return {
      ok: true,
      action: "noop_not_failed",
      report: existingReport,
    };
  }

  const supabase = getSupabaseClient(deps);
  const { data, error } = await supabase
    .from("assessment_reports")
    .update(patch)
    .eq("id", existingReport.id)
    .eq("report_status", "failed")
    .select(REPORT_SELECT)
    .single();

  if (error || !data || !isIndividualDevelopmentProfileAssessmentReportRecord(data)) {
    return buildFailure(
      "report_update_failed",
      `Failed to reset Individual Development Profile assessment report: ${error?.message ?? "Unknown error"}`,
    );
  }

  return {
    ok: true,
    action: "reset_to_queued",
    report: data,
  };
}
