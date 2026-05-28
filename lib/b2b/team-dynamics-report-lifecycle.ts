import "server-only";

import { TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG } from "@/lib/assessment/team-dynamics";
import {
  loadTeamAssessmentAggregationVerification,
  type TeamAssessmentAggregationReadVerificationResult,
} from "@/lib/assessment/team-assessment-aggregation-read";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamRow = {
  id: string;
  organization_id: string;
  archived_at: string | null;
};

type TeamAssessmentAssignmentRow = {
  id: string;
  team_id: string;
  package_slug: string;
};

type TeamAssessmentReportSelectionDraftRow = {
  id: string;
  team_assessment_assignment_id: string;
  team_id: string;
};

type TeamAssessmentReportSelectionMemberRow = {
  team_assessment_participant_id: string;
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
  generator_type: string | null;
  model_name: string | null;
  included_member_ids_snapshot: unknown;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TeamDynamicsReportLifecycleDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  loadAggregationVerification?: typeof loadTeamAssessmentAggregationVerification;
};

export const TEAM_DYNAMICS_REPORT_TYPE = "team_dynamics_report_v1";
export const TEAM_DYNAMICS_REPORT_VERSION = "team_dynamics_report_v1";

export const TEAM_DYNAMICS_REPORT_STATUSES = [
  "queued",
  "processing",
  "ready",
  "failed",
] as const;

export type TeamDynamicsReportStatus =
  (typeof TEAM_DYNAMICS_REPORT_STATUSES)[number];

export type TeamDynamicsReportRowSummary = {
  id: string;
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  selectionDraftId: string;
  aggregationSnapshotId: string | null;
  reportType: string;
  reportVersion: string;
  reportStatus: TeamDynamicsReportStatus;
  generatorType: string | null;
  modelName: string | null;
  includedMemberIdsSnapshot: string[];
  inputSnapshot: Record<string, unknown> | null;
  reportSnapshot: Record<string, unknown> | null;
  errorMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QueueTeamDynamicsReportShellResult =
  | {
      ok: true;
      report: TeamDynamicsReportRowSummary;
      aggregationVerification: TeamAssessmentAggregationReadVerificationResult;
    }
  | {
      ok: false;
      code:
        | "invalid_payload"
        | "team_not_found"
        | "assignment_not_found"
        | "selection_draft_not_found"
        | "selection_draft_mismatch"
        | "aggregation_not_ready"
        | "insert_failed";
      reason: string;
      aggregationVerification?: TeamAssessmentAggregationReadVerificationResult;
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => isNonEmptyString(entry));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => isNonEmptyString(value)))).sort();
}

