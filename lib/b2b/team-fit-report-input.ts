import "server-only";

import {
  TEAM_FIT_CANDIDATE_SOURCE_TYPE,
  TEAM_FIT_REPORT_TYPE,
  TEAM_FIT_REPORT_VERSION,
  TEAM_FIT_TEAM_SOURCE_TYPE,
  type TeamFitReportStatus,
} from "@/lib/b2b/team-fit-report-lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamFitReportInputDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
};

type TeamFitReportRow = {
  id: string;
  organization_id: string;
  team_id: string;
  participant_id: string;
  candidate_source_type: string;
  candidate_source_id: string | null;
  team_source_type: string;
  team_source_id: string | null;
  optional_context: Record<string, unknown> | null;
  report_type: string;
  report_version: string;
  report_status: TeamFitReportStatus;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  created_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
};

type ParticipantRow = {
  id: string;
  organization_id: string;
  full_name: string;
};

export const TEAM_FIT_REPORT_INPUT_TYPE = "team_fit_report_input_v1" as const;
export const TEAM_FIT_REPORT_INPUT_VERSION = "team_fit_report_input_v1" as const;

export type TeamFitReportInputSnapshot = {
  inputType: typeof TEAM_FIT_REPORT_INPUT_TYPE;
  inputVersion: typeof TEAM_FIT_REPORT_INPUT_VERSION;
  reportType: typeof TEAM_FIT_REPORT_TYPE;
  reportVersion: typeof TEAM_FIT_REPORT_VERSION;
  locale: string;
  generatedAt: string;
  organizationContext: {
    organizationId: string;
    organizationName: string | null;
  };
  teamContext: {
    teamId: string;
    teamName: string | null;
    teamSourceType: typeof TEAM_FIT_TEAM_SOURCE_TYPE;
    teamSourceId: string | null;
  };
  candidateContext: {
    participantId: string;
    displayName: string | null;
    candidateSourceType: typeof TEAM_FIT_CANDIDATE_SOURCE_TYPE;
    candidateSourceId: string | null;
  };
  sourceReferences: {
    teamFitReportId: string;
    candidateSourceType: typeof TEAM_FIT_CANDIDATE_SOURCE_TYPE;
    candidateSourceId: string | null;
    teamSourceType: typeof TEAM_FIT_TEAM_SOURCE_TYPE;
    teamSourceId: string | null;
    executiveOverviewContextIncluded: false;
    roleContextIncluded: false;
  };
  candidateSignals: {
    sourceStatus: "placeholder_pending_composite_input" | "available";
    summary: Record<string, unknown> | null;
  };
  teamSignals: {
    sourceStatus: "placeholder_pending_team_aggregation_input" | "available";
    summary: Record<string, unknown> | null;
  };
  interpretationGuardrails: {
    noNumericFitScore: true;
    noHireNoHire: true;
    noRawTeamMemberAnswers: true;
    noIndividualTeamMemberScoreDisplay: true;
    noCandidateFacingOutput: true;
  };
};

export type BuildTeamFitReportInputSnapshotResult =
  | {
      ok: true;
      reportId: string;
      inputSnapshot: TeamFitReportInputSnapshot;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "report_contract_mismatch"
        | "report_not_queued"
        | "organization_not_found"
        | "team_not_found"
        | "participant_not_found"
        | "unsupported_candidate_source_type"
        | "unsupported_team_source_type"
        | "invalid_existing_input_snapshot";
      message: string;
    };

