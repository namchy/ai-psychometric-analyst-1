import "server-only";

import {
  validateIndividualDevelopmentProfileSnapshot,
  type IndividualDevelopmentProfileSnapshot,
} from "@/lib/assessment/individual-development-profile-contract";
import { resolveAiReportLanguagePolicy } from "@/lib/assessment/ai-report-language-policy";
import {
  buildIndividualDevelopmentProfileInputSnapshot,
  type IndividualDevelopmentProfileInputBuilderResult,
  type IndividualDevelopmentProfileInputSnapshot,
} from "@/lib/assessment/individual-development-profile-input";
import {
  claimIndividualDevelopmentProfileAssessmentReportForProcessing,
  markIndividualDevelopmentProfileAssessmentReportFailed,
  markIndividualDevelopmentProfileAssessmentReportReady,
  type ClaimIndividualDevelopmentProfileAssessmentReportForProcessingResult,
} from "@/lib/assessment/individual-development-profile-lifecycle";
import {
  generateIndividualDevelopmentProfileReport,
  type IndividualDevelopmentProfileProviderSeamResult,
} from "@/lib/assessment/individual-development-profile-provider";
import { resolveReportLocale } from "@/lib/assessment/locale";
import {
  formatReportLanguageQualityIssues,
  validateReportLanguageQuality,
} from "@/lib/assessment/report-language-quality";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type IndividualDevelopmentProfileProcessorDependencies = {
  supabase?: ReturnType<typeof createSupabaseAdminClient>;
  now?: () => string;
  buildInputSnapshot?: typeof buildIndividualDevelopmentProfileInputSnapshot;
  generateReport?: typeof generateIndividualDevelopmentProfileReport;
  validateSnapshot?: typeof validateIndividualDevelopmentProfileSnapshot;
  claimReportForProcessing?: typeof claimIndividualDevelopmentProfileAssessmentReportForProcessing;
  markReportReady?: typeof markIndividualDevelopmentProfileAssessmentReportReady;
  markReportFailed?: typeof markIndividualDevelopmentProfileAssessmentReportFailed;
};

export type ProcessIndividualDevelopmentProfileAssessmentReportResult =
  | { ok: true; reportId: string; status: "ready" }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "report_not_found"
        | "already_processing"
        | "already_ready"
        | "failed_not_processable"
        | "not_processable"
        | "update_failed"
        | "input_snapshot_failed"
        | "provider_failed"
        | "validation_failed"
        | "ready_update_failed"
        | "fail_transition_failed";
      reportId?: string;
      message: string;
    };

type ProcessorFailureCode =
  | "IDP_INPUT_SNAPSHOT_FAILED"
  | "IDP_PROVIDER_FAILED"
  | "IDP_REPORT_VALIDATION_FAILED";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function trimReason(reason: string): string {
  const normalized = reason.trim().replace(/\s+/g, " ");
  return normalized.length > 300 ? `${normalized.slice(0, 297)}...` : normalized;
}

function getBuildInputSnapshot(
  deps: IndividualDevelopmentProfileProcessorDependencies,
) {
  return deps.buildInputSnapshot ?? buildIndividualDevelopmentProfileInputSnapshot;
}

function getGenerateReport(
  deps: IndividualDevelopmentProfileProcessorDependencies,
) {
  return deps.generateReport ?? generateIndividualDevelopmentProfileReport;
}

function getValidateSnapshot(
  deps: IndividualDevelopmentProfileProcessorDependencies,
) {
  return deps.validateSnapshot ?? validateIndividualDevelopmentProfileSnapshot;
}

function getClaimReportForProcessing(
  deps: IndividualDevelopmentProfileProcessorDependencies,
) {
  return (
    deps.claimReportForProcessing ??
    claimIndividualDevelopmentProfileAssessmentReportForProcessing
  );
}

function getMarkReportReady(
  deps: IndividualDevelopmentProfileProcessorDependencies,
) {
  return deps.markReportReady ?? markIndividualDevelopmentProfileAssessmentReportReady;
}

function getMarkReportFailed(
  deps: IndividualDevelopmentProfileProcessorDependencies,
) {
    return deps.markReportFailed ?? markIndividualDevelopmentProfileAssessmentReportFailed;
}

