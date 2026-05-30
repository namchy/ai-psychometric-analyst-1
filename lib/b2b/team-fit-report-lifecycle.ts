import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TEAM_FIT_REPORT_TYPE = "team_fit_report_v1";
export const TEAM_FIT_REPORT_VERSION = "v1";
export const TEAM_FIT_REPORT_STATUSES = ["queued", "processing", "ready", "failed"] as const;
export const TEAM_FIT_CANDIDATE_SOURCE_TYPE = "composite_deterministic_input_snapshot";
export const TEAM_FIT_TEAM_SOURCE_TYPE = "team_dynamics_aggregation_input_snapshot";

export type TeamFitReportStatus = (typeof TEAM_FIT_REPORT_STATUSES)[number];

type TeamFitReportRow = {
  id: string;
  organization_id: string;
  team_id: string;
  participant_id: string;
  candidate_source_type: string;
  candidate_source_id: string | null;
  team_source_type: string;
  team_source_id: string | null;
  optional_context: Record<string, unknown>;
  report_type: string;
  report_version: string;
  report_status: TeamFitReportStatus;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type TeamRow = {
  id: string;
  organization_id: string;
  archived_at?: string | null;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
};

export type TeamFitReportRowSummary = {
  id: string;
  organizationId: string;
  teamId: string;
  participantId: string;
  candidateSourceType: string;
  candidateSourceId: string | null;
  teamSourceType: string;
  teamSourceId: string | null;
  optionalContext: Record<string, unknown>;
  reportType: string;
  reportVersion: string;
  reportStatus: TeamFitReportStatus;
  inputSnapshot: Record<string, unknown> | null;
  reportSnapshot: Record<string, unknown> | null;
  errorMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QueueTeamFitReportShellInput = {
  organizationId: string;
  teamId: string;
  participantId: string;
  candidateSourceType: typeof TEAM_FIT_CANDIDATE_SOURCE_TYPE;
  candidateSourceId?: string | null;
  teamSourceType: typeof TEAM_FIT_TEAM_SOURCE_TYPE;
  teamSourceId?: string | null;
  optionalContext?: Record<string, unknown>;
  createdBy?: string | null;
};

export type ClaimTeamFitReportForProcessingInput = {
  teamFitReportId: string;
  organizationId: string;
};

export type MarkTeamFitReportProcessingFailedInput = {
  teamFitReportId: string;
  organizationId: string;
  errorMessage: string;
};

export type ResetFailedTeamFitReportToQueuedInput = {
  teamFitReportId: string;
  organizationId: string;
};

type TeamFitReportLifecycleDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  now?: () => string;
};

export type QueueTeamFitReportShellResult =
  | { ok: true; reportId: string; status: TeamFitReportStatus; report: TeamFitReportRowSummary }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "team_not_found"
        | "participant_not_found"
        | "team_organization_mismatch"
        | "participant_organization_mismatch"
        | "insert_failed";
      message: string;
    };

export type ClaimTeamFitReportForProcessingResult =
  | { ok: true; reportId: string; status: "processing"; report: TeamFitReportRowSummary }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "already_processing"
        | "already_ready"
        | "failed_not_claimable"
        | "not_claimable"
        | "update_failed";
      message: string;
      report?: TeamFitReportRowSummary;
    };

export type MarkTeamFitReportProcessingFailedResult =
  | { ok: true; reportId: string; status: "failed"; report: TeamFitReportRowSummary }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "already_ready"
        | "already_failed"
        | "not_processing"
        | "not_fail_claimable"
        | "update_failed";
      message: string;
      report?: TeamFitReportRowSummary;
    };

export type ResetFailedTeamFitReportToQueuedResult =
  | { ok: true; reportId: string; status: "queued"; report: TeamFitReportRowSummary }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "already_queued"
        | "processing_not_resettable"
        | "ready_not_resettable"
        | "not_resettable"
        | "update_failed";
      message: string;
      report?: TeamFitReportRowSummary;
    };

