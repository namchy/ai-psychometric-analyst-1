import "server-only";

import {
  loadTeamDynamicsFinalAggregationVerification,
  type TeamDynamicsFinalAggregationReadResult,
} from "@/lib/assessment/team-dynamics-final-aggregation-read";
import {
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
  type TeamDynamicsReportStatus,
} from "@/lib/b2b/team-dynamics-report-lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamDynamicsReportInputDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  loadFinalAggregationVerification?: typeof loadTeamDynamicsFinalAggregationVerification;
};

type TeamAssessmentReportRow = {
  id: string;
  organization_id: string;
  team_id: string;
  team_assessment_assignment_id: string;
  selection_draft_id: string;
  aggregation_snapshot_id: string | null;
  report_type: string;
  report_version: string;
  report_status: TeamDynamicsReportStatus;
  included_member_ids_snapshot: unknown;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  created_at: string;
};

type TeamRow = {
  id: string;
  organization_id: string;
  name: string;
  archived_at: string | null;
};

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
  package_slug: string;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TeamAssessmentSelectionMemberRow = {
  team_assessment_participant_id: string;
};

export const TEAM_DYNAMICS_REPORT_INPUT_TYPE = "team_dynamics_report_input_v1";
export const TEAM_DYNAMICS_REPORT_INPUT_VERSION = "team_dynamics_report_input_v1";

export type TeamDynamicsReportInputSnapshot = {
  inputType: typeof TEAM_DYNAMICS_REPORT_INPUT_TYPE;
  inputVersion: typeof TEAM_DYNAMICS_REPORT_INPUT_VERSION;
  reportType: string;
  reportVersion: string;
  teamAssessmentReportId: string;
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  selectionDraftId: string;
  aggregationSnapshotId: string;
  includedMemberCount: number;
  includedMemberIdsSnapshot: string[];
  teamContext: {
    teamName: string | null;
    assignment: {
      packageSlug: string;
      status: string;
      openedAt: string | null;
      closedAt: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
  aggregationSummary: {
    aggregationVersion: string;
    aggregationSnapshotId: string;
    calculatedAt: string | null;
    includedMemberCount: number | null;
    completedMemberCount: number | null;
    readyScoredMemberCount: number | null;
    incompleteMemberCount: number | null;
    missingScoreCount: number | null;
    invalidScoreCount: number | null;
    scoreEntryAggregations: TeamDynamicsFinalAggregationReadResult["scoreEntryAggregations"];
    tdmBlockAggregationPresent: boolean;
    tdmDomainAggregationsPresent: boolean;
    psychologicalSafetyAggregationPresent: boolean;
    sjtAggregationPresent: boolean;
    outcomePulseAggregationPresent: boolean;
  };
  guardrails: {
    noHireNoHire: true;
    noIndividualNamingInMainReport: true;
    noRawResponseAnalysis: true;
    reportScope: "team_level_only";
    teamFitOutputExcluded: true;
  };
  createdAt: string;
};

export type BuildTeamDynamicsReportInputSnapshotResult =
  | {
      ok: true;
      snapshot: TeamDynamicsReportInputSnapshot;
      reportRowId: string;
    }
  | {
      ok: false;
      code:
        | "invalid_payload"
        | "report_not_found"
        | "report_not_queued"
        | "team_not_found"
        | "assignment_not_found"
        | "assignment_mismatch"
        | "selection_snapshot_empty"
        | "selection_snapshot_mismatch"
        | "aggregation_not_ready";
      reason: string;
    };

export type PersistTeamDynamicsReportInputSnapshotResult =
  | {
      ok: true;
      snapshot: TeamDynamicsReportInputSnapshot;
      reportRowId: string;
    }
  | (BuildTeamDynamicsReportInputSnapshotResult & { ok: false })
  | {
      ok: false;
      code: "update_failed";
      reason: string;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => isNonEmptyString(entry));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => isNonEmptyString(value)))).sort();
}

function buildFailure(
  code: Extract<
    BuildTeamDynamicsReportInputSnapshotResult,
    { ok: false }
  >["code"],
  reason: string,
): BuildTeamDynamicsReportInputSnapshotResult {
  return {
    ok: false,
    code,
    reason,
  };
}