export type PersistTeamFitReportInputSnapshotResult =
  | {
      ok: true;
      reportId: string;
      inputSnapshot: TeamFitReportInputSnapshot;
    }
  | (BuildTeamFitReportInputSnapshotResult & { ok: false })
  | {
      ok: false;
      reason: "update_failed";
      message: string;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function buildFailure(
  reason: Extract<BuildTeamFitReportInputSnapshotResult, { ok: false }>['reason'],
  message: string,
): BuildTeamFitReportInputSnapshotResult {
  return { ok: false, reason, message };
}

function resolveLocale(value: unknown): string {
  if (isRecord(value) && isNonEmptyString(value.locale)) {
    return value.locale.trim();
  }

  return "bs";
}

function isTeamFitReportInputSnapshot(value: unknown): value is TeamFitReportInputSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.inputType === TEAM_FIT_REPORT_INPUT_TYPE &&
    value.inputVersion === TEAM_FIT_REPORT_INPUT_VERSION &&
    value.reportType === TEAM_FIT_REPORT_TYPE &&
    value.reportVersion === TEAM_FIT_REPORT_VERSION &&
    isNonEmptyString(value.locale) &&
    isNonEmptyString(value.generatedAt) &&
    isRecord(value.organizationContext) &&
    isNonEmptyString(value.organizationContext.organizationId) &&
    isRecord(value.teamContext) &&
    isNonEmptyString(value.teamContext.teamId) &&
    value.teamContext.teamSourceType === TEAM_FIT_TEAM_SOURCE_TYPE &&
    isRecord(value.candidateContext) &&
    isNonEmptyString(value.candidateContext.participantId) &&
    value.candidateContext.candidateSourceType === TEAM_FIT_CANDIDATE_SOURCE_TYPE &&
    isRecord(value.sourceReferences) &&
    value.sourceReferences.teamFitReportId !== undefined &&
    value.sourceReferences.executiveOverviewContextIncluded === false &&
    value.sourceReferences.roleContextIncluded === false &&
    isRecord(value.candidateSignals) &&
    (value.candidateSignals.sourceStatus === "placeholder_pending_composite_input" ||
      value.candidateSignals.sourceStatus === "available") &&
    isRecord(value.teamSignals) &&
    (value.teamSignals.sourceStatus === "placeholder_pending_team_aggregation_input" ||
      value.teamSignals.sourceStatus === "available") &&
    isRecord(value.interpretationGuardrails) &&
    value.interpretationGuardrails.noNumericFitScore === true &&
    value.interpretationGuardrails.noHireNoHire === true &&
    value.interpretationGuardrails.noRawTeamMemberAnswers === true &&
    value.interpretationGuardrails.noIndividualTeamMemberScoreDisplay === true &&
    value.interpretationGuardrails.noCandidateFacingOutput === true
  );
}

async function loadReportRow(input: {
  teamFitReportId: string;
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamFitReportRow | null> {
  const { data, error } = await input.supabase
    .from("team_fit_reports")
    .select(
      "id, organization_id, team_id, participant_id, candidate_source_type, candidate_source_id, team_source_type, team_source_id, optional_context, report_type, report_version, report_status, input_snapshot, report_snapshot, created_at",
    )
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit report row: ${error.message}`);
  }

  return (data as TeamFitReportRow | null) ?? null;
}

async function loadOrganizationContext(input: {
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; organization: OrganizationRow } | { ok: false; message: string }> {
  const { data, error } = await input.supabase
    .from("organizations")
    .select("id, name")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Failed to load Team Fit organization context: ${error.message}` };
  }

  if (!data) {
    return { ok: false, message: "Team Fit organization context was not found." };
  }

  return { ok: true, organization: data as OrganizationRow };
}

