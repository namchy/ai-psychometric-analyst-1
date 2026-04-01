import "server-only";

import type { AssessmentLocale } from "@/lib/assessment/locale";
import type {
  DetailedReportV1,
  DetailedReportDimensionCode,
  DetailedReportScoreBand,
} from "@/lib/assessment/detailed-report-v1";
import {
  detailedReportV1OpenAiSchema,
  validateDetailedReportV1,
} from "@/lib/assessment/detailed-report-v1";
import {
  getIpcPromptContract,
  isIpcTestSlug,
  type IpcReportAudience,
  type IpcReportPromptInput,
} from "@/lib/assessment/ipc-report-contract";
import {
  formatIpcReportValidationErrors,
  validateIpcHrReportV1,
  validateIpcParticipantReportV1,
  type IpcCompletedAssessmentReport,
} from "@/lib/assessment/ipc-report-v1";
import type { CompletedAssessmentResults } from "@/lib/assessment/scoring";
import type { ActivePromptVersion } from "@/lib/assessment/prompt-version";
import type { ScoringMethod } from "@/lib/assessment/types";

export type ReportGeneratorType = "mock" | "openai";
export type ReportFamily = "big_five" | "ipc";
export type ReportAudience = "participant" | "hr";
export type ReportVersion = "v1";
export type ReportRenderFormat =
  | "big_five_participant_v1"
  | "big_five_hr_v1"
  | "ipc_participant_v1"
  | "ipc_hr_v1";
export type AttemptReportStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "unavailable";

export type BigFiveCompletedAssessmentReport = DetailedReportV1;
export type RuntimeCompletedAssessmentReport =
  | BigFiveCompletedAssessmentReport
  | IpcCompletedAssessmentReport;
export type CompletedAssessmentReport = RuntimeCompletedAssessmentReport;

export type CompletedAssessmentReportRequest = {
  attemptId: string;
  testId: string;
  testSlug: string;
  audience: ReportAudience;
  locale: AssessmentLocale;
  scoringMethod: ScoringMethod;
  promptVersion: string;
  results: CompletedAssessmentResults;
};

export type AiReportDimensionInput = {
  dimension_code: DetailedReportDimensionCode;
  dimension_label: string;
  raw_score: number;
  scored_question_count: number;
  average_score: number;
  score_band: DetailedReportScoreBand;
};

export type AiReportPromptInput = {
  attempt_id: string;
  test_id: string;
  test_slug: string;
  audience: "participant" | "hr";
  locale: AssessmentLocale;
  scoring_method: ScoringMethod;
  prompt_version: string;
  scored_response_count: number;
  dimension_scores: AiReportDimensionInput[];
  deterministic_summary: {
    highest_dimension: DetailedReportDimensionCode | null;
    lowest_dimension: DetailedReportDimensionCode | null;
    dimensions_ranked: DetailedReportDimensionCode[];
  };
};

export type ReportPromptInput = AiReportPromptInput | IpcReportPromptInput;

export type ReportContractDescriptor = {
  family: ReportFamily;
  reportType: string;
  sourceType: string;
  promptKey: string;
  schemaName: string;
  outputSchemaJson: Record<string, unknown>;
};

export type PreparedReportGenerationInput = {
  attemptId: string;
  testSlug: string;
  promptVersion: string;
  promptVersionId: string | null;
  promptTemplate: ActivePromptVersion | null;
  promptInput: ReportPromptInput;
  reportContract: ReportContractDescriptor;
};

export type ReportProviderResult =
  | {
      ok: true;
      report: RuntimeCompletedAssessmentReport;
    }
  | {
      ok: false;
      reason: string;
    };

export type ReportProvider = {
  type: ReportGeneratorType;
  generateReport: (input: PreparedReportGenerationInput) => Promise<ReportProviderResult>;
};

export function isCompletedAssessmentReport(value: unknown): value is CompletedAssessmentReport {
  return (
    validateDetailedReportV1(value).ok ||
    validateIpcParticipantReportV1(value).ok ||
    validateIpcHrReportV1(value).ok
  );
}

export function resolveReportContract(
  testSlug: string,
  audience: IpcReportAudience,
): ReportContractDescriptor {
  if (isIpcTestSlug(testSlug)) {
    const contract = getIpcPromptContract(audience);

    return {
      family: "ipc",
      reportType: contract.reportType,
      sourceType: contract.sourceType,
      promptKey: contract.promptKey,
      schemaName: contract.schemaId,
      outputSchemaJson: contract.outputSchemaJson as Record<string, unknown>,
    };
  }

  return {
    family: "big_five",
    reportType: "individual",
    sourceType: "single_test",
    promptKey: "completed_assessment_report",
    schemaName: "detailed_report_v1",
    outputSchemaJson: detailedReportV1OpenAiSchema as Record<string, unknown>,
  };
}

export function resolveReportFamily(testSlug: string): ReportFamily {
  return isIpcTestSlug(testSlug) ? "ipc" : "big_five";
}

export function resolveReportSignal(context: {
  testSlug: string;
  audience: ReportAudience;
}): {
  reportFamily: ReportFamily;
  reportAudience: ReportAudience;
  reportVersion: ReportVersion;
  reportRenderFormat: ReportRenderFormat | null;
} {
  const reportFamily = resolveReportFamily(context.testSlug);
  const reportAudience = context.audience;
  const reportVersion = "v1" as const;
  const reportRenderFormat = resolveReportRenderFormat({
    reportFamily,
    reportAudience,
    reportVersion,
  });

  return {
    reportFamily,
    reportAudience,
    reportVersion,
    reportRenderFormat,
  };
}

export function resolveReportRenderFormat(context: {
  reportFamily: ReportFamily;
  reportAudience: ReportAudience;
  reportVersion: ReportVersion;
}): ReportRenderFormat | null {
  const key = `${context.reportFamily}:${context.reportAudience}:${context.reportVersion}`;

  switch (key) {
    case "big_five:participant:v1":
      return "big_five_participant_v1";
    case "big_five:hr:v1":
      return "big_five_hr_v1";
    case "ipc:participant:v1":
      return "ipc_participant_v1";
    case "ipc:hr:v1":
      return "ipc_hr_v1";
    default:
      return null;
  }
}

export function validateRuntimeCompletedAssessmentReport(
  value: unknown,
  context: {
    testSlug: string;
    audience: ReportAudience;
  },
):
  | { ok: true; value: RuntimeCompletedAssessmentReport }
  | { ok: false; reason: string } {
  if (isIpcTestSlug(context.testSlug)) {
    const validationResult =
      context.audience === "participant"
        ? validateIpcParticipantReportV1(value)
        : validateIpcHrReportV1(value);

    if (!validationResult.ok) {
      return {
        ok: false,
        reason: formatIpcReportValidationErrors(validationResult.errors),
      };
    }

    return {
      ok: true,
      value: validationResult.value,
    };
  }

  const validationResult = validateDetailedReportV1(value);

  if (!validationResult.ok) {
    return {
      ok: false,
      reason: validationResult.errors.map((error) => `${error.path || "<root>"}: ${error.message}`).join(" | "),
    };
  }

  return {
    ok: true,
    value: validationResult.value,
  };
}

export function isAttemptReportStatus(value: unknown): value is AttemptReportStatus {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "ready" ||
    value === "failed" ||
    value === "unavailable"
  );
}
