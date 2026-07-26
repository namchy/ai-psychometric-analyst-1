import "server-only";

import {
  buildTeamFitReportInputSnapshot,
  persistTeamFitReportInputSnapshot,
  type BuildTeamFitReportInputSnapshotResult,
  type PersistTeamFitReportInputSnapshotResult,
  type TeamFitReportInputDependencies,
  type TeamFitReportInputSnapshot,
} from "@/lib/b2b/team-fit-report-input";
import {
  TEAM_FIT_REPORT_V2_TYPE,
  TEAM_FIT_REPORT_V2_VERSION,
} from "@/lib/b2b/team-fit-report-identity";
import {
  claimTeamFitReportV2ForProcessing,
  markTeamFitReportV2ProcessingFailed,
  markTeamFitReportV2Ready,
  type ClaimTeamFitReportForProcessingResult,
} from "@/lib/b2b/team-fit-report-lifecycle";
import {
  validateTeamFitReportV2,
  type TeamFitReportV2,
} from "@/lib/b2b/team-fit-report-v2-contract";
import { validateTeamFitReportV2EvidenceReferences } from "@/lib/b2b/team-fit-report-v2-evidence";
import type { GenerateTeamFitReportV2WithOpenAIResult } from "@/lib/b2b/team-fit-report-v2-openai-provider";

type TeamFitReportV2ProviderFailure = Extract<
  GenerateTeamFitReportV2WithOpenAIResult,
  { ok: false }
>;

type TeamFitReportInputOperationResult =
  | BuildTeamFitReportInputSnapshotResult
  | PersistTeamFitReportInputSnapshotResult;

export type TeamFitReportV2ProcessorProvider = {
  generate: (
    inputSnapshot: TeamFitReportInputSnapshot,
  ) => Promise<GenerateTeamFitReportV2WithOpenAIResult>;
};

export type TeamFitReportV2ProcessorDependencies = {
  provider: TeamFitReportV2ProcessorProvider;
  supabase?: TeamFitReportInputDependencies["supabase"];
  now?: () => string;
  buildInputSnapshot?: typeof buildTeamFitReportInputSnapshot;
  persistInputSnapshot?: typeof persistTeamFitReportInputSnapshot;
};

type TeamFitReportV2ProcessorMarker =
  | "TEAM_FIT_V2_INPUT_SNAPSHOT_FAILURE"
  | "TEAM_FIT_V2_PROVIDER_UNHANDLED_FAILURE"
  | "TEAM_FIT_V2_PROVIDER_CONFIG_ERROR"
  | "TEAM_FIT_V2_PROVIDER_INPUT_INCOMPLETE"
  | "TEAM_FIT_V2_PROVIDER_EVIDENCE_CATALOG_COLLISION"
  | "TEAM_FIT_V2_PROVIDER_FAILURE"
  | "TEAM_FIT_V2_PROVIDER_EMPTY_CONTENT"
  | "TEAM_FIT_V2_PROVIDER_INVALID_JSON"
  | "TEAM_FIT_V2_PROVIDER_CONTRACT_INCOMPLETE"
  | "TEAM_FIT_V2_PROVIDER_INVALID_EVIDENCE_REFERENCE"
  | "TEAM_FIT_V2_CONTRACT_VALIDATION_FAILURE"
  | "TEAM_FIT_V2_EVIDENCE_VALIDATION_FAILURE"
  | "TEAM_FIT_V2_LINEAGE_VALIDATION_FAILURE";

export type ProcessTeamFitReportV2WithProviderResult =
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
        | "provider_validation_failed"
        | "ready_update_failed"
        | "fail_transition_failed";
      reportId?: string;
      message: string;
      marker?: TeamFitReportV2ProcessorMarker;
      providerCode?: TeamFitReportV2ProviderFailure["code"];
      providerStage?: TeamFitReportV2ProviderFailure["stage"];
    };

const PROVIDER_FAILURE_MARKERS = {
  config_error: "TEAM_FIT_V2_PROVIDER_CONFIG_ERROR",
  input_incomplete: "TEAM_FIT_V2_PROVIDER_INPUT_INCOMPLETE",
  evidence_catalog_collision: "TEAM_FIT_V2_PROVIDER_EVIDENCE_CATALOG_COLLISION",
  provider_failure: "TEAM_FIT_V2_PROVIDER_FAILURE",
  empty_content: "TEAM_FIT_V2_PROVIDER_EMPTY_CONTENT",
  invalid_json: "TEAM_FIT_V2_PROVIDER_INVALID_JSON",
  contract_incomplete: "TEAM_FIT_V2_PROVIDER_CONTRACT_INCOMPLETE",
  invalid_evidence_reference: "TEAM_FIT_V2_PROVIDER_INVALID_EVIDENCE_REFERENCE",
} as const satisfies Record<
  TeamFitReportV2ProviderFailure["code"],
  TeamFitReportV2ProcessorMarker