function mapClaimFailure(
  result: Extract<
    ClaimIndividualDevelopmentProfileAssessmentReportForProcessingResult,
    { ok: false }
  >,
): Extract<
  ProcessIndividualDevelopmentProfileAssessmentReportResult,
  { ok: false }
> {
  switch (result.reason) {
    case "invalid_payload":
      return { ok: false, reason: "invalid_payload", message: result.message };
    case "report_not_found":
      return { ok: false, reason: "report_not_found", message: result.message };
    case "already_processing":
      return { ok: false, reason: "already_processing", message: result.message };
    case "already_ready":
      return { ok: false, reason: "already_ready", message: result.message };
    case "failed_not_claimable":
      return { ok: false, reason: "failed_not_processable", message: result.message };
    case "not_claimable":
      return { ok: false, reason: "not_processable", message: result.message };
    case "report_update_failed":
    default:
      return { ok: false, reason: "update_failed", message: result.message };
  }
}

function buildProviderFailureMessage(
  result: Extract<IndividualDevelopmentProfileProviderSeamResult, { ok: false }>,
): string {
  return trimReason(
    result.errors.length > 0
      ? result.errors.join(" | ")
      : "Individual Development Profile provider failed.",
  );
}

async function failClaimedReport(input: {
  assessmentReportId: string;
  organizationId: string;
  failureCode: ProcessorFailureCode;
  failureReason: string;
}, deps: IndividualDevelopmentProfileProcessorDependencies): Promise<
  | { ok: true }
  | { ok: false; reason: string }
