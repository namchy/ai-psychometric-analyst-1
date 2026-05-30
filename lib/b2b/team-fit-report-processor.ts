import "server-only";

import type { TeamFitReportV1 } from "@/lib/b2b/team-fit-report-contract";
import { buildTeamFitReportInputSnapshot, persistTeamFitReportInputSnapshot, type TeamFitReportInputSnapshot } from "@/lib/b2b/team-fit-report-input";
import {
  createTeamFitFakeProvider,
  type TeamFitReportProvider,
  type TeamFitReportProviderFailureReason,
  type TeamFitReportProviderResult,
} from "@/lib/b2b/team-fit-report-provider";
import {
  claimTeamFitReportForProcessing,
  markTeamFitReportProcessingFailed,
  type ClaimTeamFitReportForProcessingResult,
} from "@/lib/b2b/team-fit-report-lifecycle";
import { buildMockTeamFitReportSnapshot } from "@/lib/b2b/team-fit-report-mock";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TeamFitReportProcessorDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  now?: () => string;
  buildMockSnapshot?: (inputSnapshot: TeamFitReportInputSnapshot) => TeamFitReportV1;
  provider?: TeamFitReportProvider;
};

type TeamFitProviderFailureMarker =
  | "TEAM_FIT_PROVIDER_CONFIG_ERROR"
  | "TEAM_FIT_PROVIDER_REQUEST_FAILED"
  | "TEAM_FIT_PROVIDER_PARSE_FAILURE"
  | "TEAM_FIT_PROVIDER_VALIDATION_FAILURE"
  | "TEAM_FIT_PROVIDER_UNKNOWN_ERROR";

export type ProcessTeamFitReportWithProviderResult =
  | { ok: true; reportId: string; status: "ready" }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "already_processing"
        | "already_ready"
        | "failed_not_claimable"
        | "not_claimable"
        | "update_failed"
        | "input_snapshot_failed"
        | "provider_failed"
        | "ready_update_failed"
        | "fail_transition_failed";
      reportId?: string;
      message: string;
      marker?: TeamFitProviderFailureMarker;
    };

export type ProcessTeamFitReportWithMockResult = ProcessTeamFitReportWithProviderResult;