>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isV2InputSnapshot(
  snapshot: TeamFitReportInputSnapshot,
): boolean {
  return (
    snapshot.reportType === TEAM_FIT_REPORT_V2_TYPE &&
    snapshot.reportVersion === TEAM_FIT_REPORT_V2_VERSION
  );
}

async function ensureV2InputSnapshot(
  input: {
    teamFitReportId: string;
    organizationId: string;
    claim: Extract<ClaimTeamFitReportForProcessingResult, { ok: true }>;
  },
  deps: TeamFitReportV2ProcessorDependencies,
): Promise<TeamFitReportInputOperationResult> {
  const operation = input.claim.report.inputSnapshot
    ? deps.buildInputSnapshot ?? buildTeamFitReportInputSnapshot
    : deps.persistInputSnapshot ?? persistTeamFitReportInputSnapshot;

  return operation(
    {
      teamFitReportId: input.teamFitReportId,
      organizationId: input.organizationId,
    },
    { supabase: deps.supabase },
  );
}

async function failClaimedV2Report(
  input: {
    teamFitReportId: string;
    organizationId: string;
    marker: TeamFitReportV2ProcessorMarker;
  },
  deps: TeamFitReportV2ProcessorDependencies,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const failed = await markTeamFitReportV2ProcessingFailed(
    {
      teamFitReportId: input.teamFitReportId,
      organizationId: input.organizationId,
      errorMessage: input.marker,
    },
    { supabase: deps.supabase, now: deps.now },
  );

  return failed.ok ? { ok: true } : { ok: false, message: failed.message };
}

function valuesDifferWhenBothPresent(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return typeof left === "string" && typeof right === "string" && left !== right;
}

function findLineageMismatch(
  snapshot: TeamFitReportV2,
  inputSnapshot: TeamFitReportInputSnapshot,
): string | null {
  if (snapshot.inputSnapshotVersion !== inputSnapshot.inputVersion) {
    return "inputSnapshotVersion";
  }

  if (
    snapshot.teamContext.organizationId !==
    inputSnapshot.organizationContext.organizationId
  ) {
    return "teamContext.organizationId";
  }

  if (snapshot.teamContext.teamId !== inputSnapshot.teamContext.teamId) {
    return "teamContext.teamId";
  }

  if (
    snapshot.candidateContext.organizationId !==
    inputSnapshot.organizationContext.organizationId
  ) {
    return "candidateContext.organizationId";
  }

  if (
    snapshot.candidateContext.participantId !==
    inputSnapshot.candidateContext.participantId
  ) {
    return "candidateContext.participantId";
  }

  const candidateMetadata = inputSnapshot.candidateSignals.sourceMetadata;
  const teamMetadata = inputSnapshot.teamSignals.sourceMetadata;
  const sourceChecks: Array<[
    string,
    string | null | undefined,
    string | null | undefined,
  ]> = [
    [
      "candidateContext.assessmentAssignmentId",
      snapshot.candidateContext.assessmentAssignmentId,
      candidateMetadata?.assessmentAssignmentId,
    ],
    [
      "candidateContext.compositeInputSnapshotId",
      snapshot.candidateContext.compositeInputSnapshotId,
      inputSnapshot.candidateContext.candidateSourceId,
    ],
    [
      "teamContext.teamAssessmentAssignmentId",
      snapshot.teamContext.teamAssessmentAssignmentId,
      teamMetadata?.teamAssessmentAssignmentId,
    ],
    [
      "teamContext.teamDynamicsAggregationSnapshotId",
      snapshot.teamContext.teamDynamicsAggregationSnapshotId,
      teamMetadata?.aggregationSnapshotId ?? inputSnapshot.teamContext.teamSourceId,
    ],
  ];

  return (
    sourceChecks.find(([, actual, expected]) =>
      valuesDifferWhenBothPresent(actual, expected),
    )?.[0] ?? null
  );
}

async function returnPostClaimFailure(
  input: {
    teamFitReportId: string;
    organizationId: string;
    reason:
      | "input_snapshot_failed"
      | "provider_failed"
      | "provider_validation_failed";
    message: string;
    marker: TeamFitReportV2ProcessorMarker;
    providerCode?: TeamFitReportV2ProviderFailure["code"];
    providerStage?: TeamFitReportV2ProviderFailure["stage"];
  },
  deps: TeamFitReportV2ProcessorDependencies,
): Promise<ProcessTeamFitReportV2WithProviderResult> {
  const failed = await failClaimedV2Report(input, deps);

  if (!failed.ok) {
    return {
      ok: false,
      reason: "fail_transition_failed",
      reportId: input.teamFitReportId,
      message: failed.message,
      marker: input.marker,
      providerCode: input.providerCode,
      providerStage: input.providerStage,
    };
  }

  return {
    ok: false,
    reason: input.reason,
    reportId: input.teamFitReportId,
    message: input.message,
    marker: input.marker,
    providerCode: input.providerCode,
    providerStage: input.providerStage,
  };
}