> {
  const failed = await getMarkReportFailed(deps)(
    {
      assessmentReportId: input.assessmentReportId,
      organizationId: input.organizationId,
      failureCode: input.failureCode,
      failureReason: input.failureReason,
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

function resolveGeneratorVersion(snapshot: IndividualDevelopmentProfileSnapshot): string | null {
  return typeof snapshot.metadata.generatorVersion === "string"
    ? snapshot.metadata.generatorVersion
    : null;
}

function prepareIndividualDevelopmentProfileSnapshotForPersistence(
  snapshot: IndividualDevelopmentProfileSnapshot,
): { ok: true; snapshot: IndividualDevelopmentProfileSnapshot } | { ok: false; errors: string[] } {
  const locale = resolveReportLocale(snapshot.locale);
  const languagePolicy = resolveAiReportLanguagePolicy(locale);
  const canonicalizedSnapshot = languagePolicy
    ? languagePolicy.canonicalizeUserFacingOutput(snapshot)
    : snapshot;
  const globalLanguageErrors = languagePolicy
    ? languagePolicy.validateUserFacingOutput(canonicalizedSnapshot, {
        audience: "hr",
      })
    : [];
  const qualityResult = validateReportLanguageQuality({
    snapshot: canonicalizedSnapshot,
    locale,
    audience: "hr",
    reportType: "single_test",
    context: "individual_development_profile_hr_report",
  });
  const errors = [
    ...globalLanguageErrors.map((error) =>
      error.path ? `${error.path}: ${error.message}` : error.message,
    ),
    ...(qualityResult.ok
      ? []
      : [`IDP HR report language quality failed: ${formatReportLanguageQualityIssues(qualityResult.issues)}`]),
  ];

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, snapshot: canonicalizedSnapshot };
}

export async function processIndividualDevelopmentProfileAssessmentReport(input: {
  assessmentReportId: string;
  organizationId: string;
  participantId?: string;
}, deps: IndividualDevelopmentProfileProcessorDependencies = {}): Promise<ProcessIndividualDevelopmentProfileAssessmentReportResult> {
  if (!isNonEmptyString(input.assessmentReportId)) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: "assessmentReportId is required.",
    };
  }

  if (!isNonEmptyString(input.organizationId)) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: "organizationId is required.",
    };
  }

  const claimResult = await getClaimReportForProcessing(deps)(
    input,
    {
      supabase: deps.supabase,
      now: deps.now,
    },
  );

  if (!claimResult.ok) {
    return {
      ...mapClaimFailure(claimResult),
      reportId: input.assessmentReportId,
    };
  }

  const inputResult: IndividualDevelopmentProfileInputBuilderResult =
    await getBuildInputSnapshot(deps)(
      {
        assessmentAssignmentId: claimResult.report.assessment_assignment_id,
        organizationId: claimResult.report.organization_id,
        participantId: claimResult.report.participant_id,
      },
      {
        supabase: deps.supabase,
      },
    );

  if (!inputResult.ok) {
    const failed = await failClaimedReport(
      {
        assessmentReportId: claimResult.report.id,
        organizationId: claimResult.report.organization_id,
        failureCode: "IDP_INPUT_SNAPSHOT_FAILED",
        failureReason: trimReason(
          `Input snapshot build failed: ${inputResult.reason}. ${inputResult.details}`,
        ),
      },
      deps,
    );

    if (!failed.ok) {
      return {
        ok: false,
        reason: "fail_transition_failed",
        reportId: claimResult.report.id,
        message: failed.reason,
      };
    }

    return {
      ok: false,
      reason: "input_snapshot_failed",
      reportId: claimResult.report.id,
      message: trimReason(inputResult.details),
    };
  }

  const providerResult = await getGenerateReport(deps)(inputResult.inputSnapshot);

  if (!providerResult.ok) {
    const failed = await failClaimedReport(
      {
        assessmentReportId: claimResult.report.id,
        organizationId: claimResult.report.organization_id,
        failureCode: "IDP_PROVIDER_FAILED",
        failureReason: buildProviderFailureMessage(providerResult),
      },
      deps,
    );

    if (!failed.ok) {
      return {
        ok: false,
        reason: "fail_transition_failed",
        reportId: claimResult.report.id,
        message: failed.reason,
      };
    }

    return {
      ok: false,
      reason: "provider_failed",
      reportId: claimResult.report.id,
      message: buildProviderFailureMessage(providerResult),
    };
  }

  const qualityGate = prepareIndividualDevelopmentProfileSnapshotForPersistence(
    providerResult.reportSnapshot,
  );

  if (!qualityGate.ok) {
    const failed = await failClaimedReport(
      {
        assessmentReportId: claimResult.report.id,
        organizationId: claimResult.report.organization_id,
        failureCode: "IDP_REPORT_VALIDATION_FAILED",
        failureReason: trimReason(qualityGate.errors.join(" | ")),
      },
      deps,
    );

    if (!failed.ok) {
      return {
        ok: false,
        reason: "fail_transition_failed",
        reportId: claimResult.report.id,
        message: failed.reason,
      };
    }

    return {
      ok: false,
      reason: "validation_failed",
      reportId: claimResult.report.id,
      message: trimReason(qualityGate.errors.join(" | ")),
    };
  }

  const validation = getValidateSnapshot(deps)(qualityGate.snapshot);

  if (!validation.ok) {
    const failed = await failClaimedReport(
      {
        assessmentReportId: claimResult.report.id,
        organizationId: claimResult.report.organization_id,
        failureCode: "IDP_REPORT_VALIDATION_FAILED",
        failureReason: trimReason(validation.errors.join(" | ")),
      },
      deps,
    );

    if (!failed.ok) {
      return {
        ok: false,
        reason: "fail_transition_failed",
        reportId: claimResult.report.id,
        message: failed.reason,
      };
    }

    return {
      ok: false,
      reason: "validation_failed",
      reportId: claimResult.report.id,
      message: trimReason(validation.errors.join(" | ")),
    };
  }

  const readyResult = await getMarkReportReady(deps)(
    {
      assessmentReportId: claimResult.report.id,
      organizationId: claimResult.report.organization_id,
      inputSnapshot: inputResult.inputSnapshot as IndividualDevelopmentProfileInputSnapshot,
      reportSnapshot: validation.value,
      generatorType: providerResult.provider,
      generatorVersion: resolveGeneratorVersion(validation.value),
      modelName: null,
    },
    {
      supabase: deps.supabase,
      now: deps.now,
    },
  );

  if (!readyResult.ok) {
    return {
      ok: false,
      reason: "ready_update_failed",
      reportId: claimResult.report.id,
      message: readyResult.message,
    };
  }

  return {
    ok: true,
    reportId: claimResult.report.id,
    status: "ready",
  };
}