function mapRow(row: TeamAssessmentReportRow): TeamDynamicsReportRowSummary {
  return {
    id: row.id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    teamAssessmentAssignmentId: row.team_assessment_assignment_id,
    selectionDraftId: row.selection_draft_id,
    aggregationSnapshotId: row.aggregation_snapshot_id,
    reportType: row.report_type,
    reportVersion: row.report_version,
    reportStatus: row.report_status,
    generatorType: row.generator_type,
    modelName: row.model_name,
    includedMemberIdsSnapshot: uniqueStrings(toStringArray(row.included_member_ids_snapshot)),
    inputSnapshot: row.input_snapshot,
    reportSnapshot: row.report_snapshot,
    errorMessage: row.error_message,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadTeamAndAssignment(input: {
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
      code: "team_not_found" | "assignment_not_found";
      reason: string;
    }
> {
  const { data: teamData, error: teamError } = await input.supabase
    .from("teams")
    .select("id, organization_id, archived_at")
    .eq("id", input.teamId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (teamError) {
    return {
      ok: false,
      code: "team_not_found",
      reason: `Failed to load Team Dynamics report lane team: ${teamError.message}`,
    };
  }

  const team = (teamData as TeamRow | null) ?? null;

  if (!team || team.archived_at) {
    return {
      ok: false,
      code: "team_not_found",
      reason: "Team Dynamics report lane team was not found.",
    };
  }

  const { data: assignmentData, error: assignmentError } = await input.supabase
    .from("team_assessment_assignments")
    .select("id, team_id, package_slug")
    .eq("id", input.teamAssessmentAssignmentId)
    .eq("team_id", input.teamId)
    .eq("package_slug", TEAM_DYNAMICS_FINAL_ASSESSMENT_SLUG)
    .maybeSingle();

  if (assignmentError) {
    return {
      ok: false,
      code: "assignment_not_found",
      reason: `Failed to load Team Dynamics report lane assignment: ${assignmentError.message}`,
    };
  }

  const assignment = (assignmentData as TeamAssessmentAssignmentRow | null) ?? null;

  if (!assignment) {
    return {
      ok: false,
      code: "assignment_not_found",
      reason: "Team Dynamics report lane assignment was not found.",
    };
  }

  return {
    ok: true,
    team,
    assignment,
  };
}

async function loadSelectionDraft(input: {
  selectionDraftId: string;
  teamAssessmentAssignmentId: string;
  teamId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<
  | {
      ok: true;
      draft: TeamAssessmentReportSelectionDraftRow;
    }
  | {
      ok: false;
      code: "selection_draft_not_found" | "selection_draft_mismatch";
      reason: string;
    }
> {
  const { data: draftData, error: draftError } = await input.supabase
    .from("team_assessment_report_selection_drafts")
    .select("id, team_assessment_assignment_id, team_id")
    .eq("id", input.selectionDraftId)
    .maybeSingle();

  if (draftError) {
    return {
      ok: false,
      code: "selection_draft_not_found",
      reason: `Failed to load Team Dynamics report selection draft: ${draftError.message}`,
    };
  }

  const draft = (draftData as TeamAssessmentReportSelectionDraftRow | null) ?? null;

  if (!draft) {
    return {
      ok: false,
      code: "selection_draft_not_found",
      reason: "Team Dynamics report selection draft was not found.",
    };
  }

  if (
    draft.team_assessment_assignment_id !== input.teamAssessmentAssignmentId ||
    draft.team_id !== input.teamId
  ) {
    return {
      ok: false,
      code: "selection_draft_mismatch",
      reason: "Team Dynamics report selection draft does not belong to the provided assignment/team context.",
    };
  }

  return {
    ok: true,
    draft,
  };
}

async function loadIncludedMemberIdsSnapshot(input: {
  selectionDraftId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<string[]> {
  const { data, error } = await input.supabase
    .from("team_assessment_report_selection_members")
    .select("team_assessment_participant_id")
    .eq("selection_draft_id", input.selectionDraftId);

  if (error) {
    throw new Error(
      `Failed to load Team Dynamics report included member snapshot: ${error.message}`,
    );
  }

  const rows = (data ?? []) as TeamAssessmentReportSelectionMemberRow[];

  return uniqueStrings(rows.map((row) => row.team_assessment_participant_id));
}

export async function listTeamDynamicsReportRowsForAssignment(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
}, deps: TeamDynamicsReportLifecycleDependencies = {}): Promise<TeamDynamicsReportRowSummary[]> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.teamId)) {
    throw new Error("teamId is required.");
  }

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    throw new Error("teamAssessmentAssignmentId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const context = await loadTeamAndAssignment({
    organizationId: input.organizationId,
    teamId: input.teamId,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    supabase,
  });

  if (!context.ok) {
    throw new Error(context.reason);
  }

  const { data, error } = await supabase
    .from("team_assessment_reports")
    .select(
      "id, organization_id, team_id, team_assessment_assignment_id, selection_draft_id, aggregation_snapshot_id, report_type, report_version, report_status, generator_type, model_name, included_member_ids_snapshot, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("team_id", input.teamId)
    .eq("team_assessment_assignment_id", input.teamAssessmentAssignmentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error(`Failed to load Team Dynamics report rows: ${error.message}`);
  }

  return ((data ?? []) as TeamAssessmentReportRow[]).map(mapRow);
}

export async function queueTeamDynamicsReportShell(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  selectionDraftId: string;
}, deps: TeamDynamicsReportLifecycleDependencies = {}): Promise<QueueTeamDynamicsReportShellResult> {
  if (!isNonEmptyString(input.organizationId)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "organizationId is required.",
    };
  }

  if (!isNonEmptyString(input.teamId)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "teamId is required.",
    };
  }

  if (!isNonEmptyString(input.teamAssessmentAssignmentId)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "teamAssessmentAssignmentId is required.",
    };
  }

  if (!isNonEmptyString(input.selectionDraftId)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "selectionDraftId is required.",
    };
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const loadAggregationVerification =
    deps.loadAggregationVerification ?? loadTeamAssessmentAggregationVerification;

  const context = await loadTeamAndAssignment({
    organizationId: input.organizationId,
    teamId: input.teamId,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    supabase,
  });

  if (!context.ok) {
    return context;
  }

  const draftResult = await loadSelectionDraft({
    selectionDraftId: input.selectionDraftId,
    teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    teamId: input.teamId,
    supabase,
  });

  if (!draftResult.ok) {
    return draftResult;
  }

  const includedMemberIdsSnapshot = await loadIncludedMemberIdsSnapshot({
    selectionDraftId: input.selectionDraftId,
    supabase,
  });

  const aggregationVerification = await loadAggregationVerification(
    {
      teamAssessmentAssignmentId: input.teamAssessmentAssignmentId,
    },
    {
      supabase,
    },
  );

  if (
    aggregationVerification.verificationStatus !== "verified" ||
    aggregationVerification.aggregationStatus !== "ready" ||
    !isNonEmptyString(aggregationVerification.aggregationSnapshotId)
  ) {
    return {
      ok: false,
      code: "aggregation_not_ready",
      reason: "Team Dynamics aggregation snapshot is not ready for report queueing.",
      aggregationVerification,
    };
  }

  const queuedAt = new Date().toISOString();
  const insertPatch = {
    organization_id: input.organizationId,
    team_id: input.teamId,
    team_assessment_assignment_id: input.teamAssessmentAssignmentId,
    selection_draft_id: input.selectionDraftId,
    aggregation_snapshot_id: aggregationVerification.aggregationSnapshotId,
    report_type: TEAM_DYNAMICS_REPORT_TYPE,
    report_version: TEAM_DYNAMICS_REPORT_VERSION,
    report_status: "queued",
    included_member_ids_snapshot: includedMemberIdsSnapshot,
    queued_at: queuedAt,
  } as const;

  const { data, error } = await supabase
    .from("team_assessment_reports")
    .insert(insertPatch)
    .select(
      "id, organization_id, team_id, team_assessment_assignment_id, selection_draft_id, aggregation_snapshot_id, report_type, report_version, report_status, generator_type, model_name, included_member_ids_snapshot, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    return {
      ok: false,
      code: "insert_failed",
      reason: `Failed to queue Team Dynamics report shell row: ${error.message}`,
      aggregationVerification,
    };
  }

  return {
    ok: true,
    report: mapRow(data as TeamAssessmentReportRow),
    aggregationVerification,
  };
}