export async function processTeamFitReportV2WithProvider(
  input: { teamFitReportId: string; organizationId: string },
  deps: TeamFitReportV2ProcessorDependencies,
): Promise<ProcessTeamFitReportV2WithProviderResult> {
  if (!isNonEmptyString(input.teamFitReportId)) {
    return { ok: false, reason: "invalid_payload", message: "teamFitReportId is required." };
  }

  if (!isNonEmptyString(input.organizationId)) {
    return { ok: false, reason: "invalid_payload", message: "organizationId is required." };
  }

  const claim = await claimTeamFitReportV2ForProcessing(input, {
    supabase: deps.supabase,
    now: deps.now,
  });

  if (!claim.ok) {
    return {
      ok: false,
      reason: claim.reason,
      reportId: input.teamFitReportId,
      message: claim.message,
    };
  }

  let inputResult: TeamFitReportInputOperationResult;

  try {
    inputResult = await ensureV2InputSnapshot({ ...input, claim }, deps);
  } catch {
    inputResult = {
      ok: false,
      reason: "invalid_existing_input_snapshot",
      message: "Team Fit V2 input snapshot operation failed.",
    };
  }

  if (!inputResult.ok || !isV2InputSnapshot(inputResult.inputSnapshot)) {
    return returnPostClaimFailure(
      {
        ...input,
        reason: "input_snapshot_failed",
        message: inputResult.ok
          ? "Team Fit V2 input snapshot does not carry the V2 report identity."
          : inputResult.message,
        marker: "TEAM_FIT_V2_INPUT_SNAPSHOT_FAILURE",
      },
      deps,
    );
  }

  let providerResult: GenerateTeamFitReportV2WithOpenAIResult;

  try {
    providerResult = await deps.provider.generate(inputResult.inputSnapshot);
  } catch {
    return returnPostClaimFailure(
      {
        ...input,
        reason: "provider_failed",
        message: "Team Fit V2 provider failed outside its result contract.",
        marker: "TEAM_FIT_V2_PROVIDER_UNHANDLED_FAILURE",
      },
      deps,
    );
  }

  if (!providerResult.ok) {
    const marker = PROVIDER_FAILURE_MARKERS[providerResult.code];
    return returnPostClaimFailure(
      {
        ...input,
        reason: "provider_failed",
        message: marker,
        marker,
        providerCode: providerResult.code,
        providerStage: providerResult.stage,
      },
      deps,
    );
  }

  const contractValidation = validateTeamFitReportV2(providerResult.snapshot);

  if (!contractValidation.ok) {
    return returnPostClaimFailure(
      {
        ...input,
        reason: "provider_validation_failed",
        message: "Team Fit V2 provider success snapshot failed contract validation.",
        marker: "TEAM_FIT_V2_CONTRACT_VALIDATION_FAILURE",
      },
      deps,
    );
  }

  const evidenceValidation = validateTeamFitReportV2EvidenceReferences(
    contractValidation.value,
    providerResult.evidenceCatalog,
  );

  if (!evidenceValidation.ok) {
    return returnPostClaimFailure(
      {
        ...input,
        reason: "provider_validation_failed",
        message: "Team Fit V2 provider success snapshot failed evidence validation.",
        marker: "TEAM_FIT_V2_EVIDENCE_VALIDATION_FAILURE",
      },
      deps,
    );
  }

  const lineageMismatch = findLineageMismatch(
    contractValidation.value,
    inputResult.inputSnapshot,
  );

  if (lineageMismatch) {
    return returnPostClaimFailure(
      {
        ...input,
        reason: "provider_validation_failed",
        message: `Team Fit V2 snapshot lineage validation failed at ${lineageMismatch}.`,
        marker: "TEAM_FIT_V2_LINEAGE_VALIDATION_FAILURE",
      },
      deps,
    );
  }

  const ready = await markTeamFitReportV2Ready(
    {
      ...input,
      reportSnapshot: contractValidation.value,
    },
    { supabase: deps.supabase, now: deps.now },
  );

  if (!ready.ok) {
    return {
      ok: false,
      reason: "ready_update_failed",
      reportId: input.teamFitReportId,
      message: ready.message,
    };
  }

  return { ok: true, reportId: input.teamFitReportId, status: "ready" };
}