async function loadReportRow(input: {
  teamAssessmentReportId: string;
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamAssessmentReportRow | null> {
  const { data, error } = await input.supabase
    .from("team_assessment_reports")
    .select(
      "id, organization_id, team_id, team_assessment_assignment_id, selection_draft_id, aggregation_snapshot_id, report_type, report_version, report_status, included_member_ids_snapshot, input_snapshot, report_snapshot, created_at",
    )
    .eq("id", input.teamAssessmentReportId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Dynamics report row: ${error.message}`);
  }

  return (data as TeamAssessmentReportRow | null) ?? null;
}

async function loadTeamContext(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<
  | {
      ok: true;
      team: TeamRow;
      assignment: TeamAssessmentAssignmentRow;
    }
  | {
      ok: false;
      code: "team_not_found" | "assignment_not_found" | "assignment_mismatch";
      reason: string;
    }
> {
  const { data: teamData, error: teamError } = await input.supabase
    .from("teams")
    .select("id, organization_id, name, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (teamError) {
    return {
      ok: false,
      code: "team_not_found",
      reason: `Failed to load Team Dynamics report input team context: ${teamError.message}`,
    };
  }

  const team = (teamData as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    return {
      ok: false,
      code: "team_not_found",
      reason: "Team Dynamics report input team was not found.",
    };
  }

  const { data: assignmentData, error: assignmentError } = await input.supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug, status, opened_at, closed_at, created_at, updated_at")
    .eq("id", input.teamAssessmentAssignmentId)
    .maybeSingle();

  if (assignmentError) {
    return {
      ok: false,
      code: "assignment_not_found",
      reason: `Failed to load Team Dynamics report input assignment context: ${assignmentError.message}`,
    };
  }

  const assignment = (assignmentData as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return {
      ok: false,
      code: "assignment_not_found",
      reason: "Team Dynamics report input assignment was not found.",
    };
  }

  if (assignment.team_id !== input.teamId) {
    return {
      ok: false,
      code: "assignment_mismatch",
      reason: "Team Dynamics report input assignment does not belong to the provided team context.",
    };
  }

  return {
    ok: true,
    team,
    assignment,
  };
}

async function loadCurrentSelectionSnapshot(input: {
  selectionDraftId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<string[]> {
  const { data, error } = await input.supabase
    .from("team_assessment_report_selection_members")
    .select("team_assessment_participant_id")
    .eq("selection_draft_id", input.selectionDraftId);

  if (error) {
    throw new Error(
      `Failed to load Team Dynamics report input selection snapshot: ${error.message}`,
    );
  }

  const rows = (data ?? []) as TeamAssessmentSelectionMemberRow[];
  return uniqueSorted(rows.map((row) => row.team_assessment_participant_id));
}

function areEqualStringSets(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export async function buildTeamDynamicsReportInputSnapshot(input: {
  teamAssessmentReportId: string;
  organizationId: string;
}, deps: TeamDynamicsReportInputDependencies = {}): Promise<BuildTeamDynamicsReportInputSnapshotResult> {
  if (!isNonEmptyString(input.teamAssessmentReportId)) {
    return buildFailure("invalid_payload", "teamAssessmentReportId is required.");
  }

  if (!isNonEmptyString(input.organizationId)) {
    return buildFailure("invalid_payload", "organizationId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadFinalAggregationVerification =
    deps.loadFinalAggregationVerification ?? loadTeamDynamicsFinalAggregationVerification;

  const reportRow = await loadReportRow({
    teamAssessmentReportId: input.teamAssessmentReportId,
    organizationId: input.organizationId,
    supabase,
  });

  if (!reportRow) {
    return buildFailure("report_not_found", "Team Dynamics report row was not found.");
  }

  if (reportRow.report_status !== "queued") {
    return buildFailure(
      "report_not_queued",
      "Team Dynamics report input snapshot can only be built for queued report rows.",
    );
  }

  const includedMemberIdsSnapshot = uniqueSorted(
    toStringArray(reportRow.included_member_ids_snapshot),
  );

  if (includedMemberIdsSnapshot.length === 0) {
    return buildFailure(
      "selection_snapshot_empty",
      "Team Dynamics report input requires at least one included member snapshot entry.",
    );
  }

  const context = await loadTeamContext({
    organizationId: input.organizationId,
    teamId: reportRow.team_id,
    teamAssessmentAssignmentId: reportRow.team_assessment_assignment_id,
    supabase,
  });

  if (!context.ok) {
    return context;
  }

  const currentSelectionSnapshot = await loadCurrentSelectionSnapshot({
    selectionDraftId: reportRow.selection_draft_id,
    supabase,
  });

  if (currentSelectionSnapshot.length === 0) {
    return buildFailure(
      "selection_snapshot_empty",
      "Team Dynamics report input selection draft is currently empty.",
    );
  }

  if (!areEqualStringSets(includedMemberIdsSnapshot, currentSelectionSnapshot)) {
    return buildFailure(
      "selection_snapshot_mismatch",
      "Team Dynamics report input selection snapshot no longer matches the current draft inclusion set.",
    );
  }

  const aggregationVerification = await loadFinalAggregationVerification(
    {
      teamAssessmentAssignmentId: reportRow.team_assessment_assignment_id,
    },
    {
      supabase,
    },
  );

  if (
    aggregationVerification.status !== "ready" ||
    !isNonEmptyString(aggregationVerification.aggregationSnapshotId) ||
    !isRecord(aggregationVerification.aggregationSnapshot)
  ) {
    return buildFailure(
      "aggregation_not_ready",
      "Team Dynamics report input requires a ready verified final aggregation snapshot.",
    );
  }

  if (
    reportRow.aggregation_snapshot_id !== null &&
    aggregationVerification.aggregationSnapshotId !== reportRow.aggregation_snapshot_id
  ) {
    return buildFailure(
      "aggregation_not_ready",
      "Team Dynamics report input aggregation snapshot does not match the queued report row.",
    );
  }

  const snapshot: TeamDynamicsReportInputSnapshot = {
    inputType: TEAM_DYNAMICS_REPORT_INPUT_TYPE,
    inputVersion: TEAM_DYNAMICS_REPORT_INPUT_VERSION,
    reportType: reportRow.report_type || TEAM_DYNAMICS_REPORT_TYPE,
    reportVersion: reportRow.report_version || TEAM_DYNAMICS_REPORT_VERSION,
    teamAssessmentReportId: reportRow.id,
    organizationId: reportRow.organization_id,
    teamId: reportRow.team_id,
    teamAssessmentAssignmentId: reportRow.team_assessment_assignment_id,
    selectionDraftId: reportRow.selection_draft_id,
    aggregationSnapshotId: aggregationVerification.aggregationSnapshotId,
    includedMemberCount: includedMemberIdsSnapshot.length,
    includedMemberIdsSnapshot,
    teamContext: {
      teamName: context.team.name ?? null,
      assignment: {
        packageSlug: context.assignment.package_slug,
        status: context.assignment.status,
        openedAt: context.assignment.opened_at,
        closedAt: context.assignment.closed_at,
        createdAt: context.assignment.created_at,
        updatedAt: context.assignment.updated_at,
      },
    },
    aggregationSummary: {
      aggregationVersion: aggregationVerification.aggregationVersion,
      aggregationSnapshotId: aggregationVerification.aggregationSnapshotId,
      calculatedAt: aggregationVerification.calculatedAt,
      includedMemberCount: aggregationVerification.includedMemberCount,
      completedMemberCount: aggregationVerification.completedMemberCount,
      readyScoredMemberCount: aggregationVerification.readyScoredMemberCount,
      incompleteMemberCount: aggregationVerification.incompleteMemberCount,
      missingScoreCount: aggregationVerification.missingScoreCount,
      invalidScoreCount: aggregationVerification.invalidScoreCount,
      scoreEntryAggregations: aggregationVerification.scoreEntryAggregations,
      tdmBlockAggregationPresent: aggregationVerification.hasTdmBlockAggregation,
      tdmDomainAggregationsPresent: aggregationVerification.hasTdmDomainAggregations,
      psychologicalSafetyAggregationPresent:
        aggregationVerification.hasPsychologicalSafetyAggregation,
      sjtAggregationPresent: aggregationVerification.hasSjtAggregation,
      outcomePulseAggregationPresent: aggregationVerification.hasOutcomePulseAggregation,
    },
    guardrails: {
      noHireNoHire: true,
      noIndividualNamingInMainReport: true,
      noRawResponseAnalysis: true,
      reportScope: "team_level_only",
      teamFitOutputExcluded: true,
    },
    createdAt: new Date().toISOString(),
  };

  return {
    ok: true,
    snapshot,
    reportRowId: reportRow.id,
  };
}

export async function persistTeamDynamicsReportInputSnapshot(input: {
  teamAssessmentReportId: string;
  organizationId: string;
}, deps: TeamDynamicsReportInputDependencies = {}): Promise<PersistTeamDynamicsReportInputSnapshotResult> {
  const buildResult = await buildTeamDynamicsReportInputSnapshot(input, deps);

  if (!buildResult.ok) {
    return buildResult;
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("team_assessment_reports")
    .update({
      input_snapshot: buildResult.snapshot,
    })
    .eq("id", input.teamAssessmentReportId)
    .eq("organization_id", input.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "update_failed",
      reason: `Failed to persist Team Dynamics report input snapshot: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "update_failed",
      reason: "Team Dynamics report input snapshot update did not match a report row.",
    };
  }

  return buildResult;
}
