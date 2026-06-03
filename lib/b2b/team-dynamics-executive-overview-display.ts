import "server-only";

import {
  TEAM_DYNAMICS_REPORT_VERSION,
  type TeamDynamicsReportStatus,
} from "@/lib/b2b/team-dynamics-report-lifecycle";
import {
  validateTeamDynamicsExecutiveOverviewSnapshot,
  type TeamDynamicsExecutiveOverviewSnapshot,
} from "@/lib/b2b/team-dynamics-executive-overview-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamAssessmentReportDisplayRow = {
  id: string;
  organization_id: string;
  team_id: string;
  team_assessment_assignment_id: string;
  report_type: string;
  report_version: string;
  report_status: TeamDynamicsReportStatus;
  generator_type: string | null;
  model_name: string | null;
  included_member_ids_snapshot: unknown;
  report_snapshot: Record<string, unknown> | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type TeamDynamicsExecutiveOverviewDisplayDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  validateSnapshot?: typeof validateTeamDynamicsExecutiveOverviewSnapshot;
};

export type TeamDynamicsExecutiveOverviewReportDisplayRecord = {
  id: string;
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  reportType: string;
  reportVersion: string;
  reportStatus: TeamDynamicsReportStatus;
  generatorType: string | null;
  modelName: string | null;
  includedMemberIdsSnapshot: string[];
  reportSnapshot: Record<string, unknown> | null;
  errorMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamDynamicsExecutiveOverviewDisplayResult =
  | {
      status: "ready";
      report: TeamDynamicsExecutiveOverviewReportDisplayRecord;
      snapshot: TeamDynamicsExecutiveOverviewSnapshot;
    }
  | {
      status: "queued" | "processing" | "failed";
      report: TeamDynamicsExecutiveOverviewReportDisplayRecord;
      message: string;
    }
  | {
      status: "invalid_snapshot";
      report: TeamDynamicsExecutiveOverviewReportDisplayRecord;
      message: string;
      validationErrors: string[];
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

function mapRow(row: TeamAssessmentReportDisplayRow): TeamDynamicsExecutiveOverviewReportDisplayRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    teamAssessmentAssignmentId: row.team_assessment_assignment_id,
    reportType: row.report_type,
    reportVersion: row.report_version,
    reportStatus: row.report_status,
    generatorType: row.generator_type,
    modelName: row.model_name,
    includedMemberIdsSnapshot: uniqueStrings(toStringArray(row.included_member_ids_snapshot)),
    reportSnapshot: row.report_snapshot,
    errorMessage: row.error_message,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getStatusMessage(status: TeamDynamicsReportStatus): string {
  switch (status) {
    case "queued":
      return "Izvještaj čeka obradu.";
    case "processing":
      return "Izvještaj se obrađuje.";
    case "failed":
      return "Izvještaj nije uspješno kreiran.";
    default:
      return "Izvještaj trenutno nije dostupan.";
  }
}

export async function loadTeamDynamicsExecutiveOverviewReportForDisplay(input: {
  organizationId: string;
  teamId: string;
  teamAssessmentReportId: string;
}, deps: TeamDynamicsExecutiveOverviewDisplayDependencies = {}): Promise<TeamDynamicsExecutiveOverviewDisplayResult | null> {
  if (!isNonEmptyString(input.organizationId)) {
    throw new Error("organizationId is required.");
  }

  if (!isNonEmptyString(input.teamId)) {
    throw new Error("teamId is required.");
  }

  if (!isNonEmptyString(input.teamAssessmentReportId)) {
    throw new Error("teamAssessmentReportId is required.");
  }

  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const validateSnapshot =
    deps.validateSnapshot ?? validateTeamDynamicsExecutiveOverviewSnapshot;
  const { data, error } = await supabase
    .from("team_assessment_reports")
    .select(
      "id, organization_id, team_id, team_assessment_assignment_id, report_type, report_version, report_status, generator_type, model_name, included_member_ids_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at",
    )
    .eq("id", input.teamAssessmentReportId)
    .eq("organization_id", input.organizationId)
    .eq("team_id", input.teamId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Dynamics Executive Overview report: ${error.message}`);
  }

  const row = (data as TeamAssessmentReportDisplayRow | null) ?? null;

  if (!row) {
    return null;
  }

  const report = mapRow(row);

  if (row.report_status === "queued" || row.report_status === "processing" || row.report_status === "failed") {
    return {
      status: row.report_status,
      report,
      message: getStatusMessage(row.report_status),
    };
  }

  if (
    row.report_status !== "ready" ||
    row.report_version !== TEAM_DYNAMICS_REPORT_VERSION ||
    !row.report_snapshot
  ) {
    return {
      status: "invalid_snapshot",
      report,
      message: "Izvještaj trenutno nije dostupan.",
      validationErrors: [],
    };
  }

  const validation = validateSnapshot(row.report_snapshot);

  if (!validation.ok) {
    return {
      status: "invalid_snapshot",
      report,
      message: "Izvještaj trenutno nije dostupan.",
      validationErrors: validation.errors,
    };
  }

  return {
    status: "ready",
    report,
    snapshot: validation.value,
  };
}