type TeamFitReportRow = {
  id: string;
  organization_id: string;
  report_status: string;
  input_snapshot: Record<string, unknown> | null;
  report_snapshot: Record<string, unknown> | null;
  error_message: string | null;
  completed_at: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getNow(deps: TeamFitReportProcessorDependencies): string {
  return deps.now ? deps.now() : new Date().toISOString();
}

function mapTeamFitProviderFailure(input: {
  result: Extract<TeamFitReportProviderResult, { ok: false }>;
}): {
  marker: TeamFitProviderFailureMarker;
  message: string;
} {
  const reasonMap: Record<TeamFitReportProviderFailureReason, TeamFitProviderFailureMarker> = {
    provider_config_error: "TEAM_FIT_PROVIDER_CONFIG_ERROR",
    provider_request_failed: "TEAM_FIT_PROVIDER_REQUEST_FAILED",
    provider_parse_failure: "TEAM_FIT_PROVIDER_PARSE_FAILURE",
    provider_validation_failure: "TEAM_FIT_PROVIDER_VALIDATION_FAILURE",
    provider_unknown_error: "TEAM_FIT_PROVIDER_UNKNOWN_ERROR",
  };

  return {
    marker: reasonMap[input.result.reason],
    message: reasonMap[input.result.reason],
  };
}

async function loadProcessingReportRow(input: {
  teamFitReportId: string;
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<TeamFitReportRow | null> {
  const { data, error } = await input.supabase
    .from("team_fit_reports")
    .select("id, organization_id, report_status, input_snapshot, report_snapshot, error_message, completed_at")
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Team Fit processing row: ${error.message}`);
  }

  return (data as TeamFitReportRow | null) ?? null;
}

async function markTeamFitReportReady(input: {
  teamFitReportId: string;
  organizationId: string;
  reportSnapshot: TeamFitReportV1;
}, deps: TeamFitReportProcessorDependencies = {}): Promise<
  | { ok: true }
  | { ok: false; reason: string }
> {
  const supabase = deps.supabase ?? createSupabaseAdminClient();
  const completedAt = getNow(deps);
  const { data, error } = await supabase
    .from("team_fit_reports")
    .update({
      report_status: "ready",
      report_snapshot: input.reportSnapshot,
      completed_at: completedAt,
      error_message: null,
    })
    .eq("id", input.teamFitReportId)
    .eq("organization_id", input.organizationId)
    .eq("report_status", "processing")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, reason: `Failed to mark Team Fit report as ready: ${error.message}` };
  }

  if (!data) {
    return { ok: false, reason: "Team Fit report could not be marked ready because it is no longer processing." };
  }

  return { ok: true };
}

async function failClaimedReport(input: {
  teamFitReportId: string;
  organizationId: string;
  errorMessage: string;
}, deps: TeamFitReportProcessorDependencies): Promise<
  | { ok: true }
  | { ok: false; reason: string }
> {
  const failed = await markTeamFitReportProcessingFailed(
    {
      teamFitReportId: input.teamFitReportId,
      organizationId: input.organizationId,
      errorMessage: input.errorMessage,
    },
    {
      supabase: deps.supabase,
      now: deps.now,
    },
  );

  if (!failed.ok) {
    return { ok: false, reason: failed.message };
  }

  return { ok: true };
}

async function ensureInputSnapshot(input: {
  teamFitReportId: string;
  organizationId: string;
  claim: Extract<ClaimTeamFitReportForProcessingResult, { ok: true }>;
}, deps: TeamFitReportProcessorDependencies) {
  if (input.claim.report.inputSnapshot) {
    return buildTeamFitReportInputSnapshot(
      {
        teamFitReportId: input.teamFitReportId,
        organizationId: input.organizationId,
      },
      { supabase: deps.supabase },
    );
  }

  return persistTeamFitReportInputSnapshot(
    {
      teamFitReportId: input.teamFitReportId,
      organizationId: input.organizationId,
    },
    { supabase: deps.supabase },
  );
}

export async function processTeamFitReportWithMock(input: {
  teamFitReportId: string;
  organizationId: string;
}, deps: TeamFitReportProcessorDependencies = {}): Promise<ProcessTeamFitReportWithMockResult> {
  const provider =
    deps.provider ??
    createTeamFitFakeProvider({
      buildSnapshot: deps.buildMockSnapshot ?? buildMockTeamFitReportSnapshot,
    });

  return processTeamFitReportWithProvider(input, {
    ...deps,
    provider,
  });
}

export async function processTeamFitReportWithProvider(input: {
  teamFitReportId: string;
  organizationId: string;
}, deps: TeamFitReportProcessorDependencies = {}): Promise<ProcessTeamFitReportWithProviderResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return { ok: false, reason: "invalid_payload", message: "teamFitReportId is required." };
  }

  if (!isNonEmptyString(input.organizationId)) {
    return { ok: false, reason: "invalid_payload", message: "organizationId is required." };
  }

  const claimResult = await claimTeamFitReportForProcessing(
    input,
    {
      supabase: deps.supabase,
      now: deps.now,
    },
  );

  if (!claimResult.ok) {
    return {
      ok: false,
      reason: claimResult.reason,
      reportId: input.teamFitReportId,
      message: claimResult.message,
    };
  }

  const inputResult = await ensureInputSnapshot(
    {
      teamFitReportId: input.teamFitReportId,
      organizationId: input.organizationId,
      claim: claimResult,
    },
    deps,
  );

  if (!inputResult.ok) {
    const failureMessage = `Team Fit input snapshot failed: ${inputResult.message}`;
    const failed = await failClaimedReport(
      {
        teamFitReportId: input.teamFitReportId,
        organizationId: input.organizationId,
        errorMessage: failureMessage,
      },
      deps,
    );

    if (!failed.ok) {
      return {
        ok: false,
        reason: "fail_transition_failed",
        reportId: input.teamFitReportId,
        message: failed.reason,
      };
    }

    return {
      ok: false,
      reason: "input_snapshot_failed",
      reportId: input.teamFitReportId,
      message: failureMessage,
    };
  }

  const provider = deps.provider ?? createTeamFitFakeProvider();
  const providerResult = await provider.generate(inputResult.inputSnapshot);

  if (!providerResult.ok) {
    const failure = mapTeamFitProviderFailure({ result: providerResult });
    const failed = await failClaimedReport(
      {
        teamFitReportId: input.teamFitReportId,
        organizationId: input.organizationId,
        errorMessage: failure.message,
      },
      deps,
    );

    if (!failed.ok) {
      return {
        ok: false,
        reason: "fail_transition_failed",
        reportId: input.teamFitReportId,
        message: failed.reason,
        marker: failure.marker,
      };
    }

    return {
      ok: false,
      reason: "provider_failed",
      reportId: input.teamFitReportId,
      message: failure.message,
      marker: failure.marker,
    };
  }

  const ready = await markTeamFitReportReady(
    {
      teamFitReportId: input.teamFitReportId,
      organizationId: input.organizationId,
      reportSnapshot: providerResult.snapshot,
    },
    deps,
  );

  if (!ready.ok) {
    return {
      ok: false,
      reason: "ready_update_failed",
      reportId: input.teamFitReportId,
      message: ready.reason,
    };
  }

  return {
    ok: true,
    reportId: input.teamFitReportId,
    status: "ready",
  };
}
