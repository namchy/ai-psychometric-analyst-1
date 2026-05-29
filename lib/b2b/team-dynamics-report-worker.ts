import "server-only";

import {
  processTeamDynamicsExecutiveOverviewWithOpenAI,
  TEAM_DYNAMICS_REPORT_TYPE,
  TEAM_DYNAMICS_REPORT_VERSION,
  type ProcessTeamDynamicsExecutiveOverviewOpenAiResult,
} from "@/lib/b2b/team-dynamics-report-lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamDynamicsReportWorkerRow = {
  id: string;
  organization_id: string;
  team_id: string;
  team_assessment_assignment_id: string;
  selection_draft_id: string;
  aggregation_snapshot_id: string | null;
  report_type: string;
  report_version: string;
  report_status: "queued";
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

export type TeamDynamicsWorkerEligibleReport = {
  id: string;
  organizationId: string;
  teamId: string;
  teamAssessmentAssignmentId: string;
  selectionDraftId: string;
  aggregationSnapshotId: string | null;
  reportType: string;
  reportVersion: string;
  reportStatus: "queued";
  queuedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TeamDynamicsReportWorkerDependencies = {
  createSupabaseClient?: typeof createSupabaseAdminClient;
  processReport?: typeof processTeamDynamicsExecutiveOverviewWithOpenAI;
};

export type TeamDynamicsReportWorkerOptions = {
  limit?: number;
  dryRun?: boolean;
};

export type TeamDynamicsReportWorkerProcessEntry = {
  reportId: string;
  organizationId: string;
  outcome: "ready" | "failed" | "claim_not_acquired" | "error";
  operation?: ProcessTeamDynamicsExecutiveOverviewOpenAiResult["operation"];
  marker?: string;
  reason?: string;
};

export type TeamDynamicsReportWorkerDryRunResult = {
  ok: true;
  dryRun: true;
  requestedLimit: number;
  appliedLimit: number;
  eligibleCount: number;
  wouldProcessCount: number;
  eligibleReports: TeamDynamicsWorkerEligibleReport[];
};

export type TeamDynamicsReportWorkerRunResult = {
  ok: true;
  dryRun: false;
  requestedLimit: number;
  appliedLimit: number;
  eligibleCount: number;
  processedCount: number;
  summary: {
    processed: number;
    ready: number;
    failed: number;
    skipped: number;
    claimNotAcquired: number;
    errors: number;
  };
  results: TeamDynamicsReportWorkerProcessEntry[];
};

export const TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT = 3;
export const TEAM_DYNAMICS_REPORT_WORKER_MAX_LIMIT = 10;
export { TEAM_DYNAMICS_REPORT_TYPE, TEAM_DYNAMICS_REPORT_VERSION };

function isFinitePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalizeTeamDynamicsReportWorkerLimit(limit?: number): number {
  if (!isFinitePositiveInteger(limit)) {
    return TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(limit), TEAM_DYNAMICS_REPORT_WORKER_MAX_LIMIT);
}

function getSupabaseClient(deps: TeamDynamicsReportWorkerDependencies = {}) {
  return deps.createSupabaseClient?.() ?? createSupabaseAdminClient();
}

function getProcessor(deps: TeamDynamicsReportWorkerDependencies = {}) {
  return deps.processReport ?? processTeamDynamicsExecutiveOverviewWithOpenAI;
}

function toEligibleReport(row: TeamDynamicsReportWorkerRow): TeamDynamicsWorkerEligibleReport {
  return {
    id: row.id,
    organizationId: row.organization_id,
    teamId: row.team_id,
    teamAssessmentAssignmentId: row.team_assessment_assignment_id,
    selectionDraftId: row.selection_draft_id,
    aggregationSnapshotId: row.aggregation_snapshot_id,
    reportType: row.report_type,
    reportVersion: row.report_version,
    reportStatus: "queued",
    queuedAt: row.queued_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadQueuedTeamDynamicsExecutiveOverviewReports(
  options: TeamDynamicsReportWorkerOptions = {},
  deps: TeamDynamicsReportWorkerDependencies = {},
): Promise<TeamDynamicsWorkerEligibleReport[]> {
  const supabase = getSupabaseClient(deps);
  const appliedLimit = normalizeTeamDynamicsReportWorkerLimit(options.limit);
  const { data, error } = await supabase
    .from("team_assessment_reports")
    .select(
      "id, organization_id, team_id, team_assessment_assignment_id, selection_draft_id, aggregation_snapshot_id, report_type, report_version, report_status, generator_type, model_name, included_member_ids_snapshot, input_snapshot, report_snapshot, error_message, queued_at, started_at, completed_at, created_at, updated_at",
    )
    .eq("report_status", "queued")
    .eq("report_type", TEAM_DYNAMICS_REPORT_TYPE)
    .eq("report_version", TEAM_DYNAMICS_REPORT_VERSION)
    .order("queued_at", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(0, appliedLimit - 1);

  if (error) {
    throw new Error(
      `Failed to load queued Team Dynamics Executive Overview reports: ${error.message}`,
    );
  }

  return ((data ?? []) as TeamDynamicsReportWorkerRow[]).map(toEligibleReport);
}

export async function processQueuedTeamDynamicsExecutiveOverviewReports(
  options: TeamDynamicsReportWorkerOptions = {},
  deps: TeamDynamicsReportWorkerDependencies = {},
): Promise<TeamDynamicsReportWorkerDryRunResult | TeamDynamicsReportWorkerRunResult> {
  const requestedLimit = options.limit ?? TEAM_DYNAMICS_REPORT_WORKER_DEFAULT_LIMIT;
  const appliedLimit = normalizeTeamDynamicsReportWorkerLimit(options.limit);
  const eligibleReports = await loadQueuedTeamDynamicsExecutiveOverviewReports(
    { limit: appliedLimit },
    deps,
  );

  if (options.dryRun) {
    return {
      ok: true,
      dryRun: true,
      requestedLimit,
      appliedLimit,
      eligibleCount: eligibleReports.length,
      wouldProcessCount: eligibleReports.length,
      eligibleReports,
    };
  }

  const processor = getProcessor(deps);
  const results: TeamDynamicsReportWorkerProcessEntry[] = [];

  for (const report of eligibleReports) {
    try {
      const result = await processor({
        teamAssessmentReportId: report.id,
        organizationId: report.organizationId,
      });

      if (result.ok) {
        results.push({
          reportId: report.id,
          organizationId: report.organizationId,
          outcome: "ready",
          operation: result.operation,
        });
        continue;
      }

      if (result.operation === "claim_not_acquired") {
        results.push({
          reportId: report.id,
          organizationId: report.organizationId,
          outcome: "claim_not_acquired",
          operation: result.operation,
          marker: result.marker,
          reason: result.reason,
        });
        continue;
      }

      results.push({
        reportId: report.id,
        organizationId: report.organizationId,
        outcome: "failed",
        operation: result.operation,
        marker: result.marker,
        reason: result.reason,
      });
    } catch (error) {
      results.push({
        reportId: report.id,
        organizationId: report.organizationId,
        outcome: "error",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const ready = results.filter((entry) => entry.outcome === "ready").length;
  const failed = results.filter((entry) => entry.outcome === "failed").length;
  const claimNotAcquired = results.filter(
    (entry) => entry.outcome === "claim_not_acquired",
  ).length;
  const errors = results.filter((entry) => entry.outcome === "error").length;

  return {
    ok: true,
    dryRun: false,
    requestedLimit,
    appliedLimit,
    eligibleCount: eligibleReports.length,
    processedCount: results.length,
    summary: {
      processed: results.length,
      ready,
      failed,
      skipped: claimNotAcquired,
      claimNotAcquired,
      errors,
    },
    results,
  };
}