async function loadTeamContext(input: {
  organizationId: string;
  teamId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; team: TeamRow } | { ok: false; message: string }> {
  const { data, error } = await input.supabase
    .from("teams")
    .select("id, organization_id, name, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Failed to load Team Fit team context: ${error.message}` };
  }

  const team = (data as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    return { ok: false, message: "Team Fit team context was not found." };
  }

  return { ok: true, team };
}

async function loadParticipantContext(input: {
  organizationId: string;
  participantId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<{ ok: true; participant: ParticipantRow } | { ok: false; message: string }> {
  const { data, error } = await input.supabase
    .from("participants")
    .select("id, organization_id, full_name")
    .eq("id", input.participantId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: `Failed to load Team Fit participant context: ${error.message}` };
  }

  if (!data) {
    return { ok: false, message: "Team Fit participant context was not found." };
  }

  return { ok: true, participant: data as ParticipantRow };
}

export async function buildTeamFitReportInputSnapshot(input: {
  teamFitReportId: string;
  organizationId: string;
}, deps: TeamFitReportInputDependencies = {}): Promise<BuildTeamFitReportInputSnapshotResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return buildFailure("invalid_payload", "teamFitReportId is required.");
  }

  if (!isNonEmptyString(input.organizationId)) {
    return buildFailure("invalid_payload", "organizationId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const reportRow = await loadReportRow({
    teamFitReportId: input.teamFitReportId,
    organizationId: input.organizationId,
    supabase,
  });

  if (!reportRow) {
    return buildFailure("report_not_found", "Team Fit report row was not found.");
  }

  if (
    reportRow.report_type !== TEAM_FIT_REPORT_TYPE ||
    reportRow.report_version !== TEAM_FIT_REPORT_VERSION
  ) {
    return buildFailure(
      "report_contract_mismatch",
      "Team Fit report row does not match the expected report type/version contract.",
    );
  }

  if (reportRow.candidate_source_type !== TEAM_FIT_CANDIDATE_SOURCE_TYPE) {
    return buildFailure(
      "unsupported_candidate_source_type",
      `Team Fit candidate source type must be ${TEAM_FIT_CANDIDATE_SOURCE_TYPE}.`,
    );
  }

  if (reportRow.team_source_type !== TEAM_FIT_TEAM_SOURCE_TYPE) {
    return buildFailure(
      "unsupported_team_source_type",
      `Team Fit team source type must be ${TEAM_FIT_TEAM_SOURCE_TYPE}.`,
    );
  }

  if (reportRow.input_snapshot !== null) {
    if (isTeamFitReportInputSnapshot(reportRow.input_snapshot)) {
      return {
        ok: true,
        reportId: reportRow.id,
        inputSnapshot: reportRow.input_snapshot,
      };
    }

    return buildFailure(
      "invalid_existing_input_snapshot",
      "Team Fit report row contains an invalid persisted input snapshot.",
    );
  }

  if (reportRow.report_status !== "queued" && reportRow.report_status !== "processing") {
    return buildFailure(
      "report_not_queued",
      "Team Fit report input snapshot can only be built for queued or processing report rows when no persisted snapshot exists.",
    );
  }

  const organizationContext = await loadOrganizationContext({
    organizationId: reportRow.organization_id,
    supabase,
  });

  if (!organizationContext.ok) {
    return buildFailure("organization_not_found", organizationContext.message);
  }

  const teamContext = await loadTeamContext({
    organizationId: reportRow.organization_id,
    teamId: reportRow.team_id,
    supabase,
  });

  if (!teamContext.ok) {
    return buildFailure("team_not_found", teamContext.message);
  }

  const participantContext = await loadParticipantContext({
    organizationId: reportRow.organization_id,
    participantId: reportRow.participant_id,
    supabase,
  });

  if (!participantContext.ok) {
    return buildFailure("participant_not_found", participantContext.message);
  }

  const snapshot: TeamFitReportInputSnapshot = {
    inputType: TEAM_FIT_REPORT_INPUT_TYPE,
    inputVersion: TEAM_FIT_REPORT_INPUT_VERSION,
    reportType: TEAM_FIT_REPORT_TYPE,
    reportVersion: TEAM_FIT_REPORT_VERSION,
    locale: resolveLocale(reportRow.optional_context),
    generatedAt: reportRow.created_at,
    organizationContext: {
      organizationId: organizationContext.organization.id,
      organizationName: organizationContext.organization.name ?? null,
    },
    teamContext: {
      teamId: teamContext.team.id,
      teamName: teamContext.team.name ?? null,
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: reportRow.team_source_id,
    },
    candidateContext: {
      participantId: participantContext.participant.id,
      displayName: participantContext.participant.full_name ?? null,
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: reportRow.candidate_source_id,
    },
    sourceReferences: {
      teamFitReportId: reportRow.id,
      candidateSourceType: TEAM_FIT_CANDIDATE_SOURCE_TYPE,
      candidateSourceId: reportRow.candidate_source_id,
      teamSourceType: TEAM_FIT_TEAM_SOURCE_TYPE,
      teamSourceId: reportRow.team_source_id,
      executiveOverviewContextIncluded: false,
      roleContextIncluded: false,
    },
    candidateSignals: {
      sourceStatus: "placeholder_pending_composite_input",
      summary: null,
    },
    teamSignals: {
      sourceStatus: "placeholder_pending_team_aggregation_input",
      summary: null,
    },
    interpretationGuardrails: {
      noNumericFitScore: true,
      noHireNoHire: true,
      noRawTeamMemberAnswers: true,
      noIndividualTeamMemberScoreDisplay: true,
      noCandidateFacingOutput: true,
    },
  };

  return {
    ok: true,
    reportId: reportRow.id,
    inputSnapshot: snapshot,
  };
}

export async function persistTeamFitReportInputSnapshot(input: {
  teamFitReportId: string;
  organizationId: string;
}, deps: TeamFitReportInputDependencies = {}): Promise<PersistTeamFitReportInputSnapshotResult> {
  const buildResult = await buildTeamFitReportInputSnapshot(input, deps);

  if (!buildResult.ok) {
    return buildResult;
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const reportRow = await loadReportRow({
    teamFitReportId: input.teamFitReportId,
    organizationId: input.organizationId,
    supabase,
  });

  if (!reportRow) {
    return {
      ok: false,
      reason: "update_failed",
      message: "Team Fit report row was not found during input snapshot persistence.",
    };
  }

  if (isTeamFitReportInputSnapshot(reportRow.input_snapshot)) {
    return buildResult;
  }

  const { data, error } = await supabase
    .from("team_fit_reports")
    .update({
      input_snapshot: buildResult.inputSnapshot,
    })
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      reason: "update_failed",
      message: `Failed to persist Team Fit report input snapshot: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      reason: "update_failed",
      message: "Team Fit report input snapshot update did not match a report row.",
    };
  }

  return buildResult;
}