const TEAM_FIT_REPORT_ROW_SELECT =
  "id, organization_id, team_id, participant_id, candidate_source_type, candidate_source_id, team_source_type, team_source_id, optional_context, report_type, report_version, report_status, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, failed_at, created_by, created_at, updated_at";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapRow(row: TeamFitReportRow): TeamFitReportRowSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    participantId: row.participant_id,
    candidateSourceType: row.candidate_source_type,
    candidateSourceId: row.candidate_source_id,
    teamSourceType: row.team_source_type,
    teamSourceId: row.team_source_id,
    optionalContext: isPlainObject(row.optional_context) ? row.optional_context : {},
    reportType: row.report_type,
    reportVersion: row.report_version,
    reportStatus: row.report_status,
    inputSnapshot: row.input_snapshot,
    reportSnapshot: row.report_snapshot,
    errorMessage: row.error_message,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadTeamFitReportRowForOrganization(input: {
  teamFitReportId: string;
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamFitReportRow | null> {
  const { data, error } = await input.supabase
    .from("team_fit_reports")
    .select(TEAM_FIT_REPORT_ROW_SELECT)
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report row: ${error.message}`);
  }

  return (data as TeamFitReportRow | null) ?? null;
}

async function loadTeamContext(input: {
  organizationId: string;
  teamId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<QueueTeamFitReportShellResult | { ok: true; team: TeamRow }> {
  const { data, error } = await input.supabase
    .from("teams")
    .select("id, organization_id, archived_at")
    .eq("id", input.teamId)
    .maybeSingle();

  if (error) {
    return { ok: false, reason: "team_not_found", message: `Failed to load team: ${error.message}` };
  }

  if (!data) {
    return { ok: false, reason: "team_not_found", message: "Team was not found." };
  }

  if (data.organization_id !== input.organizationId) {
    return {
      ok: false,
      reason: "team_organization_mismatch",
      message: "Team does not belong to the provided organization.",
    };
  }

  return { ok: true, team: data as TeamRow };
}

async function loadParticipantContext(input: {
  organizationId: string;
  participantId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<QueueTeamFitReportShellResult | { ok: true; participant: ParticipantRow }> {
  const { data, error } = await input.supabase
    .from("participants")
    .select("id, organization_id")
    .eq("id", input.participantId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "participant_not_found",
      message: `Failed to load participant: ${error.message}`,
    };
  }

  if (!data) {
    return { ok: false, reason: "participant_not_found", message: "Participant was not found." };
  }

  if (data.organization_id !== input.organizationId) {
    return {
      ok: false,
      reason: "participant_organization_mismatch",
      message: "Participant does not belong to the provided organization.",
    };
  }

  return { ok: true, participant: data as ParticipantRow };
}

export async function queueTeamFitReportShell(
  input: QueueTeamFitReportShellInput,
  deps: TeamFitReportLifecycleDependencies = {},
): Promise<QueueTeamFitReportShellResult> {
  if (!isNonEmptyString(input.organizationId)) {
    return { ok: false, reason: "invalid_payload", message: "organizationId is required." };
  }

  if (!isNonEmptyString(input.teamId)) {
    return { ok: false, reason: "invalid_payload", message: "teamId is required." };
  }

  if (!isNonEmptyString(input.participantId)) {
    return { ok: false, reason: "invalid_payload", message: "participantId is required." };
  }

  if (input.candidateSourceType !== TEAM_FIT_CANDIDATE_SOURCE_TYPE) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: `candidateSourceType must be ${TEAM_FIT_CANDIDATE_SOURCE_TYPE}.`,
    };
  }

  if (input.teamSourceType !== TEAM_FIT_TEAM_SOURCE_TYPE) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: `teamSourceType must be ${TEAM_FIT_TEAM_SOURCE_TYPE}.`,
    };
  }

  if (input.optionalContext != null && !isPlainObject(input.optionalContext)) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: "optionalContext must be a plain object when provided.",
    };
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const now = deps.now ?? (() => new Date().toISOString());

  const teamResult = await loadTeamContext({
    organizationId: input.organizationId,
    teamId: input.teamId,
    supabase,
  });

  if (!teamResult.ok) {
    return teamResult;
  }

  const participantResult = await loadParticipantContext({
    organizationId: input.organizationId,
    participantId: input.participantId,
    supabase,
  });

  if (!participantResult.ok) {
    return participantResult;
  }

  const queuedAt = now();
  const insertPatch = {
    organization_id: input.organizationId,
    team_id: input.teamId,
    participant_id: input.participantId,
    candidate_source_type: input.candidateSourceType,
    candidate_source_id: input.candidateSourceId ?? null,
    team_source_type: input.teamSourceType,
    team_source_id: input.teamSourceId ?? null,
    optional_context: input.optionalContext ?? {},
    report_type: TEAM_FIT_REPORT_TYPE,
    report_version: TEAM_FIT_REPORT_VERSION,
    report_status: "queued",
    queued_at: queuedAt,
    created_by: input.createdBy ?? null,
  } as const;

  const { data, error } = await supabase
    .from("team_fit_reports")
    .insert(insertPatch)
    .select(TEAM_FIT_REPORT_ROW_SELECT)
    .single();

  if (error) {
    return {
      ok: false,
      reason: "insert_failed",
      message: `Failed to queue Team Fit report shell row: ${error.message}`,
    };
  }

  const report = mapRow(data as TeamFitReportRow);

  return {
    ok: true,
    reportId: report.id,
    status: report.reportStatus,
    report,
  };
}

export async function claimTeamFitReportForProcessing(
  input: ClaimTeamFitReportForProcessingInput,
  deps: TeamFitReportLifecycleDependencies = {},
): Promise<ClaimTeamFitReportForProcessingResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return { ok: false, reason: "invalid_payload", message: "teamFitReportId is required." };
  }

  if (!isNonEmptyString(input.organizationId)) {
    return { ok: false, reason: "invalid_payload", message: "organizationId is required." };
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const now = deps.now ?? (() => new Date().toISOString());
  const reportRow = await loadTeamFitReportRowForOrganization({ ...input, supabase });

  if (!reportRow) {
    return {
      ok: false,
      reason: "report_not_found",
      message: "Team Fit report row was not found for this organization.",
    };
  }

  const report = mapRow(reportRow);

  if (reportRow.report_status === "processing") {
    return { ok: false, reason: "already_processing", message: "Team Fit report is already processing.", report };
  }

  if (reportRow.report_status === "ready") {
    return { ok: false, reason: "already_ready", message: "Team Fit report is already ready.", report };
  }

  if (reportRow.report_status === "failed") {
    return {
      ok: false,
      reason: "failed_not_claimable",
      message: "Failed Team Fit report rows must be reset before claiming.",
      report,
    };
  }

  if (reportRow.report_status !== "queued") {
    return {
      ok: false,
      reason: "not_claimable",
      message: "Team Fit report cannot be claimed from its current state.",
      report,
    };
  }

  const startedAt = now();
  const { data, error } = await supabase
    .from("team_fit_reports")
    .update({
      report_status: "processing",
      started_at: startedAt,
      error_message: null,
    })
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "queued")
    .select(TEAM_FIT_REPORT_ROW_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "update_failed",
      message: `Failed to claim Team Fit report for processing: ${error.message}`,
      report,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "not_claimable",
      message: "Team Fit report could not be claimed because it is no longer queued.",
      report,
    };
  }

  const claimed = mapRow(data as TeamFitReportRow);

  return {
    ok: true,
    reportId: claimed.id,
    status: "processing",
    report: claimed,
  };
}

export async function markTeamFitReportProcessingFailed(
  input: MarkTeamFitReportProcessingFailedInput,
  deps: TeamFitReportLifecycleDependencies = {},
): Promise<MarkTeamFitReportProcessingFailedResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return { ok: false, reason: "invalid_payload", message: "teamFitReportId is required." };
  }

  if (!isNonEmptyString(input.organizationId)) {
    return { ok: false, reason: "invalid_payload", message: "organizationId is required." };
  }

  if (!isNonEmptyString(input.errorMessage)) {
    return { ok: false, reason: "invalid_payload", message: "errorMessage is required." };
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const now = deps.now ?? (() => new Date().toISOString());
  const reportRow = await loadTeamFitReportRowForOrganization({
    teamFitReportId: input.teamFitReportId,
    organizationId: input.organizationId,
    supabase,
  });

  if (!reportRow) {
    return {
      ok: false,
      reason: "report_not_found",
      message: "Team Fit report row was not found for this organization.",
    };
  }

  const report = mapRow(reportRow);

  if (reportRow.report_status === "ready") {
    return { ok: false, reason: "already_ready", message: "Ready Team Fit reports cannot be failed.", report };
  }

  if (reportRow.report_status === "failed") {
    return { ok: false, reason: "already_failed", message: "Team Fit report is already failed.", report };
  }

  if (reportRow.report_status !== "processing") {
    return {
      ok: false,
      reason: "not_processing",
      message: "Only processing Team Fit reports can be marked failed.",
      report,
    };
  }

  const failedAt = now();
  const { data, error } = await supabase
    .from("team_fit_reports")
    .update({
      report_status: "failed",
      failed_at: failedAt,
      error_message: input.errorMessage.trim(),
    })
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "processing")
    .select(TEAM_FIT_REPORT_ROW_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "update_failed",
      message: `Failed to mark Team Fit report as failed: ${error.message}`,
      report,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "not_fail_claimable",
      message: "Team Fit report could not be marked failed because it is no longer processing.",
      report,
    };
  }

  const failed = mapRow(data as TeamFitReportRow);

  return {
    ok: true,
    reportId: failed.id,
    status: "failed",
    report: failed,
  };
}

export async function resetFailedTeamFitReportToQueued(
  input: ResetFailedTeamFitReportToQueuedInput,
  deps: TeamFitReportLifecycleDependencies = {},
): Promise<ResetFailedTeamFitReportToQueuedResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return { ok: false, reason: "invalid_payload", message: "teamFitReportId is required." };
  }

  if (!isNonEmptyString(input.organizationId)) {
    return { ok: false, reason: "invalid_payload", message: "organizationId is required." };
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const now = deps.now ?? (() => new Date().toISOString());
  const reportRow = await loadTeamFitReportRowForOrganization({ ...input, supabase });

  if (!reportRow) {
    return {
      ok: false,
      reason: "report_not_found",
      message: "Team Fit report row was not found for this organization.",
    };
  }

  const report = mapRow(reportRow);

  if (reportRow.report_status === "queued") {
    return { ok: false, reason: "already_queued", message: "Team Fit report is already queued.", report };
  }

  if (reportRow.report_status === "processing") {
    return {
      ok: false,
      reason: "processing_not_resettable",
      message: "Processing Team Fit reports are not resettable.",
      report,
    };
  }

  if (reportRow.report_status === "ready") {
    return {
      ok: false,
      reason: "ready_not_resettable",
      message: "Ready Team Fit reports are not resettable.",
      report,
    };
  }

  if (reportRow.report_status !== "failed") {
    return {
      ok: false,
      reason: "not_resettable",
      message: "Team Fit report cannot be reset to queued from its current state.",
      report,
    };
  }

  const queuedAt = now();
  const { data, error } = await supabase
    .from("team_fit_reports")
    .update({
      report_status: "queued",
      queued_at: queuedAt,
      started_at: null,
      failed_at: null,
      completed_at: null,
      error_message: null,
    })
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "failed")
    .select(TEAM_FIT_REPORT_ROW_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "update_failed",
      message: `Failed to reset Team Fit report to queued: ${error.message}`,
      report,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "not_resettable",
      message: "Team Fit report could not be reset because it is no longer failed.",
      report,
    };
  }

  const reset = mapRow(data as TeamFitReportRow);

  return {
    ok: true,
    reportId: reset.id,
    status: "queued",
    report: reset,
  };
}
